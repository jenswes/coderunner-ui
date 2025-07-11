import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { streamText } from "ai";
import { experimental_createMCPClient as createMCPClient } from "ai";

import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';



const transport = new Experimental_StdioMCPTransport({
    command: "/Users/manish/go/bin/mcp-filesystem-server",
    args: [
        "/Users/manish/Desktop/assets",
        "/Users/manish/Downloads/chota"
      ],
  });

const transportContext7 = new Experimental_StdioMCPTransport({
    command: "npx",
    args: ["-y", "@upstash/context7-mcp"],
});

const mcpClientFilesystem = await createMCPClient({
    transport,
});



// export const runtime = "edge";
export const maxDuration = 30;

// const mcpClientCoderunner = await createMCPClient({
//   // TODO adjust this to point to your MCP server URL
//   transport: {
//     type: "sse",
//     url: "http://coderunner.local:8222/sse",

//   },
//   name: "coderunner"

// });

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


// New client for context7 addition
const mcpClientContext7 = await createMCPClient({
    transport: transportContext7,
});



const mcpToolsCoderunner = await mcpClientCoderunner.tools();
const mcpToolsFilesystem = await mcpClientFilesystem.tools();
const mcpToolsContext7 = await mcpClientContext7.tools();


const mcpTools = {
  ...mcpToolsCoderunner,
  ...mcpToolsFilesystem,
  ...mcpToolsContext7, // Include context7 tools
};





// helper function to dynamically select model configuration
function selectModelProvider(model: string, apiKey: string) {
  switch (model) {
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

  if (!apiKey) {
    return new Response("Missing API-Key", { status: 400 });
  }

  const selectedModel = selectModelProvider(model, apiKey);

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