import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOllama } from 'ollama-ai-provider';


import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { streamText } from "ai";
import { MCPTransport, experimental_createMCPClient as createMCPClient } from "ai";
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';

import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';
import { join } from "path";
import os from "os";

export const runtime = "nodejs";

const transport = new Experimental_StdioMCPTransport({
  command: process.env.MCP_FILESYSTEM_CMD || "mcp-filesystem-server",
  args: [
    // directory for public assets
    process.env.MCP_FS_ASSETS_DIR || join(process.cwd(), "public/assets"),

    join(os.homedir(), ".coderunner/assets"),
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

const url = new URL('http://coderunner.local:8222/mcp');
  mcpClientCoderunner = await createMCPClient({
  transport: new StreamableHTTPClientTransport(url, {
  }),
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
    case "ollama/deepseek-r1:32b":
        const deepseek32b = createOllama({});
        return deepseek32b("deepseek-r1:32b", {simulateStreaming: true});
    case "ollama/deepseek-r1:8b":
        const deepseek8b = createOllama({});
        return deepseek8b("deepseek-r1:8b", {simulateStreaming: true});
    case "ollama/qwen3":
        const qwen3 = createOllama({});
        return qwen3("qwen3", {simulateStreaming: true});
    case "ollama/qwen3:30b":
        const qwen330b = createOllama({});
        return qwen330b("qwen3:30b", {simulateStreaming: true});
    case "ollama/qwen3:32b":
        const qwen332b = createOllama({});
        return qwen332b("qwen3:32b", {simulateStreaming: true});
    case "ollama/llama3.1:8b":
        const llama31 = createOllama({});
        return llama31("llama3.1:8b", {simulateStreaming: true});
    case "orieg/gemma3-tools:4b":
        const gemma3 = createOllama({});
        return gemma3("orieg/gemma3-tools:4b", {simulateStreaming: true}); // streaming is not supported for this model
    case "ollama/llama4:latest":
        const llama4 = createOllama({});
        return llama4("llama4:latest", {simulateStreaming: true});
    case "openai/gpt-4o":
      const openai = createOpenAI({ apiKey: apiKey });
      return openai("gpt-4o");
    case "openai/gpt-4.1":
      const openai41 = createOpenAI({ apiKey: apiKey });
      return openai41("gpt-4.1");
    case "openai/gpt-4.1-mini":
      const openai41mini = createOpenAI({ apiKey: apiKey });
      return openai41mini("gpt-4.1-mini");
    case "openai/gpt-4o-mini":
      const openai4omini = createOpenAI({ apiKey: apiKey });
      return openai4omini("gpt-4o-mini");
    case "o4-mini":
      const o4mini = createOpenAI({ apiKey: apiKey });
      return o4mini("o4-mini");
    case "anthropic/claude-3-7-sonnet-latest":
      const claude37sonnet = createAnthropic({ apiKey: apiKey });
      return claude37sonnet("claude-3-7-sonnet-latest");
    case "anthropic/claude-3-5-haiku-latest":
      const claude35haiku = createAnthropic({ apiKey: apiKey });
      return claude35haiku("claude-3-5-haiku-latest");
    case "anthropic/claude-opus-4-20250514":
      const claudeopus4 = createAnthropic({ apiKey: apiKey });
      return claudeopus4("claude-opus-4-20250514");
    case "google_genai/gemini-2.5-pro":
      const google = createGoogleGenerativeAI({ apiKey: apiKey });
      return google("models/gemini-2.5-pro");
    case "google_genai/gemini-2.5-flash":
      const googleFlash = createGoogleGenerativeAI({ apiKey: apiKey });
      return googleFlash("models/gemini-2.5-flash");
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