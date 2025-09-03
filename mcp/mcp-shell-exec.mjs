// mcp/mcp-shell-exec.mjs
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "node:child_process";
import http from "node:http";

const PTY_FEED_URL =
  process.env.PTY_FEED_URL || "http://localhost:3030/write";

// tiny helper: POST to /write
function writeToTerminal(text) {
  return new Promise((resolve) => {
    const data = Buffer.from(JSON.stringify({ data: text }), "utf8");
    const req = http.request(
      PTY_FEED_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": data.length,
        },
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", resolve);
      }
    );
    req.on("error", resolve);
    req.write(data);
    req.end();
  });
}

const server = new Server(
  {
    name: "shell-exec",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(
  { method: "tools/list" },
  async () => ({
    tools: [
      {
        name: "container.exec",
        description:
          "Execute a shell command inside the coderunner container and return its output.",
        inputSchema: {
          type: "object",
          properties: {
            cmd: { type: "string" },
            timeoutMs: { type: "number", nullable: true },
          },
          required: ["cmd"],
          additionalProperties: false,
        },
      },
    ],
  })
);

server.setRequestHandler(
  { method: "tools/call" },
  async (req) => {
    if (!Array.isArray(req.params.tools)) {
      return { content: [{ type: "text", text: "invalid tools payload" }] };
    }

    const results = [];
    for (const t of req.params.tools) {
      if (t.name !== "container.exec") {
        results.push({
          tool: t.name,
          content: [
            { type: "text", text: `Unknown tool: ${t.name}` },
          ],
          isError: true,
        });
        continue;
      }

      const schema = z.object({
        cmd: z.string(),
        timeoutMs: z.number().optional(),
      });
      const { cmd, timeoutMs = 120_000 } = schema.parse(t.input || {});

      const bin = process.env.MCP_SHELL_EXEC_PATH || "container";
      const args = (process.env.MCP_SHELL_EXEC_WRAPPER ||
        "container exec coderunner bash -lc")
        .split(" ")
        .concat([cmd]);

      // Mirror command into terminal
      await writeToTerminal(`\r\n\x1b[1;33m$ ${cmd}\x1b[0m\r\n`);

      try {
        const child = spawn(args[0], args.slice(1), {
          env: process.env,
        });

        let stdout = "";
        let stderr = "";

        const timer = setTimeout(() => {
          child.kill("SIGKILL");
        }, timeoutMs);

        child.stdout.on("data", (d) => {
          const s = d.toString("utf8");
          stdout += s;
          writeToTerminal(s);
        });
        child.stderr.on("data", (d) => {
          const s = d.toString("utf8");
          stderr += s;
          writeToTerminal(s);
        });

        const exit = await new Promise((resolve) => {
          child.on("close", (code) => {
            clearTimeout(timer);
            resolve(code ?? 0);
          });
        });

        results.push({
          tool: t.name,
          content: [
            {
              type: "text",
              text:
                `# container.exec\ncmd: ${args.join(" ")}\nexit: ${exit}\n\n` +
                (stdout ? `stdout:\n${stdout}\n` : "") +
                (stderr ? `stderr:\n${stderr}\n` : ""),
            },
          ],
          isError: exit !== 0,
        });
      } catch (e) {
        const msg = String(e?.message || e);
        await writeToTerminal(`\r\n\x1b[31m${msg}\x1b[0m\r\n`);
        results.push({
          tool: t.name,
          content: [{ type: "text", text: msg }],
          isError: true,
        });
      }
    }

    return { content: results.flatMap((r) => r.content) };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
