// lib/lmsClient.ts
import OpenAI from "openai";

export function createLmsClient() {
  const baseURL = process.env.NEXT_PUBLIC_LMS_API_BASE!;
  const apiKey  = process.env.NEXT_PUBLIC_LMS_API_KEY || "lmstudio";
  return new OpenAI({ baseURL, apiKey });
}

