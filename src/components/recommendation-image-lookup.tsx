"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function RecommendationImageLookup({ endpoint, href, imageUrl, scopeKey = "new", disabled = false, onImage }: {
  endpoint: string; href: string; imageUrl: string; scopeKey?: string; disabled?: boolean; onImage: (url: string) => void;
}) {
  const controller = useRef<AbortController | null>(null);
  const [result, setResult] = useState<{ key: string; phase: "loading" | "done" | "error"; text: string } | null>(null);
  const key = JSON.stringify([endpoint, href, imageUrl, scopeKey, disabled]);
  useEffect(() => () => { controller.current?.abort(); }, [key]);
  const current = result?.key === key ? result : null;

  async function lookup() {
    controller.current?.abort();
    const pending = new AbortController(); controller.current = pending;
    setResult({ key, phase: "loading", text: "Buscando imagem..." });
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ href }), signal: pending.signal });
      const payload = await response.json();
      if (pending.signal.aborted) return;
      if (!response.ok || !payload.ok || typeof payload.data?.imageUrl !== "string")
        throw new Error(payload.error ?? "Não foi possível buscar a imagem. Você pode informá-la manualmente.");
      const next = payload.data.imageUrl;
      onImage(next);
      setResult({ key: JSON.stringify([endpoint, href, next, scopeKey, disabled]), phase: "done", text: "Imagem encontrada. Você pode alterá-la antes de salvar." });
    } catch (error) {
      if (!pending.signal.aborted) setResult({ key, phase: "error", text: error instanceof Error ? error.message : "Não foi possível buscar a imagem. Você pode informá-la manualmente." });
    }
  }
  return <div className="grid min-w-0 gap-2">
    <Button type="button" variant="neutral" className="min-w-0 whitespace-normal" disabled={disabled || !href.trim() || current?.phase === "loading"} onClick={() => void lookup()}>
      {current?.phase === "loading" ? "Buscando imagem..." : imageUrl ? "Buscar outra imagem pelo link" : "Buscar imagem pelo link"}
    </Button>
    <p className="text-sm">Amazon, Mercado Livre, KaBuM! e Magalu. A imagem também pode ser informada manualmente.</p>
    {current && <p className="text-sm" role={current.phase === "error" ? "alert" : "status"}>{current.text}</p>}
  </div>;
}
