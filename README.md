<img src="videoeditcoderunner.jpeg" alt="Video Edit Code Runner" width="500">

# Manual install & LM Studio integration (for `coderunner-ui`)

This fork adds **LM Studio (OpenAI-compatible) support**, a **model selector** in the UI, and a hardened **MCP** setup for local tools. No cloud is required.

**The MLX support in LM Studio is the best available for now, that is why i did this**
MLX is around 30% faster than gguf

> Privacy by design. No remote code execution. Your machine, your data.

** only LM Studio is tested for now **
---

## ✅ What’s included

- **LM Studio provider**: use any local model served by LM Studio via the OpenAI-compatible API (`/v1`).
- **Model Selector (UI)**: pick your model at the top of the app; status pill shows **loaded / not-loaded**.
- **Cookie-based default**: your chosen model is saved and used by the backend automatically.
- **Backends supported**:
  - `lmstudio/<model-id>` (local, no API key needed)
  - `ollama/*` (local, no API key needed)
  - `openai/*`, `anthropic/*`, `google_genai/*` (set keys if you use them)
- **MCP tooling**:
  - Filesystem MCP via a local binary (Go or Node variant).
  - (Optional) External MCP runtime endpoints can be configured via env.

---

## 🧩 Prerequisites

- macOS on Apple Silicon
- Node.js 20+ and npm
- LM Studio installed (https://lmstudio.ai)
- Go (only if you use the Go variant of the MCP filesystem server)

---

## 🚀 Manual Setup

### 1) Install dependencies

    npm ci

### 2) Start LM Studio (OpenAI-compatible server)

    # Default port is 1234 here
    lms server start --port 1234

List models to confirm what’s available:

    # Show all model IDs LM Studio can serve
    curl -sS http://localhost:1234/v1/models | jq -r '.data[].id'

Optional quick sanity chat:

    curl -sS http://localhost:1234/v1/chat/completions \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer lmstudio-local" \
      -d '{
        "model":"mistralai/mistral-small-3.2",
        "messages":[{"role":"user","content":"Say hi in one sentence"}]
      }' | jq -r '.choices[0].message.content'

### 3) MCP Filesystem server (required for local file tools)

Go variant (recommended):

    GO111MODULE=on go install github.com/mark3labs/mcp-filesystem-server@latest
    # Typical path: ~/go/bin/mcp-filesystem-server

Node variant (alternative, untested):

    npm i -D @modelcontextprotocol/server-filesystem
    # Binary path: ./node_modules/.bin/mcp-filesystem

### 4) Environment configuration

Create `.env.local` in the project root (adjust paths and usernames):

    # --- Cloud LLMs (only if you use them) ---
    OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    # ANTHROPIC_API_KEY=...
    # GOOGLE_GENAI_API_KEY=...  # (or GOOGLE_GENERATIVE_AI_API_KEY / GOOGLE_API_KEY)

    # --- LM Studio (OpenAI-compatible endpoint) ---
    NEXT_PUBLIC_LMS_API_BASE=http://localhost:1234/v1
    NEXT_PUBLIC_LMS_API_KEY=lmstudio-local   # placeholder; LM Studio accepts any string

    # Default model if no cookie/header present (recommended to use an LM Studio model)
    DEFAULT_SELECTED_MODEL=lmstudio/mistralai/mistral-small-3.2

    # --- MCP Filesystem server (choose ONE of the following) ---

    # If you installed the Go binary (recommended):
    MCP_FILESYSTEM_CMD=/Users/<you>/go/bin/mcp-filesystem-server

    # If you installed the Node binary instead:
    # MCP_FILESYSTEM_CMD=/Users/<you>/src/coderunner-ui/node_modules/.bin/mcp-filesystem

    # Project-side public assets directory (referenced by the filesystem MCP)
    MCP_FS_ASSETS_DIR=/Users/<you>/src/coderunner-ui/public/assets

    # --- Optional external MCP runtime endpoint (if you run one) ---
    # EXTERNAL_MCP_URL=http://<your-runtime-ip>:<port>/mcp

Ensure these directories exist:

    mkdir -p ~/.coderunner/assets
    mkdir -p /Users/<you>/src/coderunner-ui/public/assets

### 5) Start the app

    npm run dev
    # open http://localhost:3000

At the top of the page you’ll see the **Model Selector**. Pick a local model (e.g., `mistralai/mistral-small-3.2`). The choice is stored in a cookie (`selectedModel`) and used by the backend for all chats.

---

## 🗂 How the pieces fit

- **UI Model Selector**
  - Fetches available LM Studio models from `/api/models`
  - Shows a live **status pill** for the selected model using `/api/model-state`
  - Writes a `selectedModel` cookie

- **Chat backend** (`/api/chat`)
  - Resolves the model in this order: **Cookie** → `X-Selected-Model` header → `DEFAULT_SELECTED_MODEL` → fallback
  - Accepts no API key for `lmstudio/*` and `ollama/*`
  - Uses MCP tools (filesystem MCP and, if configured, any external MCP endpoint)

- **Chat proxy** (`/api/chat-proxy`)
  - Forwards requests from the UI, picking the model from **Cookie** → `?model` → env default
  - Streams responses back to the client

---

## 🔧 Files added/changed in this fork

- UI
  - `components/ModelSelector.tsx` — model dropdown + status pill + cookie integration
  - `app/page.tsx` — sticky top bar for the selector; padding for the chat area

- APIs
  - `app/api/models/route.ts` — lists LM Studio models (server-side, no CORS issues)
  - `app/api/model-state/route.ts` — returns loaded/not-loaded state for the selected model
  - `app/api/chat/route.ts` — LM Studio provider; cookie fallback; robust MCP init
  - `app/api/chat-proxy/route.ts` — cookie/default model resolution; streams responses

- Types (optional)
  - `types.ts` — added `| \`lmstudio/${string}\`` to `ModelOptions` union, plus helpers

- Helpers (optional/future)
  - `lib/lmsClient.ts`, `lib/lmsChat.ts`, `lib/lmsModels.ts` — OpenAI-compatible client + model utilities

---

## 🧪 Sanity checks

LM Studio models:

    curl -sS http://localhost:1234/v1/models | jq -r '.data[].id'

App (LM Studio through the backend):

    curl -N http://localhost:3000/api/chat \
      -H 'Content-Type: application/json' \
      -H 'X-Selected-Model: lmstudio/mistralai/mistral-small-3.2' \
      -H 'X-API-Key: lmstudio-local' \
      -d '{
        "messages":[{"role":"user","content":"Say hi in one sentence"}],
        "system":"You are a helpful assistant.",
        "tools": {}
      }'

---

## 🛠 Troubleshooting

- **“Missing API-Key”**
  - Pick an `lmstudio/*` (or `ollama/*`) model in the selector, or set `DEFAULT_SELECTED_MODEL` to an LM Studio model. Cloud models require real API keys.

- **Filesystem MCP errors / ENOENT**
  - Set `MCP_FILESYSTEM_CMD` to the absolute path of your chosen binary (Go or Node variant) in `.env.local`.

- **Model not loaded**
  - LM Studio can JIT-load on first request (if enabled). The status pill will switch to **loaded** after a successful call.

- **UI layout/scroll**
  - The selector bar is sticky. If your sidebar width differs, adjust the left padding (e.g., `lg:pl-64`) in `app/page.tsx`.

---

## 🔐 Privacy

- The app runs locally.
- API keys (when entered in the UI) are stored locally in your browser.
- No remote code execution: code runs only via your local tools/runtimes you configure.

## ToDo

- some cosmetic changes
- testing
