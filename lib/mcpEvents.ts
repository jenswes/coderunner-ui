// lib/mcpEvents.ts
import { EventEmitter } from "events";

type McpEvt = {
  ts: number;
  source: string;          // z.B. "chat.route" | "tool" | "container.exec"
  kind: string;            // z.B. "start" | "done" | "error"
  detail?: unknown;
};

const emitter = new EventEmitter();
const RING_MAX = 200;
const ring: McpEvt[] = [];

export function pushMcpEvent(evt: McpEvt) {
  const item = { ts: Date.now(), ...evt };
  ring.push(item);
  if (ring.length > RING_MAX) ring.shift();
  emitter.emit("evt", item);
}

export function onMcpEvent(cb: (evt: McpEvt) => void) {
  emitter.on("evt", cb);
  return () => emitter.off("evt", cb);
}

export function dumpMcpEvents(): McpEvt[] {
  return ring.slice(-RING_MAX);
}

