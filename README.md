![Video Edit Code Runner](videoeditcoderunner.jpeg)

# coderunner-ui — Fork with LM Studio, Real TTY, MCP Events & Web Snap

> **Status:** WIP — *works for me (mostly) with some glitches.*  
> **Fork notice:** This is a **fork that extends** the original `coderunner-ui`.
> It adds:
>
> - **LM Studio** (OpenAI-compatible) integration & a **model selector** in the UI
> - **The MLX support in LM Studio is the best available for now, that is why i did this** MLX is around 30% faster than gguf
> - A **real TTY popup terminal** (xterm.js + Apple Container VM)
> - An **MCP Events panel** (SSE) to watch tool calls live
> - **Web automation inside the VM** (Playwright): screenshots + visible text
> - Hardened **MCP** setup (filesystem, shell exec, terminal control)

Local‑first and privacy‑friendly. No cloud required unless you pick a cloud model.

---

## Table of Contents

- [What’s Included](#whats-included)
- [Manual Tools Installed in the VM](#manual-tools-installed-in-the-vm)
- [Prerequisites](#prerequisites)
- [Install & Run](#install--run)
- [Configuration (`.env.local`)](#configuration-envlocal)
- [Scripts](#scripts)
- [How the Pieces Fit](#how-the-pieces-fit)
- [Features in Detail](#features-in-detail)
- [Using the App](#using-the-app)
- [Example Prompts](#example-prompts)
- [Troubleshooting](#troubleshooting)
- [Known Glitches](#known-glitches)
- [Security Notes](#security-notes)
- [Files Added/Changed in This Fork](#files-addedchanged-in-this-fork)
- [Fork Status & Credits](#fork-status--credits)
- [License](#license)

---

## What’s Included

- **LM Studio provider**  
  Use any local model served by LM Studio’s OpenAI‑compatible API (`/v1`). A header **Model Selector** lets you switch models; a pill shows **loaded / not loaded**.

- **Backends supported**
  - `lmstudio/<model-id>` (local; no OpenAI key required)
  - `ollama/*` (local)
  - `openai/*`, `anthropic/*`, `google_genai/*` (cloud; keys optional and opt‑in)

- **MCP tooling**
  - **Filesystem** (Go or Node server): read/write/move/search within **allowed** paths
  - **Shell Exec** (host‑stdio wrapper): run **non‑interactive** commands **in the VM**
  - **Web Snap** (Playwright in the VM): full‑page screenshots + visible text extraction

- **✅ Real terminal (true TTY)**
  - Popup window (resizable, minimal chrome) connected to a login shell in the Apple Container VM
  - Interactive TUIs like `htop`, colored output, live refresh, key presses (`q`, `Ctrl-C`)
  - Assistant can **type into the terminal** via `terminal.write` / `terminal.runInteractive`

- **✅ MCP Events panel (SSE)**
  - Live feed of tool calls & results (observability for debugging/traceability)

---

## Manual Tools Installed in the VM

The Apple Container VM (Debian bookworm) includes or installs on demand:

- **ffmpeg** — `5.1.7-0+deb12u1` (video/audio processing)  
  *Check:* `ffmpeg -version`
- **htop** — `3.2.2` (interactive process viewer)  
  *Requires a real TTY — use the popup terminal.*
- **Node.js 22 / npm** — from `deb.nodesource.com` (`nodesource.list`)
- **Playwright (Chromium)** — auto‑installed inside the VM on first screenshot (`npx playwright install chromium`)
- **Core utils** — `bash`, `curl`, `git`, `coreutils`
- *(Optional)* **tmux** — handy for multiple interactive sessions (not required)

Download and install:
https://github.com/apple/container/releases/download/0.4.1/container-0.4.1-installer-signed.pkg
or newer :-)

container image pull instavm/coderunner
ASSETS_SRC="$HOME/src/coderunner-ui/public/assets"
container run  --volume "$ASSETS_SRC:/app/uploads" --name coderunner --detach --rm --cpus 8 --memory 4g instavm/coderunner

open the interactive shell to the container
container exec -it coderunner /bin/bash
and install what you need or like if it's not done by the LLM

APT sources are set in:

- `/etc/apt/sources.list.d/debian.sources` — bookworm + updates + security  
- `/etc/apt/sources.list.d/nodesource.list` — Node 22 channel

When you bake a new base image later, preserve or re‑apply these packages.

- Todo make a new coderunner-plus image

---

## Prerequisites

- macOS (Apple Silicon recommended)
- **Apple Container** CLI at `/usr/local/bin/container` (ships with macOS)
- Node.js 20+ and npm
- **LM Studio** installed and serving at `/v1` → <https://lmstudio.ai>
- (Optional) Go, if you prefer the Go‑based filesystem MCP server

---

## Install & Run

### 1) Install dependencies

```bash
npm install
```


### 2) Configure

Create `.env.local` (see full template below) and adjust:

- `CONTAINER_BIN` (absolute path to Apple `container`)
- `CONTAINER_NAME` (your VM, e.g., `coderunner`)
- `CODERUNNER_MCP_URL` (MCP endpoint inside the VM)
- `LMS_API_BASE` (LM Studio endpoint; default `http://localhost:1234/v1`)

Create local directories:

```bash
mkdir -p ~/.coderunner/assets ## here is some confusion, not need if you point your container to the folder below
mkdir -p /Users/<you>/src/coderunner-ui/public/assets
```

### 3) Run (UI + PTY bridge)

```bash
npm run dev:all
# UI: http://localhost:3000
# PTY WS: ws://localhost:3030/pty
```

- Open the app → `http://localhost:3000`
- Launch terminal via the **round “Terminal” button** (bottom‑right) or visit `http://localhost:3000/terminal`
- Open the **MCP Events Panel** (button in UI) to watch tool calls live

---

## Configuration (`.env.local`)

Copy & adapt:

```dotenv
# ======================================================================
# coderunner-ui — .env.local
# ======================================================================
# All values are local to your machine. Adjust paths as needed.
# ======================================================================

# Default model (LM Studio)
DEFAULT_SELECTED_MODEL=lmstudio/mistralai/mistral-small-3.2

# Cloud keys (optional; can also be entered in the UI)
OPENAI_API_KEY=sk-REPLACE_ME
# ANTHROPIC_API_KEY=...
# GOOGLE_API_KEY=... (or GOOGLE_GENERATIVE_AI_API_KEY / GOOGLE_GENAI_API_KEY)

# LM Studio (OpenAI-compatible)
LMS_API_BASE=http://localhost:1234/v1
NEXT_PUBLIC_LMS_API_BASE=http://localhost:1234/v1
LMS_API_KEY=lmstudio-local
NEXT_PUBLIC_LMS_API_KEY=lmstudio-local

# MCP endpoints (HTTP) — Coderunner MCP inside your Apple Container VM
CODERUNNER_MCP_URL=http://192.168.64.2:8222/mcp
# NEXT_PUBLIC_CODERUNNER_MCP_URL=http://192.168.64.2:8222/mcp

# MCP: Filesystem (Host → Tools)
# Prefer Go binary (see install.sh) or use the Node variant as fallback
MCP_FILESYSTEM_CMD=/Users/<you>/go/bin/mcp-filesystem-server
MCP_FS_ASSETS_DIR=/Users/<you>/src/coderunner-ui/public/assets

# MCP: Shell Exec (Host STDIO → runs IN VM)
MCP_SHELL_CMD=node
MCP_SHELL_ARGS=mcp/mcp-shell-exec.mjs
MCP_SHELL_EXEC_WRAPPER=/usr/local/bin/container exec coderunner bash -lc

# MCP: Web Snap (Playwright IN VM)
MCP_WEB_SNAP_CMD=node
MCP_WEB_SNAP_ARGS=mcp/mcp-web-snap.mjs
# Uses MCP_SHELL_EXEC_WRAPPER (runs inside the VM)

# MCP: Interactive sessions (optional, tmux-based)
MCP_SHELL_SESSION_CMD=node
MCP_SHELL_SESSION_ARGS=mcp/mcp-shell-session.mjs

# PTY / Browser terminal
NEXT_PUBLIC_PTY_WS_URL=ws://localhost:3030/pty
PTY_FEED_URL=http://localhost:3030/write
PTY_HOST=127.0.0.1
PTY_PORT=3030

# Apple 'container' CLI
CONTAINER_BIN=/usr/local/bin/container
CONTAINER_NAME=coderunner

# Spawn args for a login shell with a real TTY
PTY_CONTAINER_ARGS=exec --interactive --tty coderunner bash -l
PTY_CONTAINER_ARGS_FALLBACK=exec --tty coderunner bash -l
```

---

## Scripts

- `npm run dev` — starts the Next.js app (UI) only  
- `npm run dev:all` — starts **UI** and the **PTY server** together  
- `npm run build` — builds Next.js  
- `npm run start` — starts the built app

---

## How the Pieces Fit

- **UI Model Selector**
  - Lists LM Studio models (`/api/models`)
  - Shows **loaded/not‑loaded** (`/api/model-state`)
  - Persists selection in `selectedModel` cookie

- **Chat backend (`/api/chat`)**
  - Model resolution: **Cookie** → `X-Selected-Model` → `DEFAULT_SELECTED_MODEL`
  - No API key required for `lmstudio/*` & `ollama/*`
  - Merges MCP tools: Filesystem, Shell Exec, Web Snap (in VM), Coderunner MCP

- **Chat proxy (`/api/chat-proxy`)**
  - Forwards requests; same model resolution as above
  - Streams results to the UI

- **PTY Bridge**
  - WebSocket `ws://localhost:3030/pty` connects xterm.js to a **real TTY** in the VM
  - HTTP `POST /write` mirrors assistant output into the terminal (optional)

- **MCP Events Panel**
  - SSE endpoint streams tool calls/results live for observability

---

## Features in Detail

### LM Studio
- OpenAI‑compatible endpoint (`/v1`)
- Works with any LM Studio model ID, e.g. `mistralai/mistral-small-3.2`
- Typically faster on Apple Silicon thanks to MLX

### Filesystem (MCP)
Tools include (non‑exhaustive):
- `list_directory`, `tree`, `list_allowed_directories`, `get_file_info`
- `read_file`, `read_multiple_files`, `write_file`, `modify_file`
- `copy_file`, `move_file`, `delete_file`, `create_directory`
- `search_files`, `search_within_files`

### Web Snap (MCP, in VM)
- `web.screenshot` → save a full‑page PNG (e.g., `/app/uploads/heise.png`)
- `navigate_and_get_all_visible_text` → return visible text
- First use installs Chromium via Playwright (inside the VM)

### Shell Exec (MCP, in VM)
- `container.exec` → non‑interactive commands (scripts, batch work)

### Real Terminal
- Popup (resizable, minimal chrome) with **true TTY**
- Use `htop`, `vim`, `nano`, `tmux`, etc.
- Assistant tools:
  - `terminal.write` → type into the terminal (e.g., `"htop\n"`, `"\x03"` for `Ctrl-C`)
  - `terminal.runInteractive` → open terminal, run a command, optionally send keys after a delay
- Auto‑resizes; supports ANSI colors and TUIs

### MCP Events Panel (SSE)
- Shows tool names, arguments, results/errors
- Helpful to debug “why did the assistant do that?”

---

## Using the App

1. Start with `npm run dev:all` and open `http://localhost:3000`.
2. Choose a model in the header (LM Studio selector recommended).
3. Use chat naturally. The assistant will:
   - Prefer **local** tools (LM Studio, Filesystem MCP)
   - Run **web automation inside the VM**
   - Use the **real terminal** when a TTY is needed (interactive/colored apps)
4. Click **Terminal** to open the TTY window.
5. Click **MCP Events** to watch tool calls in real time.

---

## Example Prompts

- **Screenshots**  
  “Take a full‑page screenshot of `https://www.heise.de` and save it to `/app/uploads/heise.png`.”

- **Video edit**  
  “Trim the first 10 seconds of `/app/uploads/input.mp4` and write `/app/uploads/clip-10s.mp4` with `ffmpeg`.”

- **Filesystem**  
  “Search for ‘TODO’ in `public/assets` and show the matching lines and files.”

- **Interactive terminal**  
  “Open the terminal and run `htop`, then press `q` after 5 seconds.”

- **Stop a process**  
  “Send `Ctrl-C` to the terminal.”

- **Extract visible text**  
  “Open `https://example.com` in the VM and return the visible text.”

---

## Troubleshooting

- **`ENOENT: spawn container` / “Unknown option”**  
  - Ensure `CONTAINER_BIN=/usr/local/bin/container` exists and is executable.
  - Use `--interactive --tty` (no `--stdin`) for Apple `container` CLI.
  - Confirm VM name matches `CONTAINER_NAME`.

- **PTY says `disconnected (shell-exit)`**  
  - Verify in a host terminal:  
    ```bash
    /usr/local/bin/container exec --interactive --tty coderunner bash -l
    ```
  - If it exits immediately, check the VM/container health.

- **Playwright first run is slow**  
  - Chromium gets installed inside the VM on demand; subsequent runs are fast.

- **`self is not defined` on `/terminal`**  
  - The page is a client component and uses browser‑safe xterm imports:
    - `@xterm/xterm` and `@xterm/addon-fit` (not the legacy `xterm` package)
  - Ensure imports occur **only** in client components.

- **`AI_NoSuchToolError`**  
  - Ensure MCP clients connect (server logs).
  - Verify `.env.local` paths and that `/api/chat` merges tools:
    - Filesystem MCP, Shell Exec MCP, Web Snap MCP, Coderunner MCP

- **Peer dependency conflicts on `npm install`**  
  - Re‑run with:
    ```bash
    npm install --legacy-peer-deps
    ```

---

## Known Glitches

- **Header jitter** on certain buttons while loading.
- **Sidebar overlap** with the LM Studio selector in rare cases.
- **Terminal focus**: click inside after opening to ensure keystrokes are captured.
- **Events Panel** is intentionally minimal; if empty, check console & logs.

---

## Security Notes

- Everything defaults to **local‑first**.
- Cloud models are **opt‑in** (keys in `.env.local` or UI).
- Filesystem tools are scoped to **allowed directories** only.

---

## Files Added/Changed in This Fork

**UI**
- `components/ModelSelectorPortal.tsx` — injects LM Studio selector into header
- `components/TerminalLauncher.tsx` — floating button to open the terminal window
- `components/MCPEventsPanel.tsx` — live tool‑call feed (SSE)
- `app/terminal/page.tsx` — xterm.js client (real TTY over WS)
- `app/page.tsx` — integrates selector, terminal button, assistant instructions

**APIs**
- `app/api/models/route.ts` — LM Studio models listing
- `app/api/model-state/route.ts` — model loaded/not‑loaded
- `app/api/chat/route.ts` — merges MCP tools; provider selection (LM Studio, cloud, Ollama)
- `app/api/chat-proxy/route.ts` — proxy with cookie/default resolution
- `app/api/mcp-events/route.ts` — SSE endpoint for MCP events

**PTY bridge**
- `mcp/pty-server.mjs` — Node WS/HTTP server bridging Apple container TTY to xterm.js

**MCP servers (Host STDIO wrappers)**
- `mcp/mcp-shell-exec.mjs` — run non‑interactive commands **in the VM**
- `mcp/mcp-web-snap.mjs` — Playwright‑powered web automation **in the VM**
- *(Optional)* `mcp/mcp-shell-session.mjs` — tmux‑style interactive sessions

**Styles**
- `app/globals.css` — height/layout fixes; `chat-viewport` adjustments

---

## Fork Status & Credits

This repository is a **fork** that **extends** the original `coderunner-ui` to support:

- LM Studio on Apple Silicon via MLX (fast local inference)
- Real TTY terminal (xterm.js + Apple Container VM)
- MCP Events panel (SSE)
- Playwright web automation inside the VM
- Hardened MCP tools (filesystem, shell exec, terminal control)

**Credits** to the original `coderunner-ui` maintainers for the base project.

---

## License

MIT
