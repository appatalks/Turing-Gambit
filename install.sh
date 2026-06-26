#!/usr/bin/env bash
# ─── Turing-Gambit Installer ────────────────────────────
# curl -fsSL https://raw.githubusercontent.com/appatalks/Turing-Gambit/main/install.sh | bash
set -euo pipefail

REPO="https://github.com/appatalks/Turing-Gambit.git"
INSTALL_DIR="${HOME}/.local/share/turing-gambit"
BIN_LINK="${HOME}/.local/bin/turing-gambit"

echo ""
echo "  ♔  Turing-Gambit Installer"
echo "  ─────────────────────────────"
echo ""

# ── Check prerequisites ──────────────────────────────
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required. Install from https://nodejs.org (v18+)"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "❌ Git is required. Install with: sudo apt install git"; exit 1; }

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "❌ Node.js 18+ required (you have $(node -v))"
  exit 1
fi

# ── Clone or update ──────────────────────────────────
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "  ↻  Updating existing installation..."
  cd "$INSTALL_DIR"
  git pull --ff-only
else
  echo "  ⬇  Cloning Turing-Gambit..."
  rm -rf "$INSTALL_DIR"
  git clone --depth 1 "$REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ── Install dependencies ─────────────────────────────
echo "  📦 Installing dependencies..."
npm install --silent 2>/dev/null
cd server && npm install --silent 2>/dev/null && cd ..
cd client && npm install --silent 2>/dev/null && cd ..

# ── Fix Electron binary if needed ────────────────────
if [ ! -f "node_modules/electron/dist/electron" ] 2>/dev/null; then
  echo "  ⚡ Setting up Electron..."
  node node_modules/electron/install.js 2>/dev/null || true
  if [ ! -f "node_modules/electron/dist/electron" ]; then
    HASH_DIR=$(find ~/.cache/electron -name "electron-*-linux-x64.zip" 2>/dev/null | head -1 | xargs dirname 2>/dev/null || true)
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

# ── Create launcher symlink ──────────────────────────
mkdir -p "$(dirname "$BIN_LINK")"
cat > "$BIN_LINK" << 'EOF'
#!/bin/bash
cd "${HOME}/.local/share/turing-gambit"
exec npm run desktop
EOF
chmod +x "$BIN_LINK"

# ── Desktop entry ────────────────────────────────────
mkdir -p "${HOME}/.local/share/applications"
cat > "${HOME}/.local/share/applications/turing-gambit.desktop" << DESKTOP
[Desktop Entry]
Name=Turing-Gambit
Comment=AI Chess Match — Put AI models head-to-head
Exec=${BIN_LINK}
Icon=${INSTALL_DIR}/electron/resources/icon.png
Terminal=false
Type=Application
Categories=Game;BoardGame;
StartupWMClass=turing-gambit
DESKTOP
update-desktop-database "${HOME}/.local/share/applications" 2>/dev/null || true

echo ""
echo "  ✓  Installed to ${INSTALL_DIR}"
echo "  ✓  Launcher: ${BIN_LINK}"
echo "  ✓  Added to application menu"
echo ""
echo "  To run:"
echo "    turing-gambit"
echo ""
echo "  Or find 'Turing-Gambit' in your app menu."
echo ""
