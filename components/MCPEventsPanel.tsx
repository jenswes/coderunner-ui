// components/MCPEventsPanel.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type McpEvent = {
  type: string;
  ts?: number;
  source?: string;
  name?: string;
  ok?: boolean;
  error?: string;
  resultPreview?: string;
  args?: any;
  [k: string]: any;
};

export default function MCPEventsPanel() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<McpEvent[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource("/api/mcp-events");
    const onMcp = (ev: MessageEvent) => {
      try {
        const data: McpEvent = JSON.parse(ev.data);
        setEvents((prev) => {
          const next = [...prev, data];
          return next.slice(-300); // cap
        });
      } catch {
        // ignore
      }
    };
    es.addEventListener("mcp", onMcp);
    return () => {
      es.removeEventListener("mcp", onMcp as any);
      es.close();
    };
  }, []);

  // autoscroll on new events (if near bottom)
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [events]);

  const rows = useMemo(
    () =>
      events.map((e, i) => (
        <div
          key={i}
          className="grid grid-cols-[auto_1fr_auto] gap-2 rounded-md border p-2 text-xs bg-background"
        >
          <span className="font-mono opacity-70">
            {e.ts ? new Date(e.ts).toLocaleTimeString() : "—"}
          </span>
          <span className="truncate">
            <b>{e.type}</b>
            {e.source ? ` · ${e.source}` : ""}
            {e.name ? ` · ${e.name}` : ""}
            {typeof e.ok === "boolean" ? ` · ${e.ok ? "ok" : "fail"}` : ""}
            {e.error ? ` · ${e.error}` : ""}
          </span>
          <details className="ml-auto cursor-pointer">
            <summary className="opacity-70">details</summary>
            <pre className="mt-1 whitespace-pre-wrap break-words">
{JSON.stringify(e, null, 2)}
            </pre>
          </details>
        </div>
      )),
    [events]
  );

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm shadow-sm hover:bg-accent hover:text-accent-foreground"
      >
        {open ? "Hide" : "Show"} MCP Events
        <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs">
          {events.length}
        </span>
      </button>

      {/* Panel */}
      {open && (
        <div className="mt-2 w-[min(92vw,720px)] h-[min(70vh,520px)] rounded-lg border bg-background/95 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="font-medium">MCP Events</div>
            <div className="flex items-center gap-2">
              <button
                className="rounded border px-2 py-1 text-xs hover:bg-accent"
                onClick={() => setEvents([])}
              >
                Clear
              </button>
            </div>
          </div>
          <div
            ref={listRef}
            className="h-[calc(100%-40px)] overflow-auto p-3 space-y-2"
          >
            {rows.length ? rows : (
              <div className="text-xs opacity-60">
                Waiting for events… (tool calls will appear here)
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

