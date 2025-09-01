// lib/lmsModels.ts
export type LmStudioRestModel = {
  id: string;
  state?: "loaded" | "not-loaded" | string;
  family?: string;
  size_bytes?: number;
  context_length?: number;
};

export async function listLmsModelsRest(): Promise<LmStudioRestModel[]> {
  const base = (process.env.NEXT_PUBLIC_LMS_API_BASE || "").replace(/\/v1$/, "");
  if (!base) throw new Error("NEXT_PUBLIC_LMS_API_BASE not set");

  const res = await fetch(`${base}/api/v0/models`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`LM Studio /api/v0/models failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  const arr = Array.isArray(json?.data) ? json.data : [];
  return arr.map((m: any) => ({
    id: m?.id,
    state: m?.state,
    family: m?.family,
    size_bytes: m?.size_bytes,
    context_length: m?.context_length,
  })).filter((m: LmStudioRestModel) => !!m.id);
}

export function formatLmStudioLabel(m: LmStudioRestModel) {
  const badge = m.state === "loaded" ? " • loaded" : "";
  return `${m.id}${badge}`;
}

