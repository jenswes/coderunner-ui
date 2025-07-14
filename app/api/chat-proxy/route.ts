export async function POST(req: Request) {
  const body = await req.json();

  if (Array.isArray((body as any).messages)) {
    (body as any).messages = (body as any).messages.filter((msg: any) => {
      if (msg.role !== "assistant") return true;
      const parts = Array.isArray(msg.content) ? msg.content : [];
      // keep only if at least one part.text is non-empty
      return parts.some((p: any) => typeof p.text === "string" && p.text.trim() !== "");
    });
  }
  const apiKey = req.headers.get("X-API-Key") || "";
  const model = new URL(req.url).searchParams.get("model") || "google_genai/gemini-2.5-flash";

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Selected-Model": model,
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  // explicitly stream response (fixes ERR DECODING CONTENT)
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/json",
      "Cache-Control": response.headers.get("Cache-Control") || "no-cache",
    },
  });
}