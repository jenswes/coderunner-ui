// lib/modelOptions.ts
import type { ModelOptions } from "@/types";
import { listLmsModelsRest, formatLmStudioLabel } from "@/lib/lmsModels";

const STATIC_MODELS: ModelOptions[] = [
  "ollama/deepseek-r1:32b",
  "ollama/deepseek-r1:8b",
  "ollama/qwen3",
  "ollama/qwen3:30b",
  "ollama/qwen3:32b",
  "ollama/llama3.1:8b",
  "orieg/gemma3-tools:4b",
  "ollama/llama4:latest",
  "openai/gpt-4o",
  "openai/gpt-4.1",
  "openai/gpt-4.1-mini",
  "openai/gpt-4o-mini",
  "o4-mini",
  "anthropic/claude-sonnet-4-20250514",
  "anthropic/claude-3-7-sonnet-latest",
  "anthropic/claude-3-5-haiku-latest",
  "anthropic/claude-opus-4-20250514",
  "google_genai/gemini-2.5-pro",
  "google_genai/gemini-2.5-flash",
];

export type UIModelOption = {
  value: ModelOptions;  // e.g. "lmstudio/meta-llama-3.1-8b-instruct"
  label: string;        // what we show in the dropdown
  meta?: Record<string, unknown>;
};

export async function getAllModelOptions(): Promise<UIModelOption[]> {
  const out: UIModelOption[] = STATIC_MODELS.map((m) => ({ value: m, label: m }));

  try {
    const lms = await listLmsModelsRest();
    for (const m of lms) {
      const value = `lmstudio/${m.id}` as ModelOptions; // dank `lmstudio/${string}` in types.ts gültig
      out.push({
        value,
        label: formatLmStudioLabel(m), // "id • loaded"
        meta: {
          provider: "lmstudio",
          state: m.state,
          ctx: m.context_length,
          size: m.size_bytes,
          family: m.family,
        },
      });
    }
  } catch (e) {
    console.warn("LM Studio model fetch failed:", e);
  }

  return out;
}

