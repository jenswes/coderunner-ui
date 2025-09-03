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

function getTerminalTools() {
  // Send raw keystrokes/text to the actual terminal window.
  const INPUT_URL =
    process.env.PTY_INPUT_URL ||
    process.env.PTY_FEED_URL || // legacy fallback
    "http://localhost:3030/input";

  const writeTool = tool({
    description:
      "Type raw text/keystrokes into the real terminal (PTY). Include '\\n' for Enter. Example: 'htop\\n' or 'q'.",
    parameters: z.object({
      text: z.string().describe("What to type (remember \\n for Enter)."),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async ({ text }: any) => {
      try {
        const r = await fetch(INPUT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: text }),
        });
        if (!r.ok) return `terminal.write failed ${r.status}: ${await r.text()}`;
        return "ok";
      } catch (e: any) {
        return `terminal.write error: ${e?.message || String(e)}`;
      }
    },
  });

  const runInteractiveTool = tool({
    description:
      "Run an interactive command in the real terminal, wait, then send a quit sequence. Perfect for: 'run htop for 5 seconds and quit'.",
    parameters: z.object({
      command: z.string().describe("The command to run, e.g. 'htop' or 'top -d 1'"),
      durationMs: z.number().int().positive().max(120000).describe("How long to keep it open."),
      quitSequence: z
        .string()
        .default("q")
        .describe("Keys to quit (default: 'q'). Use '\\x03' for Ctrl-C, add '\\n' if the program needs Enter."),
      sendEnterAfterCommand: z
        .boolean()
        .default(true)
        .describe("Append a trailing newline after the command (default true)."),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async ({ command, durationMs, quitSequence, sendEnterAfterCommand }: any) => {
      const send = async (data: string) => {
        await fetch(INPUT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
      };
      try {
        await send(command + (sendEnterAfterCommand ? "\n" : ""));
        await new Promise((r) => setTimeout(r, durationMs));
        await send(quitSequence);
        return `Ran '${command}' for ${durationMs}ms and sent quit sequence.`;
      } catch (e: any) {
        return `terminal.runInteractive error: ${e?.message || String(e)}`;
      }
    },
  });

  return {
    "terminal.write": writeTool,
    "terminal.runInteractive": runInteractiveTool,
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

  // MCP tools (fault-tolerant)
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
      ...getTerminalTools(), // <- PTY tools available to the model
    },
    onError: console.error,
  });

  return result.toDataStreamResponse();
}
