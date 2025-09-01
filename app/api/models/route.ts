// app/api/models/route.ts
export const runtime = "nodejs";

function getLmsBase(): string {
  const v1 = process.env.NEXT_PUBLIC_LMS_API_BASE || process.env.LMS_API_BASE || "http://localhost:1234/v1";
  return v1.replace(/\/v1$/, ""); // -> http://host:port
}

export async function GET() {
  try {
    const base = getLmsBase();
    const res = await fetch(`${base}/api/v0/models`, { cache: "no-store" });
    if (!res.ok) {
      return Response.json({ error: `LM Studio responded ${res.status}` }, { status: 502 });
    }
    const json = await res.json();
    const options = Array.isArray(json?.data)
      ? json.data
          .filter((m: any) => m?.id)
          .map((m: any) => ({
            value: `lmstudio/${m.id}`,
            label: `${m.id}${m.state === "loaded" ? " • loaded" : ""}`,
          }))
      : [];

    return Response.json({ options });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

