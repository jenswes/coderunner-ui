import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { streamText } from "ai";
import { experimental_createMCPClient as createMCPClient } from "ai";

import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';



const transport = new Experimental_StdioMCPTransport({
    command: "mcp-filesystem-server",
    args: [
        "/Users/manish/Desktop/assets",
        "/Users/manish/Downloads/chota"
      ],
  });

const transportContext7 = new Experimental_StdioMCPTransport({
    command: "npx",
    args: ["-y", "@upstash/context7-mcp"],
});

let mcpClientFilesystem = await createMCPClient({
    transport,
});



// export const runtime = "edge";
export const maxDuration = 30;

let mcpClientCoderunner = await createMCPClient({
  // TODO adjust this to point to your MCP server URL
  transport: {
    type: "sse",
    url: "http://coderunner.local:8222/sse",

  },
  name: "coderunner"

});

// New client for context7 addition
let mcpClientContext7 = await createMCPClient({
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

export async function POST(req: Request) {
  const { messages, system, tools } = await req.json();

  const result = streamText({
    // model: openai("gpt-4o"),
    model: google("models/gemini-2.0-flash"),
    messages,
    maxSteps: 100,
    // forward system prompt and tools from the frontend
    toolCallStreaming: true,
    system,
    tools: {
      ...frontendTools(tools),
      ...mcpTools,
    },
    onError: console.log,
  });

  return result.toDataStreamResponse();
}
