// mcp/mcp-shell-session.mjs
// Minimal MCP (JSON-RPC over stdio) server for interactive shell sessions via tmux inside the container.
//
// Env:
//   MCP_SHELL_EXEC_WRAPPER  default: "/usr/local/bin/container exec coderunner bash -lc"
//     -> your wrapper to run inside the Apple container VM
//
// Requires: tmux inside the container; we try to apt-get install on first use if missing.

import { spawn, exec as execCb } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execCb);

/* --------------------------- MCP framing (LSP-like) --------------------------- */

let buf = Buffer.alloc(0);

process.stdin.on("data", (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  while (true) {
    const headerEnd = buf.indexOf("\r\n\r\n");
    if (headerEnd === -1) break;
    const header = buf.slice(0, headerEnd).toString("utf8");
    const m = header.match(/Content-Length:\s*(\d+)/i);
    if (!m) {
      // drop garbage header
      buf = buf.slice(headerEnd + 4);
      continue;
    }
    const len = parseInt(m[1], 10);
    const total = headerEnd + 4 + len;
    if (buf.length < total) break;
    const body = buf.slice(headerEnd + 4, total).toString("utf8");
    buf = buf.slice(total);
    try {
      const msg = JSON.parse(body);
      handleMessage(msg);
    } catch (e) {
      // ignore parse errors
    }
  }
});

function send(msg) {
  const body = Buffer.from(JSON.stringify(msg), "utf8");
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8");
  process.stdout.write(header);
  process.stdout.write(body);
}

/* --------------------------------- Helpers ---------------------------------- */

const WRAP = process.env.MCP_SHELL_EXEC_WRAPPER ||
             "/usr/local/bin/container exec coderunner bash -lc";

// Basic shell single-quote escape
function shq(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

// Run a command inside the container via wrapper
async function runInContainer(cmd, opts = {}) {
  const full = `${WRAP} ${shq(cmd)}`;
  return exec(full, { maxBuffer: 10 * 1024 * 1024, ...opts });
}

let ensuredTmux = false;
async function ensureTmux() {
  if (ensuredTmux) return;
  try {
    await runInContainer("tmux -V");
  } catch {
    await runInContainer("apt-get update -y && apt-get install -y tmux");
  }
  ensuredTmux = true;
}

// Generate a simple id
function rid() {
  return Math.random().toString(36).slice(2, 10);
}

/* ------------------------------- Tool logic --------------------------------- */

// shell.open  -> { sessionId, name }
async function t_open(args = {}) {
  await ensureTmux();
  const name = args.name && String(args.name).trim() ? args.name : `sess_${rid()}`;
  // create detached session if not exists
  await runInContainer(`tmux has-session -t ${shq(name)} 2>/dev/null || tmux new-session -d -s ${shq(name)}`);
  return { sessionId: name, name };
}

// shell.send -> { ok: true }
async function t_send(args = {}) {
  const { sessionId, text, keys } = args;
  if (!sessionId) throw new Error("sessionId required");

  // send text
  if (typeof text === "string" && text.length) {
    // send as literal then Enter
    await runInContainer(`tmux send-keys -t ${shq(sessionId)} -- ${shq(text)}`);
  }
  // send key chords (e.g., ["C-c", "C-m"])
  if (Array.isArray(keys) && keys.length) {
    const parts = keys.map(k => shq(k)).join(" ");
    await runInContainer(`tmux send-keys -t ${shq(sessionId)} ${parts}`);
  }
  return { ok: true };
}

// shell.read -> { output }
async function t_read(args = {}) {
  const { sessionId, lines } = args;
  if (!sessionId) throw new Error("sessionId required");
  const n = Math.max(1, Math.min(5000, Number(lines) || 1000));
  const { stdout } = await runInContainer(`tmux capture-pane -t ${shq(sessionId)} -p -S -${n} -E -1`);
  return { output: stdout };
}

// shell.close -> { ok: true }
async function t_close(args = {}) {
  const { sessionId } = args;
  if (!sessionId) throw new Error("sessionId required");
  await runInContainer(`tmux kill-session -t ${shq(sessionId)}`);
  return { ok: true };
}

/* ------------------------------- MCP protocol ------------------------------- */

const TOOL_DEFS = [
  {
    name: "shell.open",
    description: "Open (or reuse) a tmux session inside the container.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Optional session name." }
      }
    }
  },
  {
    name: "shell.send",
    description: "Send text and/or key chords to the tmux session (e.g. keys: ['C-c','C-m']).",
    inputSchema: {
      type: "object",
      required: ["sessionId"],
      properties: {
        sessionId: { type: "string" },
        text: { type: "string" },
        keys: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "shell.read",
    description: "Read the last N lines from the tmux session pane.",
    inputSchema: {
      type: "object",
      required: ["sessionId"],
      properties: {
        sessionId: { type: "string" },
        lines: { type: "number", description: "How many lines from bottom (default 1000)." }
      }
    }
  },
  {
    name: "shell.close",
    description: "Kill the tmux session.",
    inputSchema: {
      type: "object",
      required: ["sessionId"],
      properties: {
        sessionId: { type: "string" }
      }
    }
  }
];

async function handleMessage(msg) {
  if (msg?.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "mcp-shell-session", version: "0.1.0" }
      }
    });
    return;
  }

  if (msg?.method === "tools/list") {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: { tools: TOOL_DEFS }
    });
    return;
  }

  if (msg?.method === "tools/call") {
    const { name, arguments: args } = msg.params || {};
    try {
      let res;
      switch (name) {
        case "shell.open":  res = await t_open(args);  break;
        case "shell.send":  res = await t_send(args);  break;
        case "shell.read":  res = await t_read(args);  break;
        case "shell.close": res = await t_close(args); break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
      send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: JSON.stringify(res) }] } });
    } catch (e) {
      send({
        jsonrpc: "2.0",
        id: msg.id,
        error: { code: -32000, message: e?.message || String(e) }
      });
    }
    return;
  }

  // Acknowledge other methods to be polite
  if (typeof msg?.id !== "undefined") {
    send({ jsonrpc: "2.0", id: msg.id, result: null });
  }
}

