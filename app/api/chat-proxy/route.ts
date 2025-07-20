export async function POST(req: Request) {
  const body = await req.json();

  if (Array.isArray((body as any).messages)) {
    (body as any).messages = (body as any).messages.filter((msg: any) => {
      if (msg.role !== "assistant") return true;
      const parts = Array.isArray(msg.content) ? msg.content : [];
      // keep if it's a tool_call or has non-empty text
    return parts.some((p: any) =>
      p.type === "tool-call" ||
      (typeof p.text === "string" && p.text.trim() !== "")
    );
    });
  }
  const apiKey = req.headers.get("X-API-Key") || "";
  const model = new URL(req.url).searchParams.get("model") || "google_genai/gemini-2.5-flash";

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  console.log("body", body);
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