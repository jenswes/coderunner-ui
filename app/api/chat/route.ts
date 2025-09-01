// app/api/chat/route.ts
import { cookies } from "next/headers";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOllama } from "ollama-ai-provider";

import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { streamText } from "ai";
import { experimental_createMCPClient as createMCPClient } from "ai";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";
import { Experimental_StdioMCPTransport } from "ai/mcp-stdio";

import { join } from "path";
import os from "os";

export const runtime = "nodejs";
// export const runtime = "edge";
export const maxDuration = 30;

/* ----------------------------- MCP helpers ----------------------------- */

function resolveFilesystemCmd(): string {
  // 1) explicit env
  if (process.env.MCP_FILESYSTEM_CMD) return process.env.MCP_FILESYSTEM_CMD;

  // 2) common fallbacks:
  //    - Go build like mark3labs/mcp-filesystem-server
  const goBin = `${process.env.HOME || os.homedir()}/go/bin/mcp-filesystem-server`;

  //    - Node package @modelcontextprotocol/server-filesystem
  const nodeBin =
    process.platform === "win32"
      ? join(process.cwd(), "node_modules/.bin/mcp-filesystem.cmd")
      : join(process.cwd(), "node_modules/.bin/mcp-filesystem");

  // choose first candidate; if it doesn't exist, spawn will fail and we handle it upstream
  return process.env.MCP_PREFER_NODE_BIN === "1" ? nodeBin : goBin;
}

async function getFilesystemMcpTools() {
  try {
    const transport = new Experimental_StdioMCPTransport({
      command: resolveFilesystemCmd(),
      args: [
        // directory for public assets (frontend project)
        process.env.MCP_FS_ASSETS_DIR || join(process.cwd(), "public/assets"),
        // additional host assets directory that maps into the container
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

/* ------------------------- Model provider switch ------------------------ */

function selectModelProvider(model: string, apiKey: string) {
  // LM Studio via OpenAI-compatible API
  if (model.startsWith("lmstudio/")) {
    const baseURL =
      process.env.LMS_API_BASE ||
      process.env.NEXT_PUBLIC_LMS_API_BASE ||
      "http://localhost:1234/v1";
    const key = apiKey || process.env.LMS_API_KEY || "lmstudio";

    const lmstudio = createOpenAI({ apiKey: key, baseURL });
    const bareModel = model.slice("lmstudio/".length); // e.g. "mistralai/mistral-small-3.2"
    return lmstudio(bareModel);
  }

  // existing providers
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

  // headers
  const apiKey = req.headers.get("X-API-Key") || "";

 const cookieStore = await cookies();
  const cookieModel = cookieStore.get("selectedModel")?.value || "";
const model =
  req.headers.get("X-Selected-Model") ||
  cookieModel ||
  process.env.DEFAULT_SELECTED_MODEL ||
  "google_genai/gemini-2.5-flash";
  
  // permit no api key for ollama/* and lmstudio/*
  if (
    !apiKey &&
    !model.startsWith("ollama/") &&
    !model.startsWith("lmstudio/")
  ) {
    return new Response("Missing API-Key", { status: 400 });
  }

  // init MCP tools per request (robust, no top-level await)
  const [fsTools, crTools] = await Promise.all([
    getFilesystemMcpTools(),
    getCoderunnerMcpTools(),
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
    },
    onError: console.error,
  });

  return result.toDataStreamResponse();
}
