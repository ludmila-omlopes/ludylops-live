"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LiveLikeGoalAdminRecord } from "@/lib/types";
import { formatDateTime, formatPipetz } from "@/lib/utils";

export function AdminLiveLikeGoalsPanel({
  initialGoals,
}: {
  initialGoals: LiveLikeGoalAdminRecord[];
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [targetLikeCount, setTargetLikeCount] = useState("30");
  const [rewardAmount, setRewardAmount] = useState("100");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parsedTarget = Number.parseInt(targetLikeCount, 10);
  const parsedReward = Number.parseInt(rewardAmount, 10);
  const canSubmit = Number.isInteger(parsedTarget) && parsedTarget > 0 && Number.isInteger(parsedReward) && parsedReward > 0;

  function submitGoal() {
    if (!canSubmit) {
      setFeedback("Informe likes e recompensa válidos.");
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/live-like-goals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || undefined,
          targetLikeCount: parsedTarget,
          rewardAmount: parsedReward,
          isActive: true,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setFeedback(payload.error ?? "Falha ao salvar meta de likes.");
        return;
      }

      setLabel("");
      setTargetLikeCount("30");
      setRewardAmount("100");
      setFeedback("Meta de likes salva.");
      router.refresh();
    });
  }

  function deleteGoal(goalId: string) {
    setFeedback(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/live-like-goals/${goalId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setFeedback(payload.error ?? "Falha ao remover meta de likes.");
        return;
      }
      setFeedback("Meta de likes removida.");
      router.refresh();
    });
  }

  function toggleGoal(goal: LiveLikeGoalAdminRecord) {
    setFeedback(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/live-like-goals/${goal.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: goal.label ?? undefined,
          targetLikeCount: goal.targetLikeCount,
          rewardAmount: goal.rewardAmount,
          isActive: !goal.isActive,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setFeedback(payload.error ?? "Falha ao atualizar meta de likes.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="panel surface-section p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mono text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
            Metas de likes
          </p>
          <h2 className="mt-2 text-3xl uppercase" style={{ fontFamily: "var(--font-display)" }}>
            Recompensas da live
          </h2>
        </div>
        {feedback ? <div className="retro-label neutral-chip max-w-sm">{feedback}</div> : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_150px_170px_auto]">
        <label className="grid gap-2">
          <span className="text-sm font-black uppercase tracking-[0.14em]">Nome</span>
          <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ex.: Meta 30 likes" />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-black uppercase tracking-[0.14em]">Likes</span>
          <Input type="number" min={1} value={targetLikeCount} onChange={(event) => setTargetLikeCount(event.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-black uppercase tracking-[0.14em]">Pipetz</span>
          <Input type="number" min={1} value={rewardAmount} onChange={(event) => setRewardAmount(event.target.value)} />
        </label>
        <Button type="button" onClick={submitGoal} disabled={isPending || !canSubmit} variant="success" className="self-end">
          Salvar
        </Button>
      </div>

      <div className="mt-6 grid gap-3">
        {initialGoals.length === 0 ? (
          <p className="card-flat bg-[var(--color-paper)] p-4 text-sm font-bold text-[var(--color-ink-soft)]">
            Nenhuma meta cadastrada.
          </p>
        ) : null}
        {initialGoals.map((goal) => (
          <article key={goal.id} className="card-flat grid gap-3 bg-[var(--color-paper)] p-4 lg:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black uppercase">{goal.label || `${goal.targetLikeCount} likes`}</h3>
                <span className="badge-brutal bg-[var(--color-mint)] px-2 py-1 text-[10px] text-[var(--color-accent-ink)]">
                  {goal.isActive ? "ativa" : "pausada"}
                </span>
              </div>
              <p className="mt-1 text-sm font-bold text-[var(--color-ink-soft)]">
                Ao bater {goal.targetLikeCount} likes, cada viewer presente recebe {formatPipetz(goal.rewardAmount)} pipetz.
              </p>
              <p className="mt-1 text-xs font-bold text-[var(--color-ink-soft)]">
                Presença: viewers com registro de presença nos últimos 5 minutos.
              </p>
              {goal.lastReward ? (
                <p className="mt-2 text-xs font-bold text-[var(--color-ink-soft)]">
                  Último pagamento: {formatDateTime(goal.lastReward.paidAt)} para {goal.lastReward.rewardedViewerCount} viewers.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start">
              <Button type="button" variant="neutral" size="sm" onClick={() => toggleGoal(goal)} disabled={isPending}>
                {goal.isActive ? "Pausar" : "Ativar"}
              </Button>
              <Button type="button" variant="danger" size="sm" onClick={() => deleteGoal(goal.id)} disabled={isPending}>
                Remover
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
