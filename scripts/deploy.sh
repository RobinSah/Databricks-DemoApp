#!/usr/bin/env bash
# Build and deploy Atlas to Databricks Apps.
#
# Strategy: ship the prebuilt Next.js standalone output instead of source.
# The platform's 10-minute startup window and per-file 10 MB limit make
# "npm install + next build at startup" fragile; a locally built artifact
# is deterministic, starts in seconds, and is byte-identical to what the
# E2E suite ran against.
#
# The app resource itself (name, serving-endpoint grant) is declared in
# databricks.yml — `databricks bundle deploy` creates/updates it. Code
# deployments then go through sync + apps deploy, which works with scoped
# PATs (bundle-managed app deployments require the broader all-apis scope).
#
# Auth: uses the DATABRICKS_HOST / DATABRICKS_TOKEN environment (or a CLI
# profile) — see .env.example.
set -euo pipefail
cd "$(dirname "$0")/.."

APP_NAME="atlas-insights"
WORKSPACE_SRC="/Workspace/Users/$(databricks current-user me -o json | python3 -c 'import json,sys; print(json.load(sys.stdin)["userName"])')/apps/${APP_NAME}-src"

echo "==> Building production bundle"
npm run build

echo "==> Assembling .appbuild"
rm -rf .appbuild
mkdir -p .appbuild
cp -R .next/standalone/. .appbuild/
mkdir -p .appbuild/.next
cp -R .next/static .appbuild/.next/static
cp -R public .appbuild/public
cp app.yaml .appbuild/app.yaml

# Don't ship node_modules: ~2k small files overwhelm the workspace-files
# API (persistent mkdirs timeouts). The platform runs `npm install` at
# startup from package.json instead, so ship a runtime-deps-only manifest —
# the standalone server resolves the same packages from the fresh install.
rm -rf .appbuild/node_modules
node -e "
const p = require('./package.json');
const runtime = { name: p.name, version: p.version, private: true, dependencies: p.dependencies };
require('fs').writeFileSync('.appbuild/package.json', JSON.stringify(runtime, null, 2) + '\n');
"

# Local .env files must never reach the workspace.
find .appbuild -maxdepth 1 -name ".env*" -delete

echo "==> Verifying per-file 10 MB limit"
oversized=$(find .appbuild -type f -size +10M | head -5)
if [ -n "$oversized" ]; then
  echo "ERROR: files exceed the Databricks Apps 10 MB per-file limit:"
  echo "$oversized"
  exit 1
fi

echo "==> Ensuring app resource exists (bundle)"
# Best-effort: re-reading bundle state requires the all-apis token scope,
# which scoped PATs lack. The app resource (and its serving-endpoint
# grant) only needs to be created once, so a failure here is fine as long
# as the app already exists.
databricks bundle deploy || databricks apps get "$APP_NAME" >/dev/null

echo "==> Syncing build artifact to ${WORKSPACE_SRC}"
# Notes from the trenches:
# - sync applies the repo's .gitignore even to an ignored artifact dir, so
#   run it from inside .appbuild with an explicit include-all.
# - the workspace-files API drops connections under ~2k rapid uploads;
#   sync is incremental, so retry until it converges.
# Sync is incremental, so every attempt makes forward progress even when
# the API drops the connection; 25 attempts with backoff has converged on
# builds ~800 files large. Tune upward before assuming a real failure.
synced=""
for attempt in $(seq 1 25); do
  echo "--- sync attempt ${attempt} ---"
  if (cd .appbuild && databricks sync . "$WORKSPACE_SRC" --full --include '**'); then
    synced="yes"
    break
  fi
  sleep 20
done
if [ -z "$synced" ]; then
  echo "ERROR: sync did not converge after 25 attempts"
  exit 1
fi

echo "==> Starting app compute (no-op if already running)"
databricks apps start "$APP_NAME" || true

echo "==> Deploying"
databricks apps deploy "$APP_NAME" --source-code-path "$WORKSPACE_SRC"

echo "==> App status"
databricks apps get "$APP_NAME" -o json | python3 -c "import json,sys; d=json.load(sys.stdin); print('compute:', d.get('compute_status',{}).get('state')); print('deployment:', d.get('active_deployment',{}).get('status',{}).get('state')); print('url:', d.get('url'))"
