// app/api/chat-proxy/route.ts
import { Agent, setGlobalDispatcher } from "undici";
import { cookies } from "next/headers";

// disable the 5-minute body timeout entirely (long tool runs / streaming)
setGlobalDispatcher(new Agent({ bodyTimeout: 0 }));

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json();

  // sanitize: drop assistant messages that only contain empty text parts
  if (Array.isArray((body as any).messages)) {
    (body as any).messages = (body as any).messages.filter((msg: any) => {
      if (msg.role !== "assistant") return true;
      const parts = Array.isArray(msg.content) ? msg.content : [];
      return parts.some(
        (p: any) =>
          p.type === "tool-call" ||
          (typeof p.text === "string" && p.text.trim() !== "")
      );
    });
  }

  // ---- model resolution (Cookie > query > env > LM Studio default) ----
  const url = new URL(req.url);
  const modelFromQuery = url.searchParams.get("model") || "";

  const cookieStore = await cookies();
  const cookieModel = cookieStore.get("selectedModel")?.value || "";

  const envDefault = process.env.DEFAULT_SELECTED_MODEL || "";

  // Prefer the model picked in the UI (cookie) over any query default
  const model =
    cookieModel ||
    modelFromQuery ||
    envDefault ||
    "lmstudio/mistralai/mistral-small-3.2";

  // ---- api key resolution (header > provider env > none) ----
  const incomingKey = req.headers.get("X-API-Key") || "";
  let apiKey = incomingKey;
  if (!apiKey) {
    if (model.startsWith("openai/")) {
      apiKey = process.env.OPENAI_API_KEY || "";
    } else if (model.startsWith("anthropic/")) {
      apiKey = process.env.ANTHROPIC_API_KEY || "";
    } else if (model.startsWith("google_genai/")) {
      // try common env names for Google GenAI
      apiKey =
        process.env.GOOGLE_GENAI_API_KEY ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        "";
    }
    // ollama/* and lmstudio/* do not require an API key
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  // optional debug (quiet by default)
  // console.log("[proxy] model:", model, "hasKey?", Boolean(apiKey));

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Selected-Model": model,
      ...(apiKey ? { "X-API-Key": apiKey } : {}),
    },
    body: JSON.stringify(body),
  });

  // stream back as-is (fixes ERR_DECODING_CONTENT / keeps SSE style)
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") || "application/json",
      "Cache-Control": response.headers.get("Cache-Control") || "no-cache",
    },
  });
}
