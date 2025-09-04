// app/api/chat/route.ts
import { cookies } from "next/headers";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOllama } from "ollama-ai-provider";

import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { streamText, tool } from "ai";
import { z } from "zod";

import { experimental_createMCPClient as createMCPClient } from "ai";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";
import { Experimental_StdioMCPTransport } from "ai/mcp-stdio";

import { join } from "path";
import os from "os";

export const runtime = "nodejs";
export const maxDuration = 30;

/* ----------------------------- MCP helpers ----------------------------- */

function resolveFilesystemCmd(): string {
  if (process.env.MCP_FILESYSTEM_CMD) return process.env.MCP_FILESYSTEM_CMD;

  const goBin = `${process.env.HOME || os.homedir()}/go/bin/mcp-filesystem-server`;
  const nodeBin =
    process.platform === "win32"
      ? join(process.cwd(), "node_modules/.bin/mcp-filesystem.cmd")
      : join(process.cwd(), "node_modules/.bin/mcp-filesystem");

  return process.env.MCP_PREFER_NODE_BIN === "1" ? nodeBin : goBin;
}

async function getFilesystemMcpTools() {
  try {
    const transport = new Experimental_StdioMCPTransport({
      command: resolveFilesystemCmd(),
      args: [
        process.env.MCP_FS_ASSETS_DIR || join(process.cwd(), "public/assets"),
        join(os.homedir(), ".coderunner/assets"),
      ],
    });

    const client = await createMCPClient({ transport });
    return await client.tools();
  } catch (err) {
    console.warn("[MCP] filesystem disabled (cannot start):", err);
    return {};
  }
}

async function getCoderunnerMcpTools() {
  try {
    const CODERUNNER_MCP_URL =
      process.env.CODERUNNER_MCP_URL ||
      process.env.NEXT_PUBLIC_CODERUNNER_MCP_URL ||
      "http://localhost:8222/mcp";

    const url = new URL(CODERUNNER_MCP_URL);
    const client = await createMCPClient({
      transport: new StreamableHTTPClientTransport(url, {}),
    });

    console.log("[MCP] coderunner connected:", CODERUNNER_MCP_URL);
    return await client.tools();
  } catch (err) {
    console.warn("[MCP] coderunner disabled (cannot connect):", err);
    return {};
  }
}

async function getStdioMcpToolsFromCmd(
  name: string,
  cmdEnv: string,
  argsEnv: string,
  defaultCmd: string,
  defaultArgs: string
) {
  try {
    const command = process.env[cmdEnv] || defaultCmd;
    const args = (process.env[argsEnv] || defaultArgs).split(" ");
    const transport = new Experimental_StdioMCPTransport({ command, args });
    const client = await createMCPClient({ transport });
    console.log(`[MCP] ${name} connected:`, command, args.join(" "));
    return await client.tools();
  } catch (err) {
    console.warn(`[MCP] ${name} disabled:`, err);
    return {};
  }
}

async function getShellExecMcpTools() {
  if (process.env.MCP_SHELL_DISABLE === "1") return {};
  return getStdioMcpToolsFromCmd(
    "shell-exec",
    "MCP_SHELL_CMD",
    "MCP_SHELL_ARGS",
    "node",
    "mcp/mcp-shell-exec.mjs"
  );
}

async function getWebSnapMcpTools() {
  if (process.env.MCP_WEB_SNAP_DISABLE === "1") return {};
  return getStdioMcpToolsFromCmd(
    "web-snap",
    "MCP_WEB_SNAP_CMD",
    "MCP_WEB_SNAP_ARGS",
    "node",
    "mcp/mcp-web-snap.mjs"
  );
}

/* ----------------------- Terminal (PTY) helper tools -------------------- */

// Key map for common xterm sequences and control keys
const KEYMAP: Record<string, string> = {
  ESC: "\x1b",
  ENTER: "\n",
  "CTRL-C": "\x03",
  "^C": "\x03",
  TAB: "\t",
  BACKSPACE: "\x08",

  LEFT: "\x1b[D",
  RIGHT: "\x1b[C",
  UP: "\x1b[A",
  DOWN: "\x1b[B",
  HOME: "\x1b[H",
  END: "\x1b[F",
  PGUP: "\x1b[5~",
  PGDN: "\x1b[6~",

  F1: "\x1bOP",
  F2: "\x1bOQ",
  F3: "\x1bOR",
  F4: "\x1bOS",
  F5: "\x1b[15~",
  F6: "\x1b[17~",
  F7: "\x1b[18~",
  F8: "\x1b[19~",
  F9: "\x1b[20~",
  F10: "\x1b[21~",
  F11: "\x1b[23~",
  F12: "\x1b[24~",
};

function decodeUserEscapes(input: string): string {
  let s = input;

  // literal \xHH
  s = s.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hh) =>
    String.fromCharCode(parseInt(hh, 16))
  );
  // literal \uHHHH
  s = s.replace(/\\u([0-9A-Fa-f]{4})/g, (_, u) =>
    String.fromCharCode(parseInt(u, 16))
  );
  // \e -> ESC
  s = s.replace(/\\e/g, "\x1b");
  // common text escapes if given literally
  s = s.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\b/g, "\b").replace(/\\f/g, "\f");

  return s;
}

// Replace <TOKEN> occurrences and standalone tokens (e.g. "F10") with real sequences
function encodeKeys(input: string): string {
  let s = decodeUserEscapes(input);

  // angle-bracket tokens: <F10><LEFT> etc.
  s = s.replace(/<([A-Za-z0-9\-+]+)>/g, (_, raw) => {
    const key = raw.toUpperCase();
    if (KEYMAP[key]) return KEYMAP[key];
    if (key === "CTRL-C" || key === "CTRL+C") return KEYMAP["CTRL-C"];
    if (key === "ESCAPE") return KEYMAP["ESC"];
    return `<${raw}>`; // leave untouched if unknown
  });

  // if the whole string is a known token (e.g., "F10", "ctrl-c")
  const trimmed = s.trim();
  const upper = trimmed.toUpperCase();
  if (trimmed.length === upper.length || /^ctrl-?c$/i.test(trimmed) || /^f\d{1,2}$/i.test(trimmed)) {
    if (KEYMAP[upper]) return KEYMAP[upper];
    if (/^ctrl-?c$/i.test(trimmed)) return KEYMAP["CTRL-C"];
  }

  return s;
}

function getTerminalTools() {
  // Support both endpoints: /input (new) and /write (legacy)
  const INPUT_CANDIDATES = [
    process.env.PTY_INPUT_URL,
    process.env.PTY_FEED_URL, // legacy var
    "http://localhost:3030/input",
    "http://localhost:3030/write",
  ].filter(Boolean) as string[];

  async function postToFirstHealthy(urls: string[], payload: unknown): Promise<void> {
    let lastErr: unknown;
    for (const url of urls) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.ok) return;
        lastErr = new Error(`HTTP ${r.status} ${await r.text()}`);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr ?? new Error("No PTY input endpoint reachable");
  }

  const writeTool = tool({
    description:
      "Type raw text/keystrokes into the real terminal (PTY). Include '\\n' for Enter. Supports symbolic keys like <F10>, <LEFT>, ctrl-c.",
    parameters: z.object({
      text: z.string().describe("What to type. Supports tokens like '<F10>' or 'ctrl-c'."),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async ({ text }: any) => {
      const payload = encodeKeys(text);
      await postToFirstHealthy(INPUT_CANDIDATES, { data: payload });
      return "ok";
    },
  });

  const runInteractiveTool = tool({
    description:
      "Run an interactive command in the real terminal, wait, then send a quit sequence (e.g. F10, q, ctrl-c).",
    parameters: z.object({
      command: z.string(),
      durationMs: z.number().int().positive().max(120000),
      quit: z.string().default("q").describe("e.g. 'q', 'F10', 'ctrl-c', '\\u001b[21~', or ''"),
      sendEnterAfterCommand: z.boolean().default(true),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async ({ command, durationMs, quit, sendEnterAfterCommand }: any) => {
      const start = command + (sendEnterAfterCommand ? "\n" : "");
      await postToFirstHealthy(INPUT_CANDIDATES, { data: start });
      await new Promise((r) => setTimeout(r, durationMs));
      const q = encodeKeys(quit);
      if (q) await postToFirstHealthy(INPUT_CANDIDATES, { data: q });
      return `Ran '${command}' for ${durationMs}ms${q ? " and sent quit." : "."}`;
    },
  });

  // Playlist with write + (interactive|runInteractive) steps
  const writeStepSchema = z.object({
    type: z.literal("write"),
    text: z.string(),
  });

  const interactiveStepSchema = z.object({
    type: z.union([z.literal("interactive"), z.literal("runInteractive")]),
    command: z.string(),
    durationMs: z.number().int().positive().max(120000),
    quit: z.string().optional(),
    quitSequence: z.string().optional(),
    sendEnterAfterCommand: z.boolean().optional(),
  });

  const playlistSchema = z.object({
    steps: z.array(z.union([writeStepSchema, interactiveStepSchema])),
    force: z.boolean().default(false),
  });

  const playlistTool = tool({
    description:
      "Execute a sequence of terminal actions. Steps: {type:'write', text} or {type:'interactive'|'runInteractive', command, durationMs, quit}. Supports symbolic keys and <TOKENS>.",
    parameters: playlistSchema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async ({ steps, force }: any) => {
      type N =
        | { kind: "write"; text: string }
        | { kind: "interactive"; command: string; durationMs: number; quit: string; sendEnter: boolean };

      const normalized: N[] = [];
      for (const s of steps) {
        if (s.type === "write") {
          normalized.push({ kind: "write", text: encodeKeys(s.text) });
        } else {
          const quitRaw = s.quit ?? s.quitSequence ?? "q";
          normalized.push({
            kind: "interactive",
            command: s.command,
            durationMs: s.durationMs,
            quit: encodeKeys(quitRaw),
            sendEnter: s.sendEnterAfterCommand ?? true,
          });
        }
      }

      if (!force) {
        const deduped: N[] = [];
        let lastKey = "";
        for (const n of normalized) {
          const key =
            n.kind === "write"
              ? `w:${n.text}`
              : `i:${n.command}|${n.durationMs}|${n.quit}|${n.sendEnter ? 1 : 0}`;
          if (key !== lastKey) deduped.push(n);
          lastKey = key;
        }
        normalized.splice(0, normalized.length, ...deduped);
      }

      for (const n of normalized) {
        if (n.kind === "write") {
          await postToFirstHealthy(INPUT_CANDIDATES, { data: n.text });
        } else {
          await postToFirstHealthy(INPUT_CANDIDATES, {
            data: n.command + (n.sendEnter ? "\n" : ""),
          });
          await new Promise((r) => setTimeout(r, n.durationMs));
          if (n.quit) await postToFirstHealthy(INPUT_CANDIDATES, { data: n.quit });
        }
      }
      return `Executed ${normalized.length} step(s).`;
    },
  });

  // Macro/timeline: launch command, then time-based key injections
  const macroTool = tool({
    description:
      "Run a command and then send timed key presses. Keys support symbols like <F10>, <LEFT>, ctrl-c or escapes (\\u001b...).",
    parameters: z.object({
      command: z.string().describe("Program to run, e.g. 'mc'"),
      sendEnterAfterCommand: z.boolean().default(true),
      actions: z
        .array(
          z.object({
            afterMs: z.number().int().nonnegative().max(120000),
            keys: z.string().describe("Keys to send at that time (supports <F10>, <LEFT>, etc.)"),
          })
        )
        .describe("Timeline of key injections"),
      finalQuit: z.string().default("").describe("Optional final quit key (e.g. F10, ctrl-c)."),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async ({ command, sendEnterAfterCommand, actions, finalQuit }: any) => {
      await postToFirstHealthy(INPUT_CANDIDATES, {
        data: command + (sendEnterAfterCommand ? "\n" : ""),
      });
      let elapsed = 0;
      for (const { afterMs, keys } of actions) {
        const wait = Math.max(0, afterMs - elapsed);
        if (wait) await new Promise((r) => setTimeout(r, wait));
        elapsed = afterMs;
        await postToFirstHealthy(INPUT_CANDIDATES, { data: encodeKeys(keys) });
      }
      const q = encodeKeys(finalQuit || "");
      if (q) await postToFirstHealthy(INPUT_CANDIDATES, { data: q });
      return "macro done";
    },
  });

  return {
    "terminal.write": writeTool,
    "terminal.runInteractive": runInteractiveTool,
    "terminal.playlist": playlistTool,
    "terminal.sequence": macroTool,
  } as const;
}

/* ------------------------- Model provider switch ------------------------ */

function selectModelProvider(model: string, apiKey: string) {
  if (model.startsWith("lmstudio/")) {
    const baseURL =
      process.env.LMS_API_BASE ||
      process.env.NEXT_PUBLIC_LMS_API_BASE ||
      "http://localhost:1234/v1";
    const key = apiKey || process.env.LMS_API_KEY || "lmstudio";
    const lmstudio = createOpenAI({ apiKey: key, baseURL });
    const bareModel = model.slice("lmstudio/".length);
    return lmstudio(bareModel);
  }

  switch (model) {
    case "ollama/deepseek-r1:32b": {
      const p = createOllama({});
      return p("deepseek-r1:32b", { simulateStreaming: true });
    }
    case "ollama/deepseek-r1:8b": {
      const p = createOllama({});
      return p("deepseek-r1:8b", { simulateStreaming: true });
    }
    case "ollama/qwen3": {
      const p = createOllama({});
      return p("qwen3", { simulateStreaming: true });
    }
    case "ollama/qwen3:30b": {
      const p = createOllama({});
      return p("qwen3:30b", { simulateStreaming: true });
    }
    case "ollama/qwen3:32b": {
      const p = createOllama({});
      return p("qwen3:32b", { simulateStreaming: true });
    }
    case "ollama/llama3.1:8b": {
      const p = createOllama({});
      return p("llama3.1:8b", { simulateStreaming: true });
    }
    case "orieg/gemma3-tools:4b": {
      const p = createOllama({});
      return p("orieg/gemma3-tools:4b", { simulateStreaming: true });
    }
    case "ollama/llama4:latest": {
      const p = createOllama({});
      return p("llama4:latest", { simulateStreaming: true });
    }

    case "openai/gpt-4o": {
      const openai = createOpenAI({ apiKey });
      return openai("gpt-4o");
    }
    case "openai/gpt-4.1": {
      const openai = createOpenAI({ apiKey });
      return openai("gpt-4.1");
    }
    case "openai/gpt-4.1-mini": {
      const openai = createOpenAI({ apiKey });
      return openai("gpt-4.1-mini");
    }
    case "openai/gpt-4o-mini": {
      const openai = createOpenAI({ apiKey });
      return openai("gpt-4o-mini");
    }
    case "o4-mini": {
      const openai = createOpenAI({ apiKey });
      return openai("o4-mini");
    }

    case "anthropic/claude-3-7-sonnet-latest": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic("claude-3-7-sonnet-latest");
    }
    case "anthropic/claude-3-5-haiku-latest": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic("claude-3-5-haiku-latest");
    }
    case "anthropic/claude-opus-4-20250514": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic("claude-opus-4-20250514");
    }

    case "google_genai/gemini-2.5-pro": {
      const google = createGoogleGenerativeAI({ apiKey });
      return google("models/gemini-2.5-pro");
    }
    case "google_genai/gemini-2.5-flash": {
      const google = createGoogleGenerativeAI({ apiKey });
      return google("models/gemini-2.5-flash");
    }

    case "anthropic/claude-sonnet-4-20250514": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic("claude-sonnet-4-20250514");
    }

    default:
      throw new Error(`Unsupported model: ${model}`);
  }
}

/* ----------------------------- Route handler ---------------------------- */

export async function POST(req: Request) {
  const { messages, system, tools } = await req.json();
  const apiKey = req.headers.get("X-API-Key") || "";

  const cookieStore = await cookies();
  const cookieModel = cookieStore.get("selectedModel")?.value || "";

  const model =
    req.headers.get("X-Selected-Model") ||
    cookieModel ||
    process.env.DEFAULT_SELECTED_MODEL ||
    "google_genai/gemini-2.5-flash";

  if (!apiKey && !model.startsWith("ollama/") && !model.startsWith("lmstudio/")) {
    return new Response("Missing API-Key", { status: 400 });
  }

  const [fsTools, crTools, shellTools, webTools] = await Promise.all([
    getFilesystemMcpTools(),
    getCoderunnerMcpTools(),
    getShellExecMcpTools(),
    getWebSnapMcpTools(),
  ]);

  const selectedModel = selectModelProvider(model, apiKey);

  const result = streamText({
    model: selectedModel,
    messages,
    maxSteps: 100,
    toolCallStreaming: true,
    system,
    tools: {
      ...frontendTools(tools),
      ...fsTools,
      ...crTools,
      ...shellTools,
      ...webTools,
      ...getTerminalTools(),
    },
    onError: console.error,
  });

  return result.toDataStreamResponse();
}
