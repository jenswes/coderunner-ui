"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { useChatContext } from "@/components/chat-context";

export function MyRuntimeProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { model, apiKey } = useChatContext();

  const runtime = useChatRuntime({
    api: `/api/chat-proxy?model=${encodeURIComponent(model)}`, // pass via query
    headers: { "X-API-Key": apiKey }, // runtime supports additional headers directly
    onFinish: (message) => console.log("Message finished:", message),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}