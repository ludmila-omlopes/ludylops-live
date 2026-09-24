"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CreatorSetup as Setup } from "@/lib/creators/setup";
const labels = { configured: "Registrado", pending: "Falta configurar", blocked: "Indisponível", verify: "Verificar na live" };
const guides = [
  ["Credenciais e teste de autenticação", "docs/streamerbot-credentials.md"],
  ["Vínculo do YouTube e moeda", "docs/creator-economy.md"],
  ["Action de ganhos por mensagem", "docs/creator-chat-rewards.md"],
  ["Bridge, actions e resgate de teste", "docs/creator-redemptions.md"],
] as const;
export function CreatorSetup({ creatorId }: { creatorId: string }) {
  const [data, setData] = useState<Setup | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function load() {
    setBusy(true); setError(""); setData(null);
    try {
      const response = await fetch(`/api/me/creator-area/${encodeURIComponent(creatorId)}/setup`, { cache: "no-store" });
      const result = await response.json(); if (!response.ok || !result.ok) throw Error(result.error ?? "Não foi possível verificar a configuração.");
      setData(result.data);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível verificar a configuração."); }
    finally { setBusy(false); }
  }
  return <section className="mt-5 grid min-w-0 gap-4 border-2 border-[var(--color-ink)] p-4">
    <h3 className="text-xl font-bold">Antes da primeira live</h3>
    <p className="text-sm">Confira o que já foi salvo e o que ainda precisa ser testado com sua comunidade. Depois de mudar uma configuração, verifique novamente.</p>
    <Button variant="neutral" disabled={busy} onClick={() => void load()}>{busy ? "Verificando…" : "Verificar configuração"}</Button>
    {error && <p role="alert">{error}</p>}
    {data && <ol className="grid min-w-0 gap-4">{data.steps.map((step, i) => <li key={step.id} className="min-w-0 border-t pt-3 text-sm">
      <h4 className="font-bold">{i + 1}. {step.title}</h4><p className="mt-1 font-semibold">{labels[step.state]}</p>
      <p className="mt-2 break-words">{step.detail}</p>
      {step.href && <a className="mt-2 inline-block font-bold underline" href={step.href}>{step.link}</a>}
    </li>)}</ol>}
    <details className="text-sm"><summary className="cursor-pointer font-bold">Instruções para configurar e testar</summary>
      <ul className="mt-3 grid gap-2">{guides.map(([label, path]) => <li key={path}><a className="underline" href={`https://github.com/ludmila-omlopes/ludylops-live/blob/master/${path}`} target="_blank" rel="noreferrer">{label}</a></li>)}</ul>
      <p className="mt-3">Presença, inscrições, apostas e sugestões ainda não estão disponíveis para novas comunidades. Ganhos por chat exigem a regra ativa e a action configurada.</p>
    </details>
  </section>;
}
