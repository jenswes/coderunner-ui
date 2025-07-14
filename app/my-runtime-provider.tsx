'use client';
import { useMemo } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { useChatContext } from "@/components/chat-context";

export function MyRuntimeProvider({ children }: { children: React.ReactNode }) {
  const { model, apiKey } = useChatContext();

  const runtimeConfig = useMemo(() => ({
    api: `/api/chat-proxy?model=${encodeURIComponent(model)}`,
    headers: { "X-API-Key": apiKey },
    // let TS infer the message type
    onFinish: message => console.log("Message finished:", message),
  }), [model, apiKey]);

  const runtime = useChatRuntime(runtimeConfig);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}