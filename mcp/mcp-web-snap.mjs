#!/usr/bin/env node
// MCP server: web.screenshot / web.html via Playwright in the VM

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

/** Robustly load schemas across SDK layouts */
async function loadToolSchemas() {
  const candidates = [
    "@modelcontextprotocol/sdk/types.js",
    "@modelcontextprotocol/sdk/dist/esm/types.js",
    "@modelcontextprotocol/sdk/mcp.js",
    "@modelcontextprotocol/sdk/dist/esm/mcp.js",
  ];
  for (const p of candidates) {
    try {
      const m = await import(p);
      const List = m.ListToolsRequestSchema || m.ToolsListRequestSchema;
      const Call = m.CallToolRequestSchema || m.ToolsCallRequestSchema;
      if (List && Call) return { ListToolsRequestSchema: List, CallToolRequestSchema: Call };
    } catch {}
  }
  throw new Error("[mcp-web-snap] Could not locate tool schemas in @modelcontextprotocol/sdk");
}

/** Resolve EXEC_WRAPPER on host */
function resolveExecWrapper() {
  if (process.env.MCP_SHELL_EXEC_WRAPPER) {
    const parts = process.env.MCP_SHELL_EXEC_WRAPPER.split(" ").filter(Boolean);
    if (parts.length) return parts;
  }
  const probe = spawnSync("bash", ["-lc", "command -v container"], { encoding: "utf8" });
  const found = (probe.stdout || "").trim();
  if (found) return [found, "exec", "coderunner", "bash", "-lc"];
  const candidates = ["/opt/homebrew/bin/container", "/usr/local/bin/container"];
  for (const p of candidates) {
    if (existsSync(p)) return [p, "exec", "coderunner", "bash", "-lc"];
  }
  return ["container", "exec", "coderunner", "bash", "-lc"];
}

const EXEC_WRAPPER = resolveExecWrapper();
console.log("[mcp-web-snap] EXEC_WRAPPER:", EXEC_WRAPPER.join(" "));

/**
 * Run a command INSIDE the VM.
 * hostCwd: working dir on host (safe default = process.cwd()).
 * workdir: working dir INSIDE container (default /app).
 */
function shell(cmd, timeoutMs = 180_000, workdir = "/app", hostCwd = process.cwd()) {
  return new Promise((resolve) => {
    const wrappedCmd = `cd ${workdir} && ${cmd}`;
    const full = [...EXEC_WRAPPER, wrappedCmd];

    const child = spawn(full[0], full.slice(1), {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: hostCwd,      // ✅ host cwd only
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright",
        NODE_OPTIONS: "--dns-result-order=ipv4first",
      },
    });

    let out = "", err = ""; let timedOut = false;
    const t = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", (code) => { clearTimeout(t); resolve({ code, stdout: out, stderr: err, timedOut }); });
  });
}

async function ensurePlaywright() {
  await shell(`npx -y playwright@1.47.2 install chromium >/dev/null 2>&1 || true`, 120_000);
}

const toolDefs = {
  "web.screenshot": {
    description: "Full-page screenshot via Playwright in the VM. Saves to /app/uploads/<file>.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        out: { type: "string", default: "/app/uploads/snap.png" },
        width: { type: "number", default: 1280 },
        height: { type: "number", default: 1600 },
        timeoutMs: { type: "number", default: 90000 },
        waitMs: { type: "number", default: 3000 },
        workdir: { type: "string", default: "/app" },
      },
      required: ["url"],
    },
    handler: async ({ url, out = "/app/uploads/snap.png", width = 1280, height = 1600, timeoutMs = 90000, waitMs = 3000, workdir = "/app" }) => {
      await ensurePlaywright();
      const cmd = [
        `mkdir -p /app/uploads`,
        `npx -y playwright@1.47.2 screenshot "${url}" "${out}"`,
        `  --full-page --viewport-size=${width},${height} --wait-for-timeout=${waitMs} --timeout=${timeoutMs} --ignore-https-errors`,
        `ls -lh "${out}"`,
      ].join(" && ");
      const res = await shell(cmd, timeoutMs + 30_000, workdir);
      const ok = res.code === 0 && !res.timedOut;
      const text = ok
        ? `✅ Saved: ${out}\nPublic: /assets/${out.split("/").pop()}`
        : `❌ web.screenshot failed\n${res.stderr || res.stdout}`;
      return { content: [{ type: "text", text }], isError: !ok };
    },
  },

  "web.html": {
    description: "Fetch rendered HTML (after JS) via Playwright and return it as text.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        timeoutMs: { type: "number", default: 90000 },
        waitMs: { type: "number", default: 2500 },
        workdir: { type: "string", default: "/app" },
      },
      required: ["url"],
    },
    handler: async ({ url, timeoutMs = 90000, waitMs = 2500, workdir = "/app" }) => {
      await ensurePlaywright();
      const nodeScript = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox","--disable-dev-shm-usage"] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await page.goto(${JSON.stringify(url)}, { waitUntil: "networkidle", timeout: ${timeoutMs} });
  await page.waitForTimeout(${waitMs});
  const html = await page.evaluate(() => document.documentElement.outerHTML);
  console.log(html);
  await browser.close();
})();`.trim();

      const res = await shell(`node -e ${JSON.stringify(nodeScript)}`, timeoutMs + 20_000, workdir);
      const ok = res.code === 0 && !res.timedOut && res.stdout.trim().length;
      const text = ok ? res.stdout : `❌ web.html failed\n${res.stderr || res.stdout}`;
      return { content: [{ type: "text", text }], isError: !ok };
    },
  },
};

const server = new Server(
  { name: "mcp-web-snap", version: "0.3.1" },
  { capabilities: { tools: {} } },
);

const { ListToolsRequestSchema, CallToolRequestSchema } = await loadToolSchemas();

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.entries(toolDefs).map(([name, t]) => ({
    name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  try {
    const name = req?.params?.name;
    const args = req?.params?.arguments || {};
    const t = toolDefs[name];
    if (!t) {
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
    return await t.handler(args);
  } catch (e) {
    return { content: [{ type: "text", text: `web tool error: ${String(e)}` }], isError: true };
  }
});

await server.connect(new StdioServerTransport());
