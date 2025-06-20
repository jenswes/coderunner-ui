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



const mcpToolsCoderunner = await mcpClientCoderunner.tools();

const mcpToolsFilesystem = await mcpClientFilesystem.tools();

const mcpTools = {
  ...mcpToolsCoderunner,
  ...mcpToolsFilesystem,
};

export async function POST(req: Request) {
  const { messages, system, tools } = await req.json();

  const result = streamText({
    // model: openai("gpt-4o"),
    model: google("models/gemini-2.5-pro"),
    messages,
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
