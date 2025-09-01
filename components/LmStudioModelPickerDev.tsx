// components/LmStudioModelPickerDev.tsx
"use client";

import React from "react";
import { getAllModelOptions, UIModelOption } from "@/lib/modelOptions";

export default function LmStudioModelPickerDev() {
  const [options, setOptions] = React.useState<UIModelOption[]>([]);
  const [value, setValue] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const opts = await getAllModelOptions();
        if (!alive) return;
        setOptions(opts);
        // preselect erstes lmstudio/* falls vorhanden
        const firstLm = opts.find(o => o.value.startsWith("lmstudio/"));
        setValue(firstLm?.value ?? opts[0]?.value ?? "");
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div style={{ padding: 12, border: "1px dashed #aaa", borderRadius: 8, marginBottom: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>
        LM Studio – Dev Model Picker (temporär)
      </div>
      {loading && <div>Lade Modelle…</div>}
      {error && <div style={{ color: "crimson" }}>Fehler: {error}</div>}
      {!loading && !error && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={value}
            onChange={(e) => {
              const v = e.target.value;
              setValue(v);
              console.log("[DevPicker] selected:", v);
            }}
            style={{ padding: "4px 8px", minWidth: 360 }}
          >
            {options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <code style={{ fontSize: 12, opacity: 0.8 }}>{value}</code>
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
        Tipp: LM Studio mit <code>--cors</code> starten, sonst blockt der Browser.
      </div>
    </div>
  );
}

