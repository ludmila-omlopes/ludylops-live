"use client";

import { useEffect, useState } from "react";
import { Coins } from "lucide-react";

import { presenceDay } from "@/lib/creators/page-rewards";

/** Claims already sent from this page, so remounts and repeated effects never send them twice. */
const claimed = new Set<string>();

/**
 * Claims the signed-in viewer's daily visit reward once per day and browser.
 * The server is the source of truth: repeating the claim never credits twice.
 */
export function CommunityPresence({ slug }: { slug: string }) {
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const key = `community-presence:${slug}:${presenceDay()}`;
    if (claimed.has(key)) return;
    try { if (window.localStorage.getItem(key)) return; } catch { /* storage unavailable: the server still dedupes */ }
    claimed.add(key);
    void fetch(`/api/c/${encodeURIComponent(slug)}/presence`, { method: "POST" })
      .then((response) => response.json().catch(() => null))
      .then((payload) => {
        if (!payload?.ok) { claimed.delete(key); return; }
        try { window.localStorage.setItem(key, "1"); } catch { /* ignore */ }
        if (payload.data.credited) setNotice(`+${payload.data.amount.toLocaleString("pt-BR")} ${payload.data.currencyLabel} pela visita de hoje.`);
      })
      .catch(() => claimed.delete(key));
  }, [slug]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  return notice ? (
    <p role="status" className="hub-card fixed bottom-4 right-4 z-50 flex max-w-[calc(100%-2rem)] items-center gap-2 border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] px-4 py-3 text-sm font-bold shadow-[4px_4px_0_var(--shadow-color)]">
      <Coins className="size-4 shrink-0" aria-hidden="true" />
      {notice}
    </p>
  ) : null;
}
