#!/usr/bin/env bash
# ─── AI Chess Arena Launcher ───────────────────────────
# Starts the full desktop app (server + client + Electron)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "Installing root dependencies..."
  npm install
fi
if [ ! -d "server/node_modules" ]; then
  echo "Installing server dependencies..."
  (cd server && npm install)
fi
if [ ! -d "client/node_modules" ]; then
  echo "Installing client dependencies..."
  (cd client && npm install)
fi

# Fix electron binary if missing
if [ ! -f "node_modules/electron/dist/electron" ] 2>/dev/null; then
  echo "Setting up Electron binary..."
  node node_modules/electron/install.js 2>/dev/null || true
  if [ ! -f "node_modules/electron/dist/electron" ]; then
    HASH_DIR=$(ls -d ~/.cache/electron/*/electron-*-linux-x64.zip 2>/dev/null | head -1 | xargs dirname 2>/dev/null || true)
    if [ -n "$HASH_DIR" ]; then
      ZIP=$(ls "$HASH_DIR"/electron-*-linux-x64.zip 2>/dev/null | head -1)
      if [ -n "$ZIP" ]; then
        rm -rf node_modules/electron/dist
        mkdir -p node_modules/electron/dist
        unzip -qo "$ZIP" -d node_modules/electron/dist/
        chmod +x node_modules/electron/dist/electron
        printf 'electron' > node_modules/electron/path.txt
      fi
    fi
  fi
fi

exec npm run desktop
