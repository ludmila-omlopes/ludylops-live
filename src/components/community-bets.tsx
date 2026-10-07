"use client";

import { useState } from "react";
import { Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CommunityBet, CommunityBetBoard } from "@/lib/creators/bets";
import type { CommunityWallet } from "@/lib/creators/community-boosts";

const cardClass = "hub-card flex min-w-0 flex-col gap-4 border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-5";
const formatTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const share = (pool: number, total: number) => (total ? Math.round((pool / total) * 100) : 0);

function Options({ bet }: { bet: CommunityBet }) {
  return (
    <ul className="grid gap-2">
      {bet.options.map((option) => (
        <li key={option.id} className="grid gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 break-words font-bold">
              {option.label}{bet.winningOptionId === option.id ? " · vencedora" : ""}
            </span>
            <span className="hub-muted">{option.pool.toLocaleString("pt-BR")} · {share(option.pool, bet.totalPool)}%</span>
          </div>
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-[var(--hub-edge-2,rgb(0_0_0/0.08))]">
            <span className="block h-full bg-[var(--hub-accent,var(--color-ink))]" style={{ width: `${share(option.pool, bet.totalPool)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function myResult(bet: CommunityBet, currencyLabel: string) {
  const entry = bet.myEntry;
  if (!entry) return null;
  const label = bet.options.find((option) => option.id === entry.optionId)?.label ?? "";
  const amount = `${entry.amount.toLocaleString("pt-BR")} ${currencyLabel}`;
  if (entry.refunded) return `Sua aposta de ${amount} em ${label} foi devolvida.`;
  if (bet.status === "resolved") return entry.payoutAmount ? `Você apostou ${amount} em ${label} e ganhou ${entry.payoutAmount.toLocaleString("pt-BR")} ${currencyLabel}.` : `Você apostou ${amount} em ${label} e não acertou.`;
  return `Sua aposta: ${amount} em ${label}.`;
}

function PlaceBet({ slug, bet, wallet, minBet, onPlaced }: {
  slug: string; bet: CommunityBet; wallet: CommunityWallet; minBet: number; onPlaced: (bet: CommunityBet, wallet: CommunityWallet) => void;
}) {
  const [optionId, setOptionId] = useState(bet.myEntry?.optionId ?? bet.options[0]?.id ?? "");
  const [amount, setAmount] = useState(String(minBet));
  const [placementId, setPlacementId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function place(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/c/${encodeURIComponent(slug)}/bets/${encodeURIComponent(bet.id)}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ placementId, optionId, amount: Number(amount) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível registrar a aposta.");
      onPlaced(payload.data.item as CommunityBet, payload.data.wallet as CommunityWallet);
      // A new placement gets a new ID; a retry after an error keeps the same one.
      setPlacementId(crypto.randomUUID());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível registrar a aposta.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={place} className="grid gap-3">
      <fieldset disabled={busy} className="grid gap-2">
        <legend className="mb-1 text-sm font-bold">{bet.myEntry ? "Aumentar sua aposta" : "Seu palpite"}</legend>
        {bet.options.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm">
            <input type="radio" name={`bet-${bet.id}`} value={option.id} checked={optionId === option.id}
              disabled={Boolean(bet.myEntry) && bet.myEntry?.optionId !== option.id} onChange={() => setOptionId(option.id)} />
            {option.label}
          </label>
        ))}
        <label className="grid gap-1 text-sm font-bold">Quantos {wallet.currencyLabel}? (você tem {wallet.balance.toLocaleString("pt-BR")})
          <Input type="number" min={minBet} max={Math.max(minBet, wallet.balance)} step={1} required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
      </fieldset>
      {error ? <p role="alert" className="text-sm">{error}</p> : null}
      <div><Button type="submit" size="sm" disabled={busy || wallet.balance < minBet}><Coins className="size-4" aria-hidden="true" />{busy ? "Enviando…" : "Apostar"}</Button></div>
    </form>
  );
}

export function CommunityBets({ slug, board, signedIn, signInHref, wallet }: {
  slug: string;
  board: CommunityBetBoard;
  signedIn: boolean;
  signInHref: string;
  /** The signed-in viewer's balance; bets need the community currency. */
  wallet?: CommunityWallet | null;
}) {
  const [active, setActive] = useState(board.active);
  const [currentWallet, setWallet] = useState(wallet ?? null);
  const currencyLabel = currentWallet?.currencyLabel ?? "moedas";

  return (
    <div className="grid gap-10">
      {!signedIn ? <p><a className="font-bold underline" href={signInHref}>Entre para apostar</a></p> : null}
      <section aria-labelledby="apostas-abertas" className="grid gap-6">
        <h2 id="apostas-abertas" className="text-3xl font-black">Valendo agora</h2>
        {!active.length ? <p>Nenhuma aposta aberta agora. Fique de olho na próxima.</p> : (
          <ul className="grid gap-6 lg:grid-cols-2">
            {active.map((bet) => {
              const open = bet.acceptingEntries;
              const result = myResult(bet, currencyLabel);
              return (
                <li key={bet.id} className={cardClass}>
                  <div className="grid gap-1">
                    <h3 className="break-words text-xl font-black">{bet.question}</h3>
                    <p className="hub-muted text-sm">
                      {open ? `Aberta até ${formatTime(bet.closesAt)}` : "Apostas encerradas. Aguardando o resultado."} · {bet.totalPool.toLocaleString("pt-BR")} no pote · {bet.entryCount} {bet.entryCount === 1 ? "aposta" : "apostas"}
                    </p>
                  </div>
                  <Options bet={bet} />
                  {result ? <p className="text-sm font-bold">{result}</p> : null}
                  {open && signedIn && currentWallet ? (
                    <PlaceBet slug={slug} bet={bet} wallet={currentWallet} minBet={board.minBet}
                      onPlaced={(updated, next) => { setActive((current) => current.map((entry) => (entry.id === updated.id ? updated : entry))); setWallet(next); }} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {board.finished.length ? (
        <section aria-labelledby="apostas-finalizadas" className="grid gap-6">
          <h2 id="apostas-finalizadas" className="text-3xl font-black">Já decididas</h2>
          <ul className="grid gap-6 lg:grid-cols-2">
            {board.finished.map((bet) => {
              const result = myResult(bet, currencyLabel);
              return (
                <li key={bet.id} className={cardClass}>
                  <div className="grid gap-1">
                    <h3 className="break-words text-xl font-black">{bet.question}</h3>
                    <p className="hub-muted text-sm">
                      {bet.status === "cancelled" ? "Cancelada. Todas as apostas foram devolvidas."
                        : bet.refunded ? "Ninguém acertou. Todas as apostas foram devolvidas."
                          : `Resultado: ${bet.options.find((option) => option.id === bet.winningOptionId)?.label ?? ""}`}
                    </p>
                  </div>
                  <Options bet={bet} />
                  {result ? <p className="text-sm font-bold">{result}</p> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
