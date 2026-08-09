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

# sharp's platform-native binaries exceed the 10 MB per-file limit and are
# unused (images.unoptimized in next.config.ts).
rm -rf .appbuild/node_modules/sharp .appbuild/node_modules/@img

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
databricks bundle deploy

echo "==> Syncing build artifact to ${WORKSPACE_SRC}"
databricks sync .appbuild "$WORKSPACE_SRC" --full

echo "==> Starting app compute (no-op if already running)"
databricks apps start "$APP_NAME" || true

echo "==> Deploying"
databricks apps deploy "$APP_NAME" --source-code-path "$WORKSPACE_SRC"

echo "==> App status"
databricks apps get "$APP_NAME" -o json | python3 -c "import json,sys; d=json.load(sys.stdin); print('compute:', d.get('compute_status',{}).get('state')); print('deployment:', d.get('active_deployment',{}).get('status',{}).get('state')); print('url:', d.get('url'))"
