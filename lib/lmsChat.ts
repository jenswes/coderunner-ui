// lib/lmsChat.ts
import { createLmsClient } from "./lmsClient";

export async function lmsChat({
  model,
  messages,
  temperature = 0.7,
  stream = false,
}: {
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature?: number;
  stream?: boolean;
}) {
  const client = createLmsClient();
  if (stream) {
    const streamResp = await client.chat.completions.create({
      model, messages, temperature, stream: true,
    });
    return streamResp; // your existing stream handler
  } else {
    const resp = await client.chat.completions.create({
      model, messages, temperature,
    });
    return resp.choices[0]?.message?.content ?? "";
  }
}

