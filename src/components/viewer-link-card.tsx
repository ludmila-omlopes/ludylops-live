"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

type ViewerLinkPayload = {
  id: string;
  googleAccountId: string;
  linkCode: string;
  expiresAt: string;
  claimedAt: string | null;
};

type LinkCodeResponse = {
  link: ViewerLinkPayload | null;
};

function formatExpiry(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ViewerLinkCard() {
  const [link, setLink] = useState<ViewerLinkPayload | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function loadLink() {
      const response = await fetch("/api/me/link-code", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: LinkCodeResponse;
      };

      if (cancelled) {
        return;
      }

      if (!response.ok || !payload.ok || !payload.data) {
        setLink(null);
        setIsLoading(false);
        return;
      }

      setLink(payload.data.link);
      setIsLoading(false);
    }

    void loadLink();

    return () => {
      cancelled = true;
    };
  }, []);

  function generateCode() {
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch("/api/me/link-code", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: LinkCodeResponse;
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.data?.link) {
        setFeedback(payload.error ?? "Não foi possível gerar o código.");
        return;
      }

      setLink(payload.data.link);
      setFeedback("Código atualizado.");
    });
  }

  return (
    <section className="landing-plane landing-divider bg-[var(--color-paper-pink)] py-8 sm:py-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
        <div className="card-brutal-static bg-[var(--color-paper)] p-6 sm:p-8">
          <p className="mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
            Vínculo da live
          </p>
          <h2 className="mt-3 text-3xl uppercase" style={{ fontFamily: "var(--font-display)" }}>
            Vincule seu canal do YouTube.
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-ink-soft)] sm:text-base">
            Para interagir com a live usando seus pipetz, gere um código aqui durante a live e envie{" "}
            <span className="font-black">!link CÓDIGO</span> no chat do YouTube. O vínculo só pode
            ser confirmado enquanto a live está acontecendo.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="card-flat bg-[var(--color-sky)] p-5">
              <p className="mono text-[10px] uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">
                Código atual
              </p>
              <p className="mt-3 text-4xl font-black tracking-[0.16em]" style={{ fontFamily: "var(--font-display)" }}>
                {isLoading ? "......" : link?.linkCode ?? "------"}
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--color-ink-soft)]">
                {link
                  ? `Expira em ${formatExpiry(link.expiresAt)}.`
                  : "Gere um código novo para fazer o vínculo pelo chat."}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button type="button" onClick={generateCode} disabled={isPending} className="justify-center">
                {isPending ? "Gerando..." : link ? "Gerar novo código" : "Gerar código"}
              </Button>
              {feedback ? (
                <p className="text-sm font-bold text-[var(--color-ink-soft)]" aria-live="polite">
                  {feedback}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-3 text-sm text-[var(--color-ink-soft)] sm:grid-cols-3">
            <div className="card-flat bg-[var(--color-mint)] p-4 text-[var(--color-accent-ink)]">
              1. Entre no site com o login que você preferir.
            </div>
            <div className="card-flat bg-[var(--color-yellow)] p-4 text-[var(--color-accent-ink)]">
              2. Durante a live, gere o código e mande <span className="font-black">!link CÓDIGO</span> no chat.
            </div>
            <div className="card-flat bg-[var(--color-pink)] p-4 text-[var(--color-accent-ink)]">
              3. O bot vincula seu viewer e seu saldo passa a seguir esse canal.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
