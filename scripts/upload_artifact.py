#!/usr/bin/env python3
"""Upload the .appbuild artifact to the workspace, one file at a time.

`databricks sync` uploads with high concurrency, which the Free Edition
workspace-files API answers with dropped connections and stalls
("unexpected EOF" / 1-minute inactivity timeouts) — measured empirically:
sequential uploads are ~250 ms each with a 100% success rate, while
concurrent syncs failed to converge after 25 retry passes. The CLI has no
concurrency flag, so this script does the boring, reliable thing.

Env: DATABRICKS_HOST, DATABRICKS_TOKEN.
Usage: python3 scripts/upload_artifact.py <local-dir> <workspace-dir>
"""

from __future__ import annotations

import os
import sys
import time
import urllib.parse
import urllib.request

RETRIES_PER_FILE = 3
TIMEOUT_S = 75


def die(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    sys.exit(1)


def api_post_json(host: str, token: str, endpoint: str, payload: dict) -> None:
    import json

    request = urllib.request.Request(
        f"{host}{endpoint}",
        data=json.dumps(payload).encode(),
        method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    last_error: Exception | None = None
    for attempt in range(1, RETRIES_PER_FILE + 1):
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
                if response.status == 200:
                    return
                last_error = RuntimeError(f"HTTP {response.status}")
        except Exception as error:  # noqa: BLE001
            last_error = error
        time.sleep(2 * attempt)
    raise RuntimeError(f"{endpoint} {payload}: {last_error}")


def upload_file(host: str, token: str, local_path: str, workspace_path: str) -> None:
    # Encode without the leading slash: the endpoint 400s ("Bad url") on the
    # resulting double slash if it's kept.
    encoded = urllib.parse.quote(workspace_path.lstrip("/"), safe="")
    url = f"{host}/api/2.0/workspace-files/import-file/{encoded}?overwrite=true"
    with open(local_path, "rb") as fh:
        body = fh.read()
    last_error: Exception | None = None
    for attempt in range(1, RETRIES_PER_FILE + 1):
        request = urllib.request.Request(
            url, data=body, method="POST",
            headers={"Authorization": f"Bearer {token}"},
        )
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
                if response.status == 200:
                    return
                last_error = RuntimeError(f"HTTP {response.status}")
        except Exception as error:  # noqa: BLE001 — retry any transport failure
            last_error = error
        time.sleep(2 * attempt)
    raise RuntimeError(f"{workspace_path}: failed after {RETRIES_PER_FILE} attempts: {last_error}")


def main() -> None:
    if len(sys.argv) != 3:
        die(f"usage: {sys.argv[0]} <local-dir> <workspace-dir>")
    local_root, workspace_root = sys.argv[1], sys.argv[2].rstrip("/")

    host = (os.environ.get("DATABRICKS_HOST") or "").rstrip("/")
    token = os.environ.get("DATABRICKS_TOKEN") or ""
    if not host or not token:
        die("DATABRICKS_HOST and DATABRICKS_TOKEN must be set")
    if not host.startswith("http"):
        host = f"https://{host}"

    files: list[str] = []
    for dirpath, dirnames, filenames in os.walk(local_root):
        # .databricks is sync-CLI bookkeeping (the API 400s on the reserved
        # name anyway); .DS_Store is Finder noise.
        dirnames[:] = [d for d in dirnames if d != ".databricks"]
        for name in filenames:
            if name == ".DS_Store":
                continue
            path = os.path.join(dirpath, name)
            # Standalone builds leave symlinks into node_modules, which we
            # deliberately don't ship — skip anything that isn't a real file.
            if not os.path.isfile(path) or os.path.islink(path):
                continue
            files.append(path)
    files.sort()
    total = len(files)
    print(f"Uploading {total} files to {workspace_root} (sequential)")

    # import-file does not auto-create parent folders (HTTP 400), so build
    # the directory tree first. mkdirs is recursive; creating the deepest
    # paths covers the intermediates.
    directories = {os.path.dirname(os.path.relpath(f, local_root)) for f in files}
    directories.discard("")
    leaf_dirs = [d for d in directories if not any(o != d and o.startswith(d + "/") for o in directories)]
    print(f"Creating {len(leaf_dirs)} directories")
    for directory in sorted(leaf_dirs):
        api_post_json(host, token, "/api/2.0/workspace/mkdirs", {"path": f"{workspace_root}/{directory}"})

    started = time.time()
    for index, path in enumerate(files, start=1):
        relative = os.path.relpath(path, local_root)
        upload_file(host, token, path, f"{workspace_root}/{relative}")
        if index % 50 == 0 or index == total:
            elapsed = time.time() - started
            print(f"  {index}/{total} ({elapsed:.0f}s elapsed)")

    print(f"Done: {total} files in {time.time() - started:.0f}s")


if __name__ == "__main__":
    main()
