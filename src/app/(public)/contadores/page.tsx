import { CounterBoard } from "@/components/counter-board";
import { listStreamerbotCounters } from "@/lib/db/repository";

export default async function ContadoresPage() {
  const counters = await listStreamerbotCounters();

  return (
    <div className="flex w-full flex-col">
      <section className="landing-plane surface-hero relative overflow-hidden py-8 sm:py-10">
        <div className="bg-dots-light pointer-events-none absolute inset-0 opacity-15" />
        <div className="relative mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
          <div>
            <h1
              className="text-4xl uppercase sm:text-6xl lg:text-7xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Contadores da live.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-ink-soft)] sm:text-base">
              Aqui ficam os totais globais e os contadores por jogo que o chat e o Streamer.bot estao mexendo ao vivo.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-plane landing-divider bg-[var(--color-paper-pink)] py-8 sm:py-10">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
          <CounterBoard counters={counters} />
        </div>
      </section>
    </div>
  );
}
