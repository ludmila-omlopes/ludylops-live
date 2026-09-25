"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Read-only value with a copy button, for IDs and names typed into the Streamer.bot. */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-1">
      <span className="text-xs font-black uppercase tracking-[0.08em] text-[var(--color-ink-soft)]">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <code className="min-w-0 flex-1 break-all border-[2px] border-[var(--color-ink)] bg-[var(--color-paper)] px-3 py-2 text-sm">
          {value}
        </code>
        <Button type="button" variant="neutral" size="xs" onClick={() => void copy()} aria-label={`Copiar ${label}`}>
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <span aria-live="polite" className="sr-only">
        {copied ? `${label} copiado.` : ""}
      </span>
    </div>
  );
}
