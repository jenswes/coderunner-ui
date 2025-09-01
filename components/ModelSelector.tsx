// components/ModelSelector.tsx
"use client";

import React from "react";

type Opt = { value: string; label: string };

export default function ModelSelector() {
  const [options, setOptions] = React.useState<Opt[]>([]);
  const [value, setValue] = React.useState<string>("");
  const [state, setState] = React.useState<"loaded" | "not-loaded" | "unknown">(
    "unknown"
  );
  const [loadingList, setLoadingList] = React.useState(false);
  const [checking, setChecking] = React.useState(false);

  // Modelle laden (Server ruft LM Studio REST auf)
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingList(true);
        const r = await fetch("/api/models", { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        const opts: Opt[] = j.options || [];
        setOptions(opts);
        // Cookie lesen
        const saved = getCookie("selectedModel");
        const initial = saved || opts[0]?.value || "";
        setValue(initial);
      } catch (e) {
        console.warn("Model list failed", e);
      } finally {
        setLoadingList(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Status für das gewählte Modell pollen
  React.useEffect(() => {
    let alive = true;
    if (!value) return;

    async function checkOnce() {
      try {
        setChecking(true);
        const id = encodeURIComponent(value);
        const r = await fetch(`/api/model-state?id=${id}`, { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        setState(j?.state ?? "unknown");
      } catch {
        if (!alive) return;
        setState("unknown");
      } finally {
        if (alive) setChecking(false);
      }
    }

    checkOnce();
    const t = setInterval(checkOnce, 5000); // alle 5s
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [value]);

  function onChange(v: string) {
    setValue(v);
    // 1 Jahr gültig, site-wide
    document.cookie = `selectedModel=${encodeURIComponent(
      v
    )}; path=/; max-age=31536000`;
    // sofort Status neu abfragen
    setTimeout(() => {
      void fetch(`/api/model-state?id=${encodeURIComponent(v)}`);
    }, 0);
  }

  const pillColor =
    state === "loaded" ? "bg-emerald-500" : state === "not-loaded" ? "bg-amber-500" : "bg-neutral-400";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="font-semibold">Model:</label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loadingList}
        className="min-w-[22rem] px-2 py-1 border rounded"
        aria-label="Select model"
      >
        {loadingList && <option>Loading…</option>}
        {!loadingList &&
          options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
      </select>

      <span className={`inline-flex items-center gap-2 px-2 py-1 text-white text-xs rounded-full ${pillColor}`}>
        {checking ? "checking…" : state}
      </span>

      <button
        type="button"
        onClick={async () => {
          setLoadingList(true);
          try {
            const r = await fetch("/api/models", { cache: "no-store" });
            const j = await r.json();
            const opts: Opt[] = j.options || [];
            setOptions(opts);
          } finally {
            setLoadingList(false);
          }
        }}
        className="px-2 py-1 border rounded text-sm"
        title="Refresh model list"
      >
        Refresh
      </button>

      <code className="opacity-60 text-xs">{value}</code>
    </div>
  );
}

function getCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

