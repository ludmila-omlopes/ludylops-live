import { auth } from "@/auth";
import { QuoteOverlayTrigger } from "@/components/quote-overlay-trigger";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPipetzPricing, getViewerDashboard, listQuotes } from "@/lib/db/repository";
import { cn, formatDateTime, formatPipetz } from "@/lib/utils";

const quoteCardBackgrounds = [
  "bg-[var(--color-paper)]",
  "bg-[var(--color-pink)]",
  "bg-[var(--color-blue)]",
  "bg-[var(--color-mint)]",
];

function usesPastelQuoteBackground(bgClass: string) {
  return ["--color-blue", "--color-pink", "--color-purple", "--color-yellow", "--color-mint"].some((token) =>
    bgClass.includes(token),
  );
}

export default async function QuotesPage() {
  const session = await auth();
  const activeViewerId = session?.user?.activeViewerId ?? null;
  const [quotes, dashboard, pricing] = await Promise.all([
    listQuotes(),
    activeViewerId ? getViewerDashboard(activeViewerId) : Promise.resolve(null),
    getPipetzPricing(),
  ]);
  const canShowOnOverlay = Boolean(activeViewerId && dashboard?.viewer.isLinked);

  return (
    <div className="flex w-full flex-col">
      <section className="landing-plane surface-hero relative overflow-hidden py-8 sm:py-10">
        <div className="bg-dots-light pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
          <div>
            <p className="mono text-xs font-bold uppercase tracking-[0.32em] text-[var(--color-ink-soft)]">
              Quotes da live
            </p>
            <h1
              className="mt-3 text-4xl uppercase sm:text-6xl lg:text-7xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Todas as frases registradas.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-ink-soft)] sm:text-base">
              Aqui ficam as melhores perolas salvas pelo chat. Tudo em ordem de cadastro, com o
              número da quote e quem registrou.
            </p>
            <p className="mt-3 inline-flex items-center gap-2 border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--color-ink)] shadow-[4px_4px_0_var(--shadow-color)]">
              Mostrar no OBS custa {formatPipetz(pricing.quoteOverlayCost)} pipetz
            </p>
          </div>
        </div>
      </section>

      <section className="landing-plane landing-divider bg-[var(--color-paper-pink)] py-8 sm:py-10">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
          <div className="grid gap-4">
            {quotes.length > 0 ? (
              quotes.map((quote, index) => {
                const bgClass = quoteCardBackgrounds[index % quoteCardBackgrounds.length];
                const usesPastelInk = usesPastelQuoteBackground(bgClass);

                return (
                  <Card
                    key={quote.id}
                    variant="poster"
                    className={cn("gap-4 p-5", bgClass, usesPastelInk && "text-[var(--color-accent-ink)]")}
                  >
                    <CardHeader>
                      <div>
                        <CardDescription
                          className={cn(
                            "mono text-[10px] uppercase tracking-[0.28em]",
                            usesPastelInk ? "text-[var(--color-accent-ink-soft)]" : "text-[var(--color-ink-soft)]",
                          )}
                        >
                          Quote registrada
                        </CardDescription>
                        <CardTitle
                          className="mt-2 text-3xl uppercase leading-none"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          #{quote.quoteNumber}
                        </CardTitle>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <blockquote
                        className={cn(
                          "text-lg font-black leading-8 sm:text-xl",
                          usesPastelInk ? "text-[var(--color-accent-ink)]" : "text-[var(--color-ink)]",
                        )}
                      >
                        <span aria-hidden="true">&ldquo;</span>
                        {quote.body}
                        <span aria-hidden="true">&rdquo;</span>
                      </blockquote>
                    </CardContent>

                    <CardFooter
                      className={cn(
                        "flex flex-wrap items-end justify-between gap-4 text-sm font-bold",
                        usesPastelInk ? "text-[var(--color-accent-ink-soft)]" : "text-[var(--color-ink-soft)]",
                      )}
                    >
                      <div className="flex flex-col gap-1">
                        <span>{quote.createdByDisplayName}</span>
                        {quote.createdByYoutubeHandle ? ` • ${quote.createdByYoutubeHandle}` : ""}
                        <span>{formatDateTime(quote.createdAt)}</span>
                      </div>
                      <QuoteOverlayTrigger
                        quoteId={quote.quoteNumber}
                        loggedIn={Boolean(session?.user)}
                        canShow={canShowOnOverlay}
                        viewerBalance={dashboard?.balance.currentBalance}
                        quoteOverlayCost={pricing.quoteOverlayCost}
                      />
                    </CardFooter>
                  </Card>
                );
              })
            ) : (
              <Card variant="poster" className="bg-[var(--color-paper)] p-6">
                <CardHeader>
                  <CardDescription className="mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
                    Lista vazia
                  </CardDescription>
                  <CardTitle
                    className="text-3xl uppercase leading-none"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Nenhuma quote ainda.
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-[var(--color-ink-soft)] sm:text-base">
                    Quando o chat salvar a primeira quote, ela aparece aqui automaticamente.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

