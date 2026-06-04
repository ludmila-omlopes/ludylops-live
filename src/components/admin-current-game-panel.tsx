"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CurrentGameRecord } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type GameSearchResult = {
  igdbId: number;
  name: string;
  releaseYear: number | null;
  coverImageUrl: string | null;
  platforms: string[];
  genres: string[];
};

export function shouldSkipGameSearch({
  query,
  selectedGameName,
  currentGameName,
}: {
  query: string;
  selectedGameName?: string | null;
  currentGameName?: string | null;
}) {
  const normalizedQuery = query.trim();

  return (
    normalizedQuery.length < 2 ||
    selectedGameName === normalizedQuery ||
    currentGameName === normalizedQuery
  );
}

export function AdminCurrentGamePanel({
  initialGame,
}: {
  initialGame: CurrentGameRecord | null;
}) {
  const router = useRouter();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [currentGame, setCurrentGame] = useState(initialGame);
  const [query, setQuery] = useState(initialGame?.name ?? "");
  const [results, setResults] = useState<GameSearchResult[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (
      shouldSkipGameSearch({
        query,
        selectedGameName: selectedGame?.name,
        currentGameName: currentGame?.name,
      })
    ) {
      setResults([]);
      setIsResultsOpen(false);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const normalizedQuery = query.trim();
      setIsSearching(true);
      setFeedback(null);

      try {
        const response = await fetch(`/api/games/search?q=${encodeURIComponent(normalizedQuery)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          ok: boolean;
          data?: GameSearchResult[];
          error?: string;
        };

        if (!response.ok || !payload.ok) {
          setResults([]);
          setFeedback(payload.error === "igdb_unavailable" ? "Busca IGDB indisponível." : "Falha ao buscar jogos.");
          return;
        }

        setResults(payload.data ?? []);
        setIsResultsOpen((payload.data ?? []).length > 0);
      } catch (error) {
        if ((error as DOMException).name !== "AbortError") {
          setResults([]);
          setIsResultsOpen(false);
          setFeedback("Falha ao buscar jogos.");
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
  }, [currentGame, query, selectedGame]);

  useEffect(() => {
    if (!isResultsOpen) {
      return;
    }

    function closeResultsOnOutsidePointer(event: PointerEvent) {
      if (!(event.target instanceof Node) || searchContainerRef.current?.contains(event.target)) {
        return;
      }

      setIsResultsOpen(false);
    }

    window.addEventListener("pointerdown", closeResultsOnOutsidePointer);

    return () => {
      window.removeEventListener("pointerdown", closeResultsOnOutsidePointer);
    };
  }, [isResultsOpen]);

  function selectGame(game: GameSearchResult) {
    setSelectedGame(game);
    setQuery(game.name);
    setResults([]);
    setIsResultsOpen(false);
  }

  function saveGame() {
    if (!selectedGame) {
      setFeedback("Escolha um jogo da lista do IGDB.");
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/current-game", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "set",
          igdbId: selectedGame.igdbId,
          name: selectedGame.name,
          releaseYear: selectedGame.releaseYear,
          coverImageUrl: selectedGame.coverImageUrl,
          platforms: selectedGame.platforms,
          genres: selectedGame.genres,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        data?: CurrentGameRecord | null;
      };

      if (!response.ok || !payload.ok || !payload.data) {
        setFeedback(payload.error ?? "Falha ao salvar jogo atual.");
        return;
      }

      setCurrentGame(payload.data);
      setSelectedGame(null);
      setQuery(payload.data.name);
      setResults([]);
      setIsResultsOpen(false);
      setFeedback("Jogo atual atualizado.");
      router.refresh();
    });
  }

  function clearGame() {
    setFeedback(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/current-game", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "clear" }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        setFeedback(payload.error ?? "Falha ao limpar jogo atual.");
        return;
      }

      setCurrentGame(null);
      setSelectedGame(null);
      setQuery("");
      setResults([]);
      setIsResultsOpen(false);
      setFeedback("Jogo atual removido.");
      router.refresh();
    });
  }

  const previewGame = selectedGame ?? currentGame;

  return (
    <div className="panel surface-section p-6">
      <p className="mono text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
        Landing page
      </p>
      <h2 className="mt-2 text-2xl font-bold uppercase" style={{ fontFamily: "var(--font-display)" }}>
        Jogo atual da live
      </h2>
      <p className="mt-3 text-sm leading-7 text-[var(--color-ink-soft)]">
        Escolha o jogo pelo IGDB para mostrar nome, capa e metadados na primeira página da comunidade.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[150px_1fr]">
        <div className="min-h-48 border-2 border-[var(--color-ink)] bg-[var(--color-lavender)]">
          {previewGame?.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewGame.coverImageUrl} alt="" className="h-full min-h-48 w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-48 items-center justify-center px-4 text-center text-sm font-black uppercase text-[var(--color-ink-soft)]">
              Sem capa
            </div>
          )}
        </div>

        <div>
          <div className="card-brutal-static surface-card p-4">
            <p className="mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
              Estado atual
            </p>
            {currentGame ? (
              <>
                <p className="mt-2 text-xl font-black uppercase">{currentGame.name}</p>
                <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                  IGDB #{currentGame.igdbId}
                  {currentGame.releaseYear ? ` / ${currentGame.releaseYear}` : ""}
                </p>
                <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                  atualizado em {formatDateTime(currentGame.updatedAt)}
                  {currentGame.updatedBy ? ` por ${currentGame.updatedBy}` : ""}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm font-bold text-[var(--color-ink-soft)]">
                Nenhum jogo atual configurado.
              </p>
            )}
          </div>

          <div ref={searchContainerRef} className="relative mt-4">
            <label className="mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
              Buscar no IGDB
            </label>
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedGame(null);
                setResults([]);
                setIsResultsOpen(false);
              }}
              placeholder="Ex.: Hades II"
              className="mt-2"
            />

            {isSearching ? (
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                Buscando no IGDB...
              </p>
            ) : null}

            {!selectedGame && isResultsOpen && results.length > 0 ? (
              <div className="absolute z-20 mt-2 grid max-h-72 w-full gap-2 overflow-auto border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-2 shadow-purple">
                {results.map((game) => (
                  <button
                    key={game.igdbId}
                    type="button"
                    onClick={() => selectGame(game)}
                    className="flex w-full items-center gap-3 border-2 border-transparent p-2 text-left hover:border-[var(--color-admin)] hover:bg-[var(--color-admin)] hover:text-[var(--color-admin-ink)] focus-visible:border-[var(--color-admin)] focus-visible:bg-[var(--color-admin)] focus-visible:text-[var(--color-admin-ink)] focus-visible:outline-none"
                  >
                    {game.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={game.coverImageUrl}
                        alt=""
                        className="h-14 w-10 shrink-0 border-2 border-[var(--color-ink)] object-cover"
                      />
                    ) : (
                      <span className="h-14 w-10 shrink-0 border-2 border-[var(--color-ink)] bg-[var(--color-lavender)]" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{game.name}</span>
                      <span className="mono mt-0.5 block truncate text-[10px] uppercase tracking-[0.12em]">
                        {[game.releaseYear, ...game.platforms.slice(0, 2)].filter(Boolean).join(" / ") || "IGDB"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={saveGame} disabled={isPending || !selectedGame} variant="admin" size="sm">
              {isPending ? "Salvando..." : "Salvar jogo atual"}
            </Button>
            <Button type="button" onClick={clearGame} disabled={isPending || !currentGame} variant="neutral" size="sm">
              Limpar
            </Button>
          </div>
        </div>
      </div>

      {feedback ? <div className="retro-label neutral-chip mt-4">{feedback}</div> : null}
    </div>
  );
}
