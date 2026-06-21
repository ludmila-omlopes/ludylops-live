"use client";

import { useEffect, useState, useTransition } from "react";
import { BadgeDollarSign, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GameSuggestionWithMeta } from "@/lib/types";
import { cn, formatPipetz } from "@/lib/utils";

type GameSearchResult = {
  igdbId: number;
  name: string;
  releaseYear: number | null;
  coverImageUrl: string | null;
  platforms: string[];
  genres: string[];
};

export type GameSuggestionViewMode = "list" | "grid";

function mapSuggestionError(message: string) {
  switch (message) {
    case "saldo_insuficiente":
      return "Saldo insuficiente.";
    case "suggestion_not_found":
      return "Sugestão não encontrada.";
    case "suggestion_not_open":
      return "Só dá para dar boost em sugestões abertas.";
    case "invalid_amount":
      return "Digite um valor inteiro positivo.";
    default:
      return message;
  }
}

function formatCompletionTime(minutes: number | null) {
  if (!minutes) {
    return "Sem dado confiável";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h${String(remainingMinutes).padStart(2, "0")}`;
}

function formatMultiplier(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}x`;
}

function formatSteamPriceCents(value: number, currency: string | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency ?? "BRL",
  }).format(value / 100);
}

function getSteamPriceLabel(suggestion: GameSuggestionWithMeta) {
  const steamStore = suggestion.steamStore;
  if (!steamStore) {
    return null;
  }

  if (steamStore.isFree) {
    return "Grátis";
  }

  if (typeof steamStore.finalPriceCents !== "number") {
    return null;
  }

  return formatSteamPriceCents(steamStore.finalPriceCents, steamStore.currency);
}

function getSteamOriginalPriceLabel(suggestion: GameSuggestionWithMeta) {
  const steamStore = suggestion.steamStore;
  if (
    !steamStore ||
    typeof steamStore.initialPriceCents !== "number" ||
    typeof steamStore.finalPriceCents !== "number" ||
    steamStore.initialPriceCents <= steamStore.finalPriceCents
  ) {
    return null;
  }

  return formatSteamPriceCents(steamStore.initialPriceCents, steamStore.currency);
}

function buildHowLongToBeatTooltip(suggestion: GameSuggestionWithMeta) {
  const howLongToBeat = suggestion.howLongToBeat;

  return [
    ["História", howLongToBeat?.mainStoryMinutes ?? null],
    ["História + extras", howLongToBeat?.mainExtraMinutes ?? null],
    ["Completista", howLongToBeat?.completionistMinutes ?? null],
  ].map(([label, minutes]) => ({
    label,
    value: formatCompletionTime(minutes as number | null),
  }));
}

export function GameSuggestionCard({
  suggestion,
  viewMode = "list",
  loggedIn = false,
  canBoost = false,
  canEditCatalog = false,
  onBoostSuccess,
  onCatalogUpdate,
}: {
  suggestion: GameSuggestionWithMeta;
  index?: number;
  viewMode?: GameSuggestionViewMode;
  loggedIn?: boolean;
  canBoost?: boolean;
  canEditCatalog?: boolean;
  viewerBalance?: number | null;
  onBoostSuccess?: (suggestion: GameSuggestionWithMeta, spentAmount: number) => void;
  onCatalogUpdate?: (suggestion: GameSuggestionWithMeta) => void;
}) {
  const [boostAmount, setBoostAmount] = useState("");
  const [isEditingCatalog, setIsEditingCatalog] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState(suggestion.name);
  const [catalogResults, setCatalogResults] = useState<GameSearchResult[]>([]);
  const [selectedCatalogResult, setSelectedCatalogResult] = useState<GameSearchResult | null>(null);
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleBoost() {
    const parsed = Number.parseInt(boostAmount, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setFeedback("Digite um valor inteiro positivo.");
      return;
    }

    if (!canBoost) {
      setFeedback(loggedIn ? "Sua conta ainda não está pronta para dar boost." : "Faça login para dar boost.");
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/me/game-suggestions/${suggestion.id}/boost`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ amount: parsed }),
        });

        const payload = (await response.json()) as {
          ok: boolean;
          error?: string;
          data?: GameSuggestionWithMeta;
        };

        if (!response.ok || !payload.ok || !payload.data) {
          setFeedback(mapSuggestionError(payload.error ?? "Falha ao dar boost."));
          return;
        }

        onBoostSuccess?.(payload.data, parsed);
        setBoostAmount("");
        setFeedback("Boost enviado.");
      } catch {
        setFeedback("Falha ao dar boost.");
      }
    });
  }

  useEffect(() => {
    if (!isEditingCatalog) {
      return;
    }

    const query = catalogQuery.trim();
    if (query.length < 2) {
      setCatalogResults([]);
      setIsSearchingCatalog(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearchingCatalog(true);

      try {
        const response = await fetch(`/api/games/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          ok: boolean;
          data?: GameSearchResult[];
        };

        if (!response.ok || !payload.ok) {
          setCatalogResults([]);
          setFeedback("Busca IGDB indisponível.");
          return;
        }

        setCatalogResults(payload.data ?? []);
      } catch (error) {
        if ((error as DOMException).name !== "AbortError") {
          setCatalogResults([]);
          setFeedback("Busca IGDB indisponível.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingCatalog(false);
        }
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [catalogQuery, isEditingCatalog]);

  function applyCatalogResult(game: GameSearchResult) {
    setFeedback(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/game-suggestions/${suggestion.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          igdbId: game.igdbId,
          canonicalName: game.name,
          coverImageUrl: game.coverImageUrl,
          releaseYear: game.releaseYear,
          platforms: game.platforms,
          genres: game.genres,
        }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: GameSuggestionWithMeta;
      };

      if (!response.ok || !payload.ok || !payload.data) {
        setFeedback(mapSuggestionError(payload.error ?? "Falha ao atualizar jogo."));
        return;
      }

      onCatalogUpdate?.(payload.data);
      setCatalogQuery(payload.data.name);
      setCatalogResults([]);
      setSelectedCatalogResult(null);
      setIsEditingCatalog(false);
      setFeedback("Jogo atualizado via IGDB.");
    });
  }

  const metadata = [
    suggestion.releaseYear,
    ...suggestion.platforms.slice(0, 3),
    ...suggestion.genres.slice(0, 2),
  ].filter(Boolean);
  const displayName = suggestion.canonicalName ?? suggestion.name;
  const completionMinutes = suggestion.howLongToBeat?.mainStoryMinutes ?? null;
  const howLongToBeatTooltip = buildHowLongToBeatTooltip(suggestion);
  const howLongToBeatTooltipId = `hltb-times-${suggestion.id}`;
  const steamPriceLabel = getSteamPriceLabel(suggestion);
  const steamOriginalPriceLabel = getSteamOriginalPriceLabel(suggestion);
  const metadataText = [
    ...metadata.map(String),
    suggestion.igdbId ? `IGDB #${suggestion.igdbId}` : null,
  ]
    .filter(Boolean)
    .join(" / ");
  const isGridMode = viewMode === "grid";

  return (
    <article
      className={cn(
        "card-brutal relative overflow-hidden bg-[var(--color-paper)] p-0",
        isGridMode && "self-start",
      )}
    >
      <div
        className={cn(
          "grid gap-0",
          !isGridMode && "md:grid-cols-[minmax(150px,190px)_1fr_auto]",
        )}
      >
        <div
          className={cn(
            "relative border-b-2 border-[var(--color-ink)] bg-[var(--color-paper)]",
            isGridMode ? "aspect-[4/3]" : "min-h-64 md:min-h-0 md:border-b-0 md:border-r-1",
          )}
        >
          {suggestion.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={suggestion.coverImageUrl}
              alt={`Capa de ${displayName}`}
              className={cn(
                "h-full w-full object-cover",
                !isGridMode && "min-h-64 md:min-h-0",
              )}
            />
          ) : (
            <div
              className={cn(
                "flex h-full w-full items-center justify-center bg-[var(--color-lavender)] px-4 text-center",
                !isGridMode && "min-h-64 md:min-h-0",
              )}
            >
              <span
                className="text-xl font-bold uppercase"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {displayName}
              </span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col p-5 sm:p-6">
          <div className="min-w-0">
            <h3
              className={cn(
                "font-bold leading-none",
                isGridMode ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl",
              )}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {displayName}
            </h3>
            {metadataText ? (
              <p className="mono mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)] opacity-70">
                {metadataText}
              </p>
            ) : null}
            {suggestion.psPlusAvailable ? (
              <div className="mt-3">
                {suggestion.psPlusProductUrl ? (
                  <a
                    href={suggestion.psPlusProductUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="PlayStation Plus Deluxe"
                    className="accent-button inline-flex h-6 items-center gap-1.5 rounded-[3px] border border-[var(--color-ink)] px-2 text-[10px] font-black leading-none"
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-[3px] bg-[var(--color-admin)] text-[11px] font-black leading-none text-[var(--color-accent-ink)]">
                      +
                    </span>
                    PlayStation Plus
                  </a>
                ) : (
                  <span
                    aria-label="PlayStation Plus Deluxe"
                    className="accent-button inline-flex h-6 items-center gap-1.5 rounded-[3px] border border-[var(--color-ink)] px-2 text-[10px] font-black leading-none"
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-[3px] bg-[var(--color-admin)] text-[11px] font-black leading-none text-[var(--color-accent-ink)]">
                      +
                    </span>
                    PlayStation Plus
                  </span>
                )}
              </div>
            ) : null}
            {steamPriceLabel ? (
              <div className="mt-3">
                <a
                  href={suggestion.steamStore?.storeUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Preço na Steam: ${steamPriceLabel}`}
                  className="inline-flex h-7 items-center gap-1.5 rounded-[3px] border border-[var(--color-ink)] bg-[var(--color-sky)] px-2 text-[10px] font-black leading-none text-[var(--color-ink)] shadow-[2px_2px_0_var(--color-ink)]"
                >
                  <BadgeDollarSign className="h-4 w-4" aria-hidden="true" />
                  Steam {steamPriceLabel}
                  {steamOriginalPriceLabel ? (
                    <span className="line-through opacity-70">{steamOriginalPriceLabel}</span>
                  ) : null}
                  {suggestion.steamStore?.discountPercent ? (
                    <span className="rounded-[3px] bg-[var(--color-ink)] px-1 py-0.5 text-[var(--color-paper)]">
                      -{suggestion.steamStore.discountPercent}%
                    </span>
                  ) : null}
                </a>
              </div>
            ) : null}
          </div>

          {suggestion.description ? (
            <p className="mt-4 max-w-3xl text-sm leading-6 opacity-85">
              {suggestion.description}
            </p>
          ) : null}

          <div className="mono mt-3 inline-flex max-w-full items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)] opacity-75">
            <span
              className="group relative inline-flex shrink-0 cursor-help items-center"
              tabIndex={0}
              aria-label="Ver tempos do HowLongToBeat"
              aria-describedby={howLongToBeatTooltipId}
            >
              <Clock3 className="h-3 w-3 text-[var(--color-purple-bold)]" aria-hidden="true" />
              <span
                id={howLongToBeatTooltipId}
                role="tooltip"
                className="invisible absolute bottom-full left-0 z-20 mb-1 w-44 border-2 border-[var(--color-ink)] bg-[var(--color-paper)] p-2 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--color-ink)] opacity-0 shadow-[3px_3px_0_var(--color-ink)] transition-opacity group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100"
              >
                {howLongToBeatTooltip.map((entry) => (
                  <span key={entry.label} className="flex justify-between gap-3">
                    <span className="text-[var(--color-ink-soft)]">{entry.label}</span>
                    <strong>{entry.value}</strong>
                  </span>
                ))}
              </span>
            </span>
            <span className="truncate">
              Tempo médio:{" "}
              <strong className="text-[var(--color-ink)]">
                {formatCompletionTime(completionMinutes)}
              </strong>
            </span>
          </div>

          {suggestion.appliedBoostModifiers.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestion.appliedBoostModifiers.map((modifier) => (
                <span key={modifier.key} className="retro-label neutral-chip">
                  {modifier.label} {formatMultiplier(modifier.multiplier)}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-auto pt-5">
            <p className="mono text-xs opacity-75">
              Sugerido por {suggestion.suggestedBy}
            </p>
            {suggestion.viewerBoostTotal > 0 ? (
              <p className="mono mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                seu boost: {formatPipetz(suggestion.viewerBoostTotal)}
              </p>
            ) : null}
          </div>

          {canEditCatalog ? (
            <div className="mt-4 border-t-2 border-[var(--color-admin)] bg-[var(--color-admin)]/15 p-3">
              <p className="mono mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-admin)]">
                Ação admin
              </p>
              {isEditingCatalog ? (
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="text"
                      value={catalogQuery}
                      onChange={(event) => setCatalogQuery(event.target.value)}
                      placeholder="Buscar no IGDB"
                      className="h-10 max-w-72 border-2 px-3 py-2 text-xs"
                    />
                    <Button
                      type="button"
                      size="xs"
                      variant="neutral"
                      onClick={() => {
                        setIsEditingCatalog(false);
                        setCatalogResults([]);
                        setSelectedCatalogResult(null);
                        setCatalogQuery(suggestion.name);
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                  {isSearchingCatalog ? (
                    <p className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                      Buscando no IGDB...
                    </p>
                  ) : null}
                  {catalogResults.length > 0 ? (
                    <div className="grid gap-1">
                      {catalogResults.map((game) => (
                        <button
                          key={game.igdbId}
                          type="button"
                          onClick={() => setSelectedCatalogResult(game)}
                          disabled={isPending}
                          className="border border-[var(--color-admin)] bg-[var(--color-paper)] px-3 py-2 text-left text-xs font-bold hover:bg-[var(--color-admin)] hover:text-[var(--color-admin-ink)] focus-visible:bg-[var(--color-admin)] focus-visible:text-[var(--color-admin-ink)] focus-visible:outline-none"
                        >
                          {game.name}
                          {game.releaseYear ? ` (${game.releaseYear})` : ""}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  variant="admin"
                  onClick={() => {
                    setCatalogQuery(suggestion.name);
                    setIsEditingCatalog(true);
                  }}
                >
                  Corrigir IGDB
                </Button>
              )}
            </div>
          ) : null}
        </div>

        <aside
          className={cn(
            "flex items-start justify-between gap-4 border-t-2 border-[var(--color-ink)] bg-[var(--color-paper)] p-5",
            !isGridMode && "md:min-w-36 md:flex-col md:border-l-1 md:border-t-0",
          )}
        >
          <div>
            <p
              className="text-3xl font-bold leading-none text-[var(--color-purple-bold)] sm:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {formatPipetz(suggestion.boostedScore)}
            </p>
            <p className="mono mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
              prioridade
            </p>
            {suggestion.boostedScore !== suggestion.totalVotes ? (
              <p className="mono mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                votos reais: {formatPipetz(suggestion.totalVotes)}
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      {suggestion.status === "open" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-[var(--color-ink)] bg-[var(--color-paper)]/55 px-5 py-3">
          <span className="mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
            Votar nessa sugestão
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min="1"
              placeholder="Pipetz"
              value={boostAmount}
              onChange={(e) => setBoostAmount(e.target.value)}
              className="h-10 w-24 border-2 px-3 py-2 text-xs"
            />
            <Button
              type="button"
              onClick={handleBoost}
              disabled={isPending}
              size="xs"
              variant="accent"
            >
              {isPending ? "Enviando..." : "Boost"}
            </Button>
          </div>
        </div>
      ) : null}

      {!loggedIn ? (
        <p className="px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
          faça login para sugerir e dar boost
        </p>
      ) : null}

      {feedback ? (
        <div className="px-5 pb-4">
          <div className="sticker sticker-pop accent-chip inline-flex px-2 py-1 text-xs">
            {feedback}
          </div>
        </div>
      ) : null}

      {selectedCatalogResult ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-backdrop)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`confirm-igdb-${suggestion.id}`}
        >
          <div className="w-full max-w-xl border-2 border-[var(--color-ink)] bg-[var(--color-paper)] text-[var(--color-ink)] shadow-purple">
            <div className="grid gap-0 sm:grid-cols-[150px_1fr]">
              <div className="border-b-2 border-[var(--color-ink)] bg-[var(--color-lavender)] sm:border-b-0 sm:border-r-1">
                {selectedCatalogResult.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedCatalogResult.coverImageUrl}
                    alt={`Capa de ${selectedCatalogResult.name}`}
                    className="aspect-[3/4] h-auto w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[3/4] w-full items-center justify-center px-4 text-center text-sm font-bold uppercase">
                    Sem imagem
                  </div>
                )}
              </div>

              <div className="p-5">
                <h3
                  id={`confirm-igdb-${suggestion.id}`}
                  className="text-2xl font-bold"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {selectedCatalogResult.name}
                </h3>
                <p className="mono mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                  IGDB #{selectedCatalogResult.igdbId}
                  {selectedCatalogResult.releaseYear ? ` / ${selectedCatalogResult.releaseYear}` : ""}
                </p>
                {selectedCatalogResult.platforms.length > 0 ? (
                  <p className="mt-4 text-sm">
                    <strong>Plataformas:</strong> {selectedCatalogResult.platforms.join(", ")}
                  </p>
                ) : null}
                {selectedCatalogResult.genres.length > 0 ? (
                  <p className="mt-2 text-sm">
                    <strong>Gêneros:</strong> {selectedCatalogResult.genres.join(", ")}
                  </p>
                ) : null}
                <p className="mt-4 text-xs text-[var(--color-ink-soft)]">
                  Isso vai atualizar apenas o cadastro do jogo nesta sugestão. Quem sugeriu e o texto continuam iguais.
                </p>

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="neutral"
                    onClick={() => setSelectedCatalogResult(null)}
                    disabled={isPending}
                  >
                    Fechar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="admin"
                    onClick={() => applyCatalogResult(selectedCatalogResult)}
                    disabled={isPending}
                  >
                    {isPending ? "Atualizando..." : "OK"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
