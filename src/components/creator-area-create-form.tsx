"use client";

import { ExternalLink, Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createCreatorAreaSchema,
  flattenCreatorAreaSchemaErrors,
  formatCreateCreatorAreaError,
} from "@/lib/creators/service";

type FieldErrors = Partial<Record<"displayName" | "slug" | "primaryColor" | "accentColor", string>>;

type CreatorAreaResponse = {
  ok?: boolean;
  error?: string;
  data?: {
    creator?: {
      slug?: string;
    };
  };
};

export function CreatorAreaCreateForm() {
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#c7a2e9");
  const [accentColor, setAccentColor] = useState("#40a9ff");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function renderFieldError(field: keyof FieldErrors) {
    const error = fieldErrors[field];
    return error ? <span className="text-xs font-bold text-[var(--color-rose)]">{error}</span> : null;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const draft = {
      displayName,
      slug: slug || undefined,
      primaryColor,
      accentColor,
    };
    const parsed = createCreatorAreaSchema.safeParse(draft);

    if (!parsed.success) {
      setFieldErrors(flattenCreatorAreaSchemaErrors(parsed.error));
      setFeedback(formatCreateCreatorAreaError(parsed.error));
      return;
    }

    setFieldErrors({});
    setFeedback(null);
    startTransition(async () => {
      const response = await fetch("/api/me/creator-area", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(parsed.data),
      });

      const payload = (await response.json()) as CreatorAreaResponse;
      if (!response.ok || !payload.ok) {
        setFeedback(payload.error ?? "Falha ao criar área.");
        return;
      }

      const createdSlug = payload.data?.creator?.slug;
      if (createdSlug) {
        window.location.assign(`/c/${createdSlug}`);
        return;
      }

      setFeedback("Área criada.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <label className="grid gap-2">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-ink)]">Nome do criador</span>
        <Input
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
            clearFieldError("displayName");
          }}
          placeholder="Ex.: Canal da Mari"
          aria-invalid={Boolean(fieldErrors.displayName)}
        />
        {renderFieldError("displayName")}
      </label>

      <label className="grid gap-2">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-ink)]">Endereço</span>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <Input
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value);
              clearFieldError("slug");
            }}
            placeholder="canal-da-mari"
            aria-invalid={Boolean(fieldErrors.slug)}
          />
          <span className="text-sm font-black text-[var(--color-ink-soft)]">.ludylops.live</span>
        </div>
        {renderFieldError("slug")}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-ink)]">Cor principal</span>
          <Input
            type="color"
            value={primaryColor}
            onChange={(event) => {
              setPrimaryColor(event.target.value);
              clearFieldError("primaryColor");
            }}
            aria-invalid={Boolean(fieldErrors.primaryColor)}
            className="h-14 p-2"
          />
          {renderFieldError("primaryColor")}
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-ink)]">Cor de destaque</span>
          <Input
            type="color"
            value={accentColor}
            onChange={(event) => {
              setAccentColor(event.target.value);
              clearFieldError("accentColor");
            }}
            aria-invalid={Boolean(fieldErrors.accentColor)}
            className="h-14 p-2"
          />
          {renderFieldError("accentColor")}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending} variant="accent">
          <Plus className="size-4" aria-hidden="true" />
          {isPending ? "Criando..." : "Criar área"}
        </Button>
        {feedback ? (
          <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--color-ink-soft)]">
            <ExternalLink className="size-4" aria-hidden="true" />
            {feedback}
          </span>
        ) : null}
      </div>
    </form>
  );
}
