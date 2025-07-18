import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOllama } from 'ollama-ai-provider';


import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { streamText } from "ai";
import { experimental_createMCPClient as createMCPClient } from "ai";

import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';
import { join } from "path";
import os from "os";

const transport = new Experimental_StdioMCPTransport({
  command: process.env.MCP_FILESYSTEM_CMD || "mcp-filesystem-server",
  args: [
    // directory for public assets
    process.env.MCP_FS_ASSETS_DIR || join(process.cwd(), "public/assets"),
    // workspace directory
    process.env.MCP_FS_WORKSPACE_DIR || join(os.homedir(), "Documents"),
  ],
});


const mcpClientFilesystem = await createMCPClient({
    transport,
});



// export const runtime = "edge";
export const maxDuration = 30;


let mcpClientCoderunner;

if (false && process.env.NEXT_RUNTIME !== 'server') {
  // Placeholder configuration at build time
  mcpClientCoderunner = { tools: async () => ({}) };
} else {
  // Runtime configuration
  mcpClientCoderunner = await createMCPClient({
    transport: {
      type: "sse",
      url: "http://coderunner.local:8222/sse",
    },
    name: "coderunner"
  });
}



const mcpToolsCoderunner = await mcpClientCoderunner.tools();
const mcpToolsFilesystem = await mcpClientFilesystem.tools();



const mcpTools = {
  ...mcpToolsCoderunner,
  ...mcpToolsFilesystem,
};





// helper function to dynamically select model configuration
function selectModelProvider(model: string, apiKey: string) {
  switch (model) {
    case "ollama/qwen3":
        const qwen3 = createOllama({});
        return qwen3("qwen3", {simulateStreaming: true});
    case "ollama/llama3.1:8b":
        const llama31 = createOllama({});
        return llama31("llama3.1:8b", {simulateStreaming: true});
    case "openai/gpt-4.1-mini":
      const openai = createOpenAI({ apiKey: apiKey });
      return openai("gpt-4o");
    case "google_genai/gemini-2.5-flash":
      const google = createGoogleGenerativeAI({ apiKey: apiKey });
      return google("models/gemini-2.5-flash");
    case "anthropic/claude-sonnet-4-20250514":
        const anthropic = createAnthropic({ apiKey: apiKey });
        return anthropic("claude-sonnet-4-20250514");
    default:
      throw new Error(`Unsupported model: ${model}`);
  }
}

export async function POST(req: Request) {
  const { messages, system, tools } = await req.json();

// receive from header/query directly
  const apiKey = req.headers.get("X-API-Key");
  const model = req.headers.get("X-Selected-Model") || "google_genai/gemini-2.5-flash";

  if (!apiKey && !model.startsWith("ollama/")) {
    return new Response("Missing API-Key", { status: 400 });
  }

    const selectedModel = selectModelProvider(model, apiKey||'');
    const result = streamText({
        model: selectedModel,
        messages,
        maxSteps: 100,
        toolCallStreaming: true,
        system,
        tools: {
            ...frontendTools(tools),
            ...mcpTools,
        },
        onError: console.error,
    });

    return result.toDataStreamResponse();
}