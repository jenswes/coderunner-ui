// mcp/pty-server.mjs
// PTY bridge for Apple `container` CLI → WebSocket + HTTP.
// - POST /input { data }  → write to PTY stdin (commands/keystrokes)
// - POST /write { data }  → broadcast text to UI (display-only HUD)
// - WS /pty               → bi-directional PTY stream

import http from "http";
import os from "os";
import process from "process";
import { WebSocketServer } from "ws";
import pty from "node-pty";

const HOST = process.env.PTY_HOST || "127.0.0.1";
const PORT = Number(process.env.PTY_PORT || 3030);

const CONTAINER_BIN = process.env.CONTAINER_BIN || "container";
const ARGS_PRIMARY = (process.env.PTY_CONTAINER_ARGS || "exec --interactive --tty coderunner bash -l")
  .split(" ")
  .filter(Boolean);
const ARGS_FALLBACK = (process.env.PTY_CONTAINER_ARGS_FALLBACK || "exec --tty coderunner bash -l")
  .split(" ")
  .filter(Boolean);

function infoPage() {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8"/><title>PTY server</title></head>
  <body>
    <h1>PTY server</h1>
    <p>WS endpoint: <code>ws://${HOST}:${PORT}/pty</code></p>
    <p>Write to PTY stdin: <code>POST http://${HOST}:${PORT}/input {"data":"...\\n"}</code></p>
    <p>Display-only feed: <code>POST http://${HOST}:${PORT}/write {"data":"..."}</code></p>
  </body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    return void res.end("Bad request");
  }

  if (req.method === "GET" && req.url === "/") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return void res.end(infoPage());
  }

  // read JSON helper
  const readJson = async () => {
    let body = "";
    for await (const chunk of req) body += chunk;
    return JSON.parse(body || "{}");
  };

  // true stdin endpoint
  if (req.method === "POST" && req.url === "/input") {
    try {
      const { data } = await readJson();
      if (!currentPty) {
        res.statusCode = 503;
        return void res.end(JSON.stringify({ ok: false, error: "no PTY" }));
      }
      const text = typeof data === "string" ? data : "";
      currentPty.write(text);
      res.setHeader("Content-Type", "application/json");
      return void res.end(JSON.stringify({ ok: true, bytes: Buffer.byteLength(text, "utf8") }));
    } catch (e) {
      res.statusCode = 400;
      return void res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }));
    }
  }

  // display-only feed
  if (req.method === "POST" && req.url === "/write") {
    try {
      const { data } = await readJson();
      const text = typeof data === "string" ? data : "";
      broadcast(text);
      res.setHeader("Content-Type", "application/json");
      return void res.end(JSON.stringify({ ok: true, bytes: Buffer.byteLength(text, "utf8") }));
    } catch (e) {
      res.statusCode = 400;
      return void res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }));
    }
  }

  res.statusCode = 404;
  res.end("Not found");
});

const wss = new WebSocketServer({ noServer: true, path: "/pty" });

let currentPty = null;
let clients = new Set();

function startPty(bin, args, label) {
  console.log("[pty] starting:", bin, args.join(" "));
  const p = pty.spawn(bin, args, {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: process.env.HOME || os.homedir(),
    env: process.env,
  });

  p.onData((data) => {
    const buf = Buffer.from(data, "utf8");
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) ws.send(buf, { binary: true });
    }
  });

  p.onExit(({ exitCode, signal }) => {
    console.log("[pty] child exit:", { code: exitCode, signal });
    currentPty = null;
    for (const ws of clients) {
      try { ws.close(1000, "shell-exit"); } catch {}
    }
    clients.clear();
    if (label === "primary" && exitCode === 1) {
      console.warn("[pty] primary PTY exited with code 1");
    }
  });

  return p;
}

server.on("upgrade", (req, socket, head) => {
  if (!req.url || !req.url.startsWith("/pty")) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

wss.on("connection", (ws) => {
  clients.add(ws);

  if (!currentPty) {
    console.log("[pty] container bin:", CONTAINER_BIN);
    console.log("[pty] args (primary):", ARGS_PRIMARY.join(" "));
    currentPty = startPty(CONTAINER_BIN, ARGS_PRIMARY, "primary");
    setTimeout(() => {
      if (!currentPty) {
        console.log("[pty] args (fallback):", ARGS_FALLBACK.join(" "));
        currentPty = startPty(CONTAINER_BIN, ARGS_FALLBACK, "fallback");
      }
    }, 250);
  }

  ws.on("message", (data, isBinary) => {
    if (!currentPty) return;
    try {
      if (!isBinary && typeof data === "string") {
        // JSON controls from client (resize / input)
        if (data.startsWith("{")) {
          const msg = JSON.parse(data);
          if (msg?.type === "resize") {
            const cols = Number(msg.cols || 80);
            const rows = Number(msg.rows || 24);
            if (Number.isFinite(cols) && Number.isFinite(rows)) currentPty.resize(cols, rows);
            return;
          }
          if (msg?.type === "input" && typeof msg.data === "string") {
            currentPty.write(msg.data);
            return;
          }
        }
        // raw text → PTY
        currentPty.write(data);
        return;
      }

      // Binary path: try JSON first
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (buf.length && buf[0] === 123 /* '{' */) {
        try {
          const s = buf.toString("utf8");
          const msg = JSON.parse(s);
          if (msg?.type === "resize") {
            const cols = Number(msg.cols || 80);
            const rows = Number(msg.rows || 24);
            if (Number.isFinite(cols) && Number.isFinite(rows)) currentPty.resize(cols, rows);
            return;
          }
          if (msg?.type === "input" && typeof msg.data === "string") {
            currentPty.write(msg.data);
            return;
          }
        } catch {
          // fall through
        }
      }
      currentPty.write(buf.toString("utf8"));
    } catch (e) {
      console.warn("[pty] onmessage error:", e);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
  });
});

function broadcast(text) {
  const buf = Buffer.from(String(text), "utf8");
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(buf, { binary: true });
  }
}

server.listen(PORT, HOST, () => {
  console.log(`[pty] [pty-server] listening on http://${HOST}:${PORT}`);
});
