export type ModelOptions =
  | "ollama/deepseek-r1:32b"
  | "ollama/deepseek-r1:8b"
  | "ollama/qwen3"
  | "ollama/qwen3:30b"
  | "ollama/qwen3:32b"
  | "ollama/llama3.1:8b"
  | "orieg/gemma3-tools:4b"
  | "ollama/llama4:latest"
  | "openai/gpt-4o"
  | "openai/gpt-4.1"
  | "openai/gpt-4.1-mini"
  | "openai/gpt-4o-mini"
  | "o4-mini"
  | "anthropic/claude-sonnet-4-20250514"
  | "anthropic/claude-3-7-sonnet-latest"
  | "anthropic/claude-3-5-haiku-latest"
  | "anthropic/claude-opus-4-20250514"
  | "google_genai/gemini-2.5-pro"
  | "google_genai/gemini-2.5-flash"
  // ⬇️ NEU: erlaubt beliebige LM-Studio IDs wie "lmstudio/meta-llama-3.1-8b-instruct"
  | `lmstudio/${string}`;

export const isLmStudio = (m: string): m is `lmstudio/${string}` =>
  m.startsWith("lmstudio/");

export const lmStudioModelId = (m: `lmstudio/${string}`) =>
  m.slice("lmstudio/".length);
