"use client";

import { useState } from "react";
import { Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CommunityWallet } from "@/lib/creators/community-boosts";

/**
 * Spends the viewer's community currency on a suggestion. The boost ID is made
 * when the form opens and reused on retry, so a lost response never charges twice.
 */
export function CommunityBoost<T>({ endpoint, wallet, disabled, onBoosted }: {
  endpoint: string;
  wallet: CommunityWallet;
  disabled?: boolean;
  onBoosted: (item: T, wallet: CommunityWallet) => void;
}) {
  const [boostId, setBoostId] = useState<string | null>(null);
  const [amount, setAmount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = Math.min(wallet.balance, 10_000);

  async function boost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!boostId) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ boostId, amount: Number(amount) }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível dar o boost agora.");
      onBoosted(payload.data.item as T, payload.data.wallet as CommunityWallet);
      setBoostId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível dar o boost agora.");
    } finally { setBusy(false); }
  }

  if (!boostId) {
    return (
      <Button type="button" size="sm" variant="neutral" disabled={disabled || wallet.balance < 1}
        title={wallet.balance < 1 ? `Você não tem ${wallet.currencyLabel} para dar boost.` : undefined}
        onClick={() => { setBoostId(crypto.randomUUID()); setError(null); setAmount(String(Math.min(10, Math.max(1, max)))); }}>
        <Zap className="size-4" aria-hidden="true" />
        Dar boost
      </Button>
    );
  }

  return (
    <form onSubmit={boost} className="grid w-full gap-2">
      <label className="grid gap-1 text-sm font-bold">Quantos {wallet.currencyLabel}? (você tem {wallet.balance.toLocaleString("pt-BR")})
        <Input type="number" min={1} max={max} step={1} required value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} />
      </label>
      {error ? <p role="alert" className="text-sm">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy}>{busy ? "Enviando…" : "Confirmar boost"}</Button>
        <Button type="button" size="sm" variant="neutral" disabled={busy} onClick={() => setBoostId(null)}>Cancelar</Button>
      </div>
    </form>
  );
}
