"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  GameSuggestionBoostSettingsRecord,
  GameSuggestionWithMeta,
} from "@/lib/types";
import { cn, formatDateTime, formatPipetz } from "@/lib/utils";

type GameSuggestionStatus = GameSuggestionWithMeta["status"];

type BoostSettingField = keyof Pick<
  GameSuggestionBoostSettingsRecord,
  "psPlusMultiplier" | "shortGameMultiplier" | "adminSuggestionMultiplier"
>;

const boostSettingFields: Array<{
  key: BoostSettingField;
  label: string;
  description: string;
}> = [
  {
    key: "psPlusMultiplier",
    label: "Disponível na PS Plus",
    description: "Aplica quando a sugestão aparece no catálogo PlayStation Plus.",
  },
  {
    key: "shortGameMultiplier",
    label: "Menos de 10h no HLTB",
    description: "Aplica quando o tempo de história principal do HowLongToBeat fica abaixo de 10h.",
  },
  {
    key: "adminSuggestionMultiplier",
    label: "Enviada pelo admin",
    description: "Aplica quando o viewer que enviou a sugestão usa um e-mail de admin.",
  },
];

const statusLabels: Record<GameSuggestionWithMeta["status"], string> = {
  open: "Aberta",
  accepted: "Aceita",
  played: "Jogada",
  rejected: "Rejeitada",
};

const statusFilterOptions: Array<{ status: GameSuggestionStatus; label: string }> = [
  { status: "open", label: "Abertas" },
  { status: "accepted", label: "Aceitas" },
  { status: "played", label: "Já jogadas" },
  { status: "rejected", label: "Recusadas" },
];

const DEFAULT_VISIBLE_STATUSES: GameSuggestionStatus[] = ["open", "accepted"];

const statusBgMap: Record<GameSuggestionWithMeta["status"], string> = {
  open: "var(--color-sky)",
  accepted: "var(--color-mint)",
  played: "var(--color-lavender)",
  rejected: "var(--color-periwinkle)",
};

const INITIAL_VISIBLE_GAME_SUGGESTIONS = 6;

function mapSuggestionError(message: string) {
  switch (message) {
    case "suggestion_not_found":
      return "Sugestão não encontrada.";
    default:
      return message;
  }
}

function toBoostFormState(settings: GameSuggestionBoostSettingsRecord) {
  return {
    psPlusMultiplier: String(settings.psPlusMultiplier),
    shortGameMultiplier: String(settings.shortGameMultiplier),
    adminSuggestionMultiplier: String(settings.adminSuggestionMultiplier),
  };
}

function formatMultiplier(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}x`;
}

export function AdminGameSuggestionsPanel({
  suggestions,
  boostSettings: initialBoostSettings,
  embedded = false,
}: {
  suggestions: GameSuggestionWithMeta[];
  boostSettings: GameSuggestionBoostSettingsRecord;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [boostSettings, setBoostSettings] = useState(initialBoostSettings);
  const [boostForm, setBoostForm] = useState(toBoostFormState(initialBoostSettings));
  const [isPending, startTransition] = useTransition();
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [visibleStatuses, setVisibleStatuses] = useState<GameSuggestionStatus[]>(DEFAULT_VISIBLE_STATUSES);
  const filteredSuggestions = suggestions.filter((suggestion) => visibleStatuses.includes(suggestion.status));
  const visibleSuggestions = showAllSuggestions
    ? filteredSuggestions
    : filteredSuggestions.slice(0, INITIAL_VISIBLE_GAME_SUGGESTIONS);
  const hiddenSuggestionCount = Math.max(filteredSuggestions.length - visibleSuggestions.length, 0);

  function toggleStatusFilter(status: GameSuggestionStatus) {
    setShowAllSuggestions(false);
    setVisibleStatuses((currentStatuses) =>
      currentStatuses.includes(status)
        ? currentStatuses.filter((currentStatus) => currentStatus !== status)
        : [...currentStatuses, status]
    );
  }

  function updateBoostField(field: BoostSettingField, value: string) {
    setBoostForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function saveBoostSettings() {
    const payload = {
      psPlusMultiplier: Number(boostForm.psPlusMultiplier),
      shortGameMultiplier: Number(boostForm.shortGameMultiplier),
      adminSuggestionMultiplier: Number(boostForm.adminSuggestionMultiplier),
    };

    if (Object.values(payload).some((value) => !Number.isFinite(value) || value < 0 || value > 10)) {
      setFeedback("Use multiplicadores entre 0 e 10.");
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/game-suggestions/boost-settings", {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const result = (await response.json()) as {
          ok?: boolean;
          error?: string;
          data?: GameSuggestionBoostSettingsRecord;
        };

        if (!response.ok || !result.ok || !result.data) {
          setFeedback(result.error ?? "Falha ao salvar multiplicadores.");
          return;
        }

        setBoostSettings(result.data);
        setBoostForm(toBoostFormState(result.data));
        setFeedback("Multiplicadores atualizados.");
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao salvar multiplicadores.");
      }
    });
  }

  function submitStatus(suggestionId: string, status: GameSuggestionWithMeta["status"]) {
    setFeedback(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/game-suggestions/${suggestionId}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setFeedback(mapSuggestionError(payload.error ?? "Falha ao atualizar sugestão."));
        return;
      }

      setFeedback("Status atualizado.");
      router.refresh();
    });
  }

  const content = (
    <>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              className="text-3xl uppercase"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Fila de sugestões
            </h2>
          </div>
          {feedback ? (
            <div className="retro-label neutral-chip">
              {feedback}
            </div>
          ) : null}
        </div>

        <div className="mt-6 panel surface-section p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3
                className="text-2xl font-bold uppercase"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Multiplicadores
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-ink-soft)]">
                Quando mais de um critério se aplica, os multiplicadores são multiplicados entre si.
                A pontuação efetiva é arredondada e usada para ordenar as sugestões.
              </p>
            </div>
            {boostSettings.updatedAt ? (
              <span className="text-sm font-bold text-[var(--color-ink-soft)]">
                Atualizado em {formatDateTime(boostSettings.updatedAt)}
                {boostSettings.updatedBy ? ` por ${boostSettings.updatedBy}` : ""}
              </span>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {boostSettingFields.map((field) => (
              <label key={field.key} className="card-brutal-static surface-card grid gap-3 p-4">
                <div>
                  <span className="text-sm font-black uppercase tracking-[0.14em]">
                    {field.label}
                  </span>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-ink-soft)]">
                    {field.description}
                  </p>
                </div>
                <span className="retro-label accent-chip w-fit">
                  atual {formatMultiplier(boostSettings[field.key])}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  step={0.05}
                  value={boostForm[field.key]}
                  onChange={(event) => updateBoostField(field.key, event.target.value)}
                />
              </label>
            ))}
          </div>

          <div className="mt-5">
            <Button type="button" onClick={saveBoostSettings} disabled={isPending} variant="success" size="sm">
              {isPending ? "Salvando..." : "Salvar multiplicadores"}
            </Button>
          </div>
        </div>

        <div className="mt-6 panel surface-section p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3
                className="text-2xl font-bold uppercase"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Status das sugestões
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {statusFilterOptions.map((option) => {
                const isChecked = visibleStatuses.includes(option.status);
                const statusCount = suggestions.filter((suggestion) => suggestion.status === option.status).length;

                return (
                  <label
                    key={option.status}
                    className={cn(
                      "badge-brutal flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-[var(--color-ink)] transition hover:-translate-y-0.5",
                      isChecked ? "bg-[var(--color-mint)]" : "bg-[var(--color-paper)] opacity-70"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--color-mint)]"
                      checked={isChecked}
                      onChange={() => toggleStatusFilter(option.status)}
                    />
                    <span>{option.label}</span>
                    <span className="mono text-[10px]">({statusCount})</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {suggestions.length === 0 ? (
            <div className="card-brutal-static p-4 text-sm font-bold text-[var(--color-ink-soft)]">
              Nenhuma sugestão cadastrada.
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="card-brutal-static p-4 text-sm font-bold text-[var(--color-ink-soft)]">
              Nenhuma sugestão corresponde aos filtros selecionados.
            </div>
          ) : null}

          {visibleSuggestions.map((suggestion) => (
            <article key={suggestion.id} className="card-brutal-static p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-bold">{suggestion.name}</p>
                    <span
                      className="badge-brutal px-2 py-1 text-[10px] text-[var(--color-ink)]"
                      style={{ backgroundColor: statusBgMap[suggestion.status] }}
                    >
                      {statusLabels[suggestion.status]}
                    </span>
                  </div>
                  {suggestion.description ? (
                    <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                      {suggestion.description}
                    </p>
                  ) : null}
                  <p className="mono mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
                    por {suggestion.suggestedBy} . {formatDateTime(suggestion.createdAt)}
                  </p>
                  {suggestion.appliedBoostModifiers.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {suggestion.appliedBoostModifiers.map((modifier) => (
                        <span key={modifier.key} className="retro-label neutral-chip">
                          {modifier.label} {formatMultiplier(modifier.multiplier)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="grid justify-items-end gap-2">
                  <span className="retro-label accent-chip">
                    prioridade {formatPipetz(suggestion.boostedScore)}
                  </span>
                  {suggestion.boostedScore !== suggestion.totalVotes ? (
                    <span className="mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                      votos reais {formatPipetz(suggestion.totalVotes)}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {suggestion.status !== "accepted" ? (
                  <Button
                    type="button"
                    onClick={() => submitStatus(suggestion.id, "accepted")}
                    disabled={isPending}
                    variant="success"
                    size="sm"
                  >
                    Aceitar
                  </Button>
                ) : null}
                {suggestion.status !== "played" ? (
                  <Button
                    type="button"
                    onClick={() => submitStatus(suggestion.id, "played")}
                    disabled={isPending}
                    variant="neutral"
                    size="sm"
                  >
                    Marcar jogado
                  </Button>
                ) : null}
                {suggestion.status !== "rejected" ? (
                  <Button
                    type="button"
                    onClick={() => submitStatus(suggestion.id, "rejected")}
                    disabled={isPending}
                    variant="danger"
                    size="sm"
                  >
                    Rejeitar
                  </Button>
                ) : null}
                {suggestion.status !== "open" ? (
                  <Button
                    type="button"
                    onClick={() => submitStatus(suggestion.id, "open")}
                    disabled={isPending}
                    variant="info"
                    size="sm"
                  >
                    Reabrir
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
          {hiddenSuggestionCount > 0 || showAllSuggestions ? (
            <div className="card-brutal-static flex justify-center p-4">
              <Button
                type="button"
                onClick={() => setShowAllSuggestions((current) => !current)}
                variant="neutral"
                size="sm"
              >
                {showAllSuggestions ? "Ver menos" : `Ver mais ${hiddenSuggestionCount}`}
              </Button>
            </div>
          ) : null}
        </div>
    </>
  );

  if (embedded) {
    return <section className="space-y-6">{content}</section>;
  }

  return (
    <section className="landing-plane landing-divider bg-[var(--color-paper-pink)] py-8 sm:py-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
        {content}
      </div>
    </section>
  );
}
