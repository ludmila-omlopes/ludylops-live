import { auth } from "@/auth";
import { VideoSuggestForm } from "@/components/video-suggest-form";
import { VideoSuggestionList } from "@/components/video-suggestion-list";
import { getPipetzPricing, getViewerDashboard, listVideoSuggestions } from "@/lib/db/repository";

export default async function VideosPage() {
  const session = await auth();
  const activeViewerId = session?.user?.activeViewerId ?? null;
  const [suggestions, dashboard, pricing] = await Promise.all([
    listVideoSuggestions(activeViewerId),
    activeViewerId ? getViewerDashboard(activeViewerId) : Promise.resolve(null),
    getPipetzPricing(),
  ]);

  const viewerBalance = dashboard?.balance.currentBalance ?? null;
  const canInteract = Boolean(activeViewerId);

  return (
    <div className="flex w-full flex-col pb-20">
      <section className="landing-plane surface-hero relative overflow-hidden py-8 sm:py-10">
        <div className="bg-dots-light pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
          <div>
            <p className="mono text-xs font-bold uppercase tracking-[0.32em] text-[var(--color-ink-soft)]">
              Sugestoes de videos
            </p>
            <h1
              className="mt-3 text-4xl uppercase sm:text-6xl lg:text-7xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Me diz ao que reagir.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-ink-soft)] sm:text-base">
              Cola um link do YouTube, eu valido o video, puxo thumb, titulo e criador, e a galera pode gastar pipetz pra dar boost.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-plane landing-divider bg-[var(--color-paper-pink)] py-8 sm:py-10">
        <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:px-10">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className="text-xl">Fila</span>
              <h2
                className="text-2xl font-bold uppercase"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Videos da galera
              </h2>
            </div>
            <VideoSuggestionList
              suggestions={suggestions}
              loggedIn={Boolean(session?.user)}
              canInteract={canInteract}
              viewerBalance={viewerBalance}
            />
          </div>
          <div className="self-start lg:sticky lg:top-24">
            <VideoSuggestForm
              loggedIn={Boolean(session?.user)}
              canSuggest={canInteract}
              viewerBalance={viewerBalance}
              creationCost={pricing.videoSuggestionCost}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
