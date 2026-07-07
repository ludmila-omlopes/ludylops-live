"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CreatorAreaAccessSettingsRecord } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

function toText(settings: CreatorAreaAccessSettingsRecord) {
  return settings.allowedEmails.join("\n");
}

export function AdminCreatorAreaAccessPanel({
  initialSettings,
}: {
  initialSettings: CreatorAreaAccessSettingsRecord;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [emailsText, setEmailsText] = useState(toText(initialSettings));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/creator-area-access", {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ emailsText }),
        });
        const result = (await response.json()) as {
          ok?: boolean;
          error?: string;
          data?: CreatorAreaAccessSettingsRecord;
        };

        if (!response.ok || !result.ok || !result.data) {
          setFeedback(result.error ?? "Falha ao salvar lista.");
          return;
        }

        setSettings(result.data);
        setEmailsText(toText(result.data));
        setFeedback("Lista atualizada.");
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao salvar lista.");
      }
    });
  }

  return (
    <div className="panel surface-section p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-2xl font-bold uppercase"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Beta de áreas
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--color-ink-soft)]">
            Só estes emails podem reservar uma área enquanto o teste fechado estiver ativo. Admins gerais continuam liberados.
          </p>
        </div>
        <span className="retro-label accent-chip">{settings.allowedEmails.length} liberados</span>
      </div>

      <label className="mt-5 grid gap-2">
        <span className="text-sm font-black uppercase tracking-[0.14em] text-[var(--color-ink)]">
          Emails aprovados
        </span>
        <Textarea
          value={emailsText}
          onChange={(event) => setEmailsText(event.target.value)}
          placeholder={"pessoa@exemplo.com\noutra@exemplo.com"}
          rows={10}
          className="min-h-64 font-mono text-sm"
        />
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={isPending} variant="success" size="sm">
          {isPending ? "Salvando..." : "Salvar lista"}
        </Button>
        {feedback ? <span className="text-sm font-bold text-[var(--color-ink-soft)]">{feedback}</span> : null}
        {settings.updatedAt ? (
          <span className="text-sm font-bold text-[var(--color-ink-soft)]">
            Atualizado em {formatDateTime(settings.updatedAt)}
            {settings.updatedBy ? ` por ${settings.updatedBy}` : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}
