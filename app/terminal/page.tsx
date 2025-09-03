// app/terminal/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";

// NOTE: Do NOT import xterm or addons at the top-level.
// Some builds evaluate modules during SSR and @xterm/addon-fit
// references `self` at top-level. We lazy-load them in useEffect.

// You can keep CSS at top-level safely.
import "@xterm/xterm/css/xterm.css";

// Prefer the env value, fallback to local dev default.
const WS_URL =
  process.env.NEXT_PUBLIC_PTY_WS_URL || "ws://localhost:3030/pty";

export default function TerminalPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<any>(null);
  const fitRef = useRef<any>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">(
    "connecting",
  );

  useEffect(() => {
    // Give this window a distinct name (helps when opened by a launcher)
    try {
      (window as any).name = "coderunner-terminal";
    } catch {}

    let disposed = false;
    let resizeObs: ResizeObserver | null = null;

    (async () => {
      // Lazy-load in the browser only
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);

      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        convertEol: true,
        cursorBlink: true,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", Consolas, "Courier New", monospace',
        fontSize: 13,
        theme: { background: "#0b0b0b" },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);

      // First fit now, then keep fitting on container resize
      try {
        fit.fit();
      } catch {}

      // Connect WebSocket to PTY server
      const ws = new WebSocket(WS_URL);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        setStatus("connected");
        // send initial size to PTY
        try {
          const dims = (term as any)._core?._renderService?._renderer?._dimensions;
          // if dims undefined, rely on cols/rows from terminal
        } catch {}
        const { cols, rows } = term;
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      };

      // Robust message decoding: string | Blob | ArrayBuffer
      ws.onmessage = async (ev: MessageEvent) => {
        if (!term) return;
        if (typeof ev.data === "string") {
          term.write(ev.data);
          return;
        }
        if (ev.data instanceof ArrayBuffer) {
          const text = new TextDecoder().decode(ev.data);
          term.write(text);
          return;
        }
        if (ev.data instanceof Blob) {
          const buf = await ev.data.arrayBuffer();
          const text = new TextDecoder().decode(buf);
          term.write(text);
          return;
        }
        // Fallback (unlikely)
        try {
          term.write(String(ev.data));
        } catch {}
      };

      ws.onclose = (e) => {
        setStatus("disconnected");
        term.writeln(
          `\r\n\x1b[31m[PTY disconnected] (code ${e.code}${
            e.reason ? `, ${e.reason}` : ""
          })\x1b[0m\r\n`,
        );
      };

      ws.onerror = () => {
        setStatus("disconnected");
      };

      // Forward terminal input to WS (raw)
      term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          // Raw text to PTY
          ws.send(data);
        }
      });

      // Fit on container resize and tell server
      resizeObs = new ResizeObserver(() => {
        try {
          fit.fit();
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
          }
        } catch {}
      });
      resizeObs.observe(containerRef.current);

      // Keep refs for cleanup
      termRef.current = term;
      fitRef.current = fit;
      wsRef.current = ws;
    })();

    return () => {
      disposed = true;
      if (resizeObs && containerRef.current) {
        try {
          resizeObs.unobserve(containerRef.current);
        } catch {}
      }
      try {
        wsRef.current?.close();
      } catch {}
      try {
        termRef.current?.dispose?.();
      } catch {}
      termRef.current = null;
      fitRef.current = null;
      wsRef.current = null;
    };
  }, []);

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden">
      <div className="px-3 py-2 text-xs border-b border-neutral-800 bg-neutral-900/70">
        Terminal — PTY status: <span className="font-mono">{status}</span>
      </div>
      <div ref={containerRef} className="h-[calc(100vh-32px)] w-full" />
    </div>
  );
}
