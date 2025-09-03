// app/api/mcp-events/route.ts
import { NextRequest } from "next/server";
import { onMcpEvent, dumpMcpEvents } from "@/lib/mcpEvents";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  const headers = new Headers({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const stream = new ReadableStream({
    start(controller) {
      const write = (data: unknown) => {
        controller.enqueue(
          `data: ${JSON.stringify(data)}\n\n`
        );
      };

      // Backlog (die letzten Events, damit Panel nicht leer startet)
      write({ type: "backlog", items: dumpMcpEvents() });

      // Heartbeat alle 20s
      const hb = setInterval(() => controller.enqueue(`: ping\n\n`), 20_000);

      // Live-Events
      const unsub = onMcpEvent((evt) => write({ type: "event", evt }));

      // Cleanup
      controller.enqueue(`event: ready\ndata: {}\n\n`);
      controller.enqueue(`: stream-open\n\n`);

      return () => {
        clearInterval(hb);
        unsub();
      };
    },
  });

  return new Response(stream, { headers });
}

