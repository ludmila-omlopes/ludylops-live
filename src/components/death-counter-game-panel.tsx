"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActiveDeathCounterGameRecord } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function DeathCounterGamePanel({
  initialGame,
  existingGames,
}: {
  initialGame: ActiveDeathCounterGameRecord | null;
  existingGames: ActiveDeathCounterGameRecord[];
}) {
  const router = useRouter();
  const [activeGame, setActiveGame] = useState(initialGame);
  const [gameName, setGameName] = useState(initialGame?.scopeLabel ?? "");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveGame() {
    const nextName = gameName.trim();
    if (!nextName) {
      setFeedback("Digite o nome do jogo atual.");
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/death-counter-game", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            action: "set",
            gameName: nextName,
          }),
        });

        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
          data?: ActiveDeathCounterGameRecord | null;
        };

        if (!response.ok || !payload.ok || !payload.data) {
          setFeedback(payload.error ?? "Falha ao salvar o jogo ativo.");
          return;
        }

        setActiveGame(payload.data);
        setGameName(payload.data.scopeLabel);
        setFeedback("Jogo ativo atualizado.");
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao salvar o jogo ativo.");
      }
    });
  }

  function clearGame() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/death-counter-game", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            action: "clear",
          }),
        });

        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
          data?: ActiveDeathCounterGameRecord | null;
        };

        if (!response.ok || !payload.ok) {
          setFeedback(payload.error ?? "Falha ao limpar o jogo ativo.");
          return;
        }

        setActiveGame(null);
        setGameName("");
        setFeedback("Jogo ativo removido. O contador voltou ao escopo global.");
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao limpar o jogo ativo.");
      }
    });
  }

  return (
    <div className="panel surface-section p-6">
      <h2
        className="text-2xl font-bold uppercase"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Jogo ativo
      </h2>
      <p className="mt-3 text-sm leading-7 text-[var(--color-ink-soft)]">
        Os comandos simples do chat, como <span className="font-black text-[var(--color-ink)]">!death+</span>, <span className="font-black text-[var(--color-ink)]">!death-</span> e <span className="font-black text-[var(--color-ink)]">!deaths</span>, vao usar esse jogo quando nenhum escopo for enviado pelo Streamer.bot.
      </p>

      <div className="mt-5 card-brutal-static surface-card p-4">
        <p className="mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
          Estado atual
        </p>
        {activeGame ? (
          <>
            <p className="mt-2 text-xl font-black uppercase">{activeGame.scopeLabel}</p>
            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
              chave: <span className="font-black text-[var(--color-ink)]">{activeGame.scopeKey}</span>
            </p>
            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
              atualizado em {formatDateTime(activeGame.updatedAt)}
              {activeGame.updatedBy ? ` por ${activeGame.updatedBy}` : ""}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm font-bold text-[var(--color-ink-soft)]">
            Nenhum jogo ativo configurado. O contador segue no modo global.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full">
          <label className="mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
            Nome do jogo
          </label>
          <Input
            value={gameName}
            onChange={(event) => setGameName(event.target.value)}
            list={existingGames.length > 0 ? "death-counter-game-options" : undefined}
            placeholder="Ex.: Silksong"
            className="mt-2"
          />
          {existingGames.length > 0 ? (
            <datalist id="death-counter-game-options">
              {existingGames.map((game) => (
                <option key={game.scopeKey} value={game.scopeLabel}>
                  {game.scopeKey}
                </option>
              ))}
            </datalist>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={saveGame} disabled={isPending} variant="success" size="sm">
            {isPending ? "Salvando..." : "Salvar jogo"}
          </Button>
          <Button
            type="button"
            onClick={clearGame}
            disabled={isPending || !activeGame}
            variant="neutral"
            size="sm"
          >
            Limpar
          </Button>
        </div>
      </div>

      {feedback ? <div className="retro-label neutral-chip mt-4">{feedback}</div> : null}
    </div>
  );
}
