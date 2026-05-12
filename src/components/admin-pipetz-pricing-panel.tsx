"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PipetzPricingRecord } from "@/lib/types";
import { formatDateTime, formatPipetz } from "@/lib/utils";

type PricingField = "gameSuggestionCost" | "videoSuggestionCost" | "quoteOverlayCost";

const pricingFields: Array<{
  key: PricingField;
  label: string;
  description: string;
}> = [
  {
    key: "gameSuggestionCost",
    label: "Sugestao de jogo",
    description: "Valor cobrado quando alguem indica um novo jogo.",
  },
  {
    key: "videoSuggestionCost",
    label: "Sugestao de video",
    description: "Valor cobrado para enviar um novo video do YouTube.",
  },
  {
    key: "quoteOverlayCost",
    label: "Quote no OBS",
    description: "Valor cobrado por !quoteobs e pelo botao publico de OBS.",
  },
];

function toFormState(pricing: PipetzPricingRecord) {
  return {
    gameSuggestionCost: String(pricing.gameSuggestionCost),
    videoSuggestionCost: String(pricing.videoSuggestionCost),
    quoteOverlayCost: String(pricing.quoteOverlayCost),
  };
}

export function AdminPipetzPricingPanel({
  initialPricing,
}: {
  initialPricing: PipetzPricingRecord;
}) {
  const router = useRouter();
  const [pricing, setPricing] = useState(initialPricing);
  const [form, setForm] = useState(toFormState(initialPricing));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateField(field: PricingField, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function savePricing() {
    const payload = {
      gameSuggestionCost: Number(form.gameSuggestionCost),
      videoSuggestionCost: Number(form.videoSuggestionCost),
      quoteOverlayCost: Number(form.quoteOverlayCost),
    };

    if (Object.values(payload).some((value) => !Number.isInteger(value) || value <= 0)) {
      setFeedback("Use valores inteiros maiores que zero.");
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/pipetz-pricing", {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const result = (await response.json()) as {
          ok?: boolean;
          error?: string;
          data?: PipetzPricingRecord;
        };

        if (!response.ok || !result.ok || !result.data) {
          setFeedback(result.error ?? "Falha ao salvar precos.");
          return;
        }

        setPricing(result.data);
        setForm(toFormState(result.data));
        setFeedback("Precos atualizados.");
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao salvar precos.");
      }
    });
  }

  return (
    <div className="panel surface-section p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mono text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
            Precos Pipetz
          </p>
          <h2
            className="mt-2 text-2xl font-bold uppercase"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Acoes pagas
          </h2>
        </div>
        {feedback ? <div className="retro-label neutral-chip">{feedback}</div> : null}
      </div>

      <div className="mt-5 grid gap-4">
        {pricingFields.map((field) => (
          <label key={field.key} className="card-brutal-static surface-card grid gap-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="text-sm font-black uppercase tracking-[0.14em]">
                  {field.label}
                </span>
                <p className="mt-1 text-sm leading-6 text-[var(--color-ink-soft)]">
                  {field.description}
                </p>
              </div>
              <span className="retro-label accent-chip">
                atual {formatPipetz(pricing[field.key])}
              </span>
            </div>
            <Input
              type="number"
              min={1}
              step={1}
              value={form[field.key]}
              onChange={(event) => updateField(field.key, event.target.value)}
            />
          </label>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={savePricing} disabled={isPending} variant="success" size="sm">
          {isPending ? "Salvando..." : "Salvar precos"}
        </Button>
        {pricing.updatedAt ? (
          <span className="text-sm font-bold text-[var(--color-ink-soft)]">
            Atualizado em {formatDateTime(pricing.updatedAt)}
            {pricing.updatedBy ? ` por ${pricing.updatedBy}` : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}
