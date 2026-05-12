"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GAME_SUGGESTION_CREATION_COST } from "@/lib/game-suggestions/constants";
import { validateGameSuggestionDraft } from "@/lib/game-suggestions/service";
import { formatPipetz } from "@/lib/utils";

type GameSearchResult = {
  igdbId: number;
  name: string;
  releaseYear: number | null;
  coverImageUrl: string | null;
  platforms: string[];
  genres: string[];
};

function mapSuggestionError(message: string, creationCost: number) {
  switch (message) {
    case "saldo_insuficiente":
      return `Você precisa de ${formatPipetz(creationCost)} para criar uma sugestão.`;
    case "suggestion_already_exists":
      return "Esse jogo já está na lista aberta.";
    case "invalid_name":
      return "Escreva um nome válido para o jogo.";
    default:
      return message;
  }
}

export function GameSuggestForm({
  loggedIn = false,
  canSuggest = false,
  viewerBalance,
  creationCost = GAME_SUGGESTION_CREATION_COST,
}: {
  loggedIn?: boolean;
  canSuggest?: boolean;
  viewerBalance?: number | null;
  creationCost?: number;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedGame, setSelectedGame] = useState<GameSearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<GameSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasInsufficientBalance =
    typeof viewerBalance === "number" && viewerBalance < creationCost;
  const missingBalance = hasInsufficientBalance
    ? creationCost - (viewerBalance ?? 0)
    : 0;
  const isSubmitDisabled = isPending || hasInsufficientBalance;
  const canShowSearchResults =
    searchResults.length > 0 && !selectedGame && name.trim().length >= 2;

  useEffect(() => {
    const query = name.trim();
    if (query.length < 2 || selectedGame?.name === query) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchFailed(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchFailed(false);

      try {
        const response = await fetch(`/api/games/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          ok: boolean;
          data?: GameSearchResult[];
        };

        if (!response.ok || !payload.ok) {
          setSearchResults([]);
          setSearchFailed(true);
          return;
        }

        setSearchResults(payload.data ?? []);
      } catch (error) {
        if ((error as DOMException).name !== "AbortError") {
          setSearchResults([]);
          setSearchFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [name, selectedGame]);

  function handleNameChange(value: string) {
    setName(value);
    if (selectedGame && value !== selectedGame.name) {
      setSelectedGame(null);
    }
  }

  function selectGame(game: GameSearchResult) {
    setSelectedGame(game);
    setName(game.name);
    setSearchResults([]);
    setSearchFailed(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateGameSuggestionDraft({
      name,
      description,
      igdbId: selectedGame?.igdbId,
      canonicalName: selectedGame?.name,
      coverImageUrl: selectedGame?.coverImageUrl ?? undefined,
      releaseYear: selectedGame?.releaseYear,
      platforms: selectedGame?.platforms,
      genres: selectedGame?.genres,
    });

    if (validationError) {
      setFeedback(validationError);
      return;
    }

    if (!canSuggest) {
      setFeedback(loggedIn ? "Sua conta ainda não está pronta para sugerir." : "Faça login para sugerir.");
      return;
    }

    if (hasInsufficientBalance) {
      setFeedback(`Faltam ${formatPipetz(missingBalance)} para criar uma sugestão.`);
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const response = await fetch("/api/me/game-suggestions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          igdbId: selectedGame?.igdbId,
          canonicalName: selectedGame?.name,
          coverImageUrl: selectedGame?.coverImageUrl ?? undefined,
          releaseYear: selectedGame?.releaseYear,
          platforms: selectedGame?.platforms,
          genres: selectedGame?.genres,
        }),
      });

      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setFeedback(mapSuggestionError(payload.error ?? "Falha ao enviar sugestão.", creationCost));
        return;
      }

      setName("");
      setDescription("");
      setSelectedGame(null);
      setSearchResults([]);
      setFeedback(`Sugestão enviada. ${formatPipetz(creationCost)} debitados.`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="panel surface-section relative overflow-hidden border-2 p-5 text-[var(--color-ink)] sm:p-6"
    >
      <div className="bg-dots-light pointer-events-none absolute inset-0 opacity-15" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3
              className="text-lg font-bold uppercase"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Sugira um jogo
            </h3>
            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
              Se tiver algo que você quer muito me ver jogando, manda aqui.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="retro-label accent-chip !rounded-none !border !shadow-none">
              custa {formatPipetz(creationCost)}
            </span>
            {typeof viewerBalance === "number" ? (
              <span className="retro-label neutral-chip !rounded-none !border !shadow-none">
                saldo {formatPipetz(viewerBalance)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="relative">
            <Input
              type="text"
              placeholder="Nome do jogo"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              minLength={2}
              maxLength={120}
              autoComplete="off"
              className="border-2"
            />

            {selectedGame ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[var(--radius)] border-2 border-[var(--color-ink)] bg-[var(--color-mint)] px-3 py-2 text-xs font-bold">
                <span>
                  IGDB #{selectedGame.igdbId}
                  {selectedGame.releaseYear ? ` - ${selectedGame.releaseYear}` : ""}
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="neutral"
                  onClick={() => setSelectedGame(null)}
                >
                  trocar
                </Button>
              </div>
            ) : null}

            {isSearching ? (
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                buscando no IGDB...
              </p>
            ) : null}

            {searchFailed ? (
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                busca indisponivel; voce ainda pode enviar pelo nome
              </p>
            ) : null}

            {canShowSearchResults ? (
              <div className="absolute z-20 mt-2 grid max-h-72 w-full gap-2 overflow-auto rounded-[var(--radius)] border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-2 shadow-purple">
                {searchResults.map((game) => (
                  <button
                    key={game.igdbId}
                    type="button"
                    onClick={() => selectGame(game)}
                    className="flex w-full items-center gap-3 rounded-[calc(var(--radius)-2px)] border-2 border-transparent p-2 text-left hover:border-[var(--color-ink)] hover:bg-[var(--color-sky)] focus-visible:border-[var(--color-ink)] focus-visible:bg-[var(--color-sky)] focus-visible:outline-none"
                  >
                    {game.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={game.coverImageUrl}
                        alt=""
                        className="h-14 w-10 shrink-0 rounded-sm border-2 border-[var(--color-ink)] object-cover"
                      />
                    ) : (
                      <span className="h-14 w-10 shrink-0 rounded-sm border-2 border-[var(--color-ink)] bg-[var(--color-lavender)]" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{game.name}</span>
                      <span className="mono mt-0.5 block truncate text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                        {[game.releaseYear, ...game.platforms.slice(0, 2)].filter(Boolean).join(" / ") || "IGDB"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <Textarea
            placeholder="Por que eu deveria jogar isso? (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={500}
            className="min-h-28 border-2 font-medium"
          />
          <Button
            type="submit"
            disabled={isSubmitDisabled}
            size="lg"
            className="w-full disabled:opacity-100 sm:w-fit"
          >
            {isPending
              ? "Enviando..."
              : `Enviar sugestão por ${formatPipetz(creationCost)}`}
          </Button>
        </div>

        {!loggedIn ? (
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
            faça login para sugerir e dar boost
          </p>
        ) : null}

        {loggedIn && hasInsufficientBalance ? (
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
            faltam {formatPipetz(missingBalance)} para liberar uma nova sugestão
          </p>
        ) : null}

        {feedback ? (
          <div className="sticker sticker-pop accent-chip mt-3 inline-flex px-3 py-1.5 text-sm">
            {feedback}
          </div>
        ) : null}
      </div>
    </form>
  );
}
