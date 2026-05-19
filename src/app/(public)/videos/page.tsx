import { auth } from "@/auth";
import { VideoSuggestionList } from "@/components/video-suggestion-list";
import {
  getPipetzPricing,
  getViewerDashboard,
  listVideoSuggestions,
} from "@/lib/db/repository";

export default async function VideosPage() {
  const session = await auth();
  const activeViewerId = session?.user?.activeViewerId ?? null;
  const [suggestions, dashboard, pricing] = await Promise.all([
    listVideoSuggestions(activeViewerId),
    activeViewerId ? getViewerDashboard(activeViewerId) : Promise.resolve(null),
    getPipetzPricing(),
  ]);

  const viewerBalance = dashboard?.balance.currentBalance ?? null;
  const canInteract = Boolean(activeViewerId && dashboard?.viewer.isLinked);

  return (
    <div className="flex w-full flex-col pb-20">
      <section className="landing-plane surface-hero relative overflow-hidden py-8 sm:py-10">
        <div className="bg-dots-light pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
          <p className="mono text-xs font-bold uppercase tracking-[0.32em] text-[var(--color-ink-soft)]">
            Sugestões de vídeos
          </p>
          <h1
            className="mt-3 text-4xl uppercase sm:text-6xl lg:text-7xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Me diz ao que reagir.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-ink-soft)] sm:text-base">
            Cole um link do YouTube, eu puxo a thumb, o título e o criador, e a
            comunidade usa pipetz para colocar os melhores vídeos no topo.
          </p>
        </div>
      </section>

      <section className="landing-plane landing-divider bg-[var(--color-paper-pink)] py-8 sm:py-10">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
          <VideoSuggestionList
            suggestions={suggestions}
            loggedIn={Boolean(session?.user)}
            canInteract={canInteract}
            viewerBalance={viewerBalance}
            creationCost={pricing.videoSuggestionCost}
          />
        </div>
      </section>
    </div>
  );
}
