#!/usr/bin/env bash
set -euo pipefail


echo "→ Ensuring coderunner assets directory…"
ASSETS_SRC="$HOME/.coderunner/assets"
mkdir -p "$ASSETS_SRC"

# If public/assets exists as a real dir, move its contents into ASSETS_SRC
if [ -d "public/assets" ] && [ ! -L "public/assets" ]; then
  echo "→ Migrating existing public/assets → $ASSETS_SRC"
  cp -R public/assets/. "$ASSETS_SRC"/
  rm -rf public/assets
fi

echo "→ Creating symlink public/assets → $ASSETS_SRC"
ln -s "$ASSETS_SRC" public/assets
# 1) Ensure Go is installed, then install mcp-filesystem-server
echo "→ Installing mcp-filesystem-server..."
if ! command -v mcp-filesystem-server &>/dev/null; then
  if ! command -v go &>/dev/null; then
    echo "❌ Go not found. Please install Go: https://golang.org/dl/"
    exit 1
  fi
  echo "   • running: go install github.com/mark3labs/mcp-filesystem-server@latest"
  GO111MODULE=on go install github.com/mark3labs/mcp-filesystem-server@latest
else
  echo "   • mcp-filesystem-server already on PATH"
fi

# 2) Clone & install coderunner
CODERUNNER_DIR="$HOME/coderunner"
echo "→ Installing coderunner..."
# ... existing code ...

if [ ! -d "$CODERUNNER_DIR" ]; then
  git clone https://github.com/BandarLabs/coderunner.git "$CODERUNNER_DIR"
  cd "$CODERUNNER_DIR"
  chmod +x install.sh
  sudo ./install.sh
  echo "   • coderunner server started"
  cd - &>/dev/null
else
  echo "   • coderunner already cloned at $CODERUNNER_DIR → fetching updates"
  cd "$CODERUNNER_DIR"
  git fetch --all
  git reset --hard origin/main    # or replace origin/main with your branch
  chmod +x install.sh
  sudo ./install.sh
  echo "   • coderunner server updated"
  cd - &>/dev/null
fi
# 3) Bootstrap your chat app
echo "→ Installing chat app dependencies…"
npm install

# 4) Generate .env (if not present)
if [ ! -f ".env.local" ]; then
  echo "→ Writing .env.local…"
  cat > .env.local <<EOF
# Path to the mcp-filesystem-server binary
MCP_FILESYSTEM_CMD=${HOME}/go/bin/mcp-filesystem-server

# Where your static assets live
MCP_FS_ASSETS_DIR=\${PWD}/public/assets

# Default workspace directory
MCP_FS_WORKSPACE_DIR=\${HOME}/Documents

# (Optional) adjust coderunner URL if not using localhost
CODERUNNER_SSE_URL=http://coderunner.local:8222/sse
EOF
  echo "   • .env.local created – review & edit as needed"
else
  echo "   • .env.local already exists, skipping"
fi

echo
echo "✅ Setup complete!"
echo "   • Start your Next.js app with: npm run dev"