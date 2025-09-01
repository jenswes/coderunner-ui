// app/api/model-state/route.ts
export const runtime = "nodejs";

function getLmsBase(): string {
  const v1 =
    process.env.NEXT_PUBLIC_LMS_API_BASE ||
    process.env.LMS_API_BASE ||
    "http://localhost:1234/v1";
  return v1.replace(/\/v1$/, "");
}

// GET /api/model-state?id=<lmstudio/<id> ODER <id>>
// z.B. /api/model-state?id=lmstudio/mistralai/mistral-small-3.2
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    let id = url.searchParams.get("id") || "";
    if (!id) {
      return Response.json({ error: "missing id" }, { status: 400 });
    }
    // akzeptiere sowohl "lmstudio/<id>" als auch "<id>"
    if (id.startsWith("lmstudio/")) id = id.slice("lmstudio/".length);

    const base = getLmsBase();
    const r = await fetch(`${base}/api/v0/models`, { cache: "no-store" });
    if (!r.ok) {
      return Response.json(
        { error: `LM Studio responded ${r.status}` },
        { status: 502 }
      );
    }
    const j = await r.json();
    const arr: any[] = Array.isArray(j?.data) ? j.data : [];
    const hit = arr.find((m: any) => m?.id === id);
    if (!hit) {
      return Response.json({ id, state: "unknown" });
    }
    return Response.json({
      id,
      state: hit.state || "unknown",
      context_length: hit.context_length ?? null,
      size_bytes: hit.size_bytes ?? null,
      family: hit.family ?? null,
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

