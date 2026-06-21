import type { ViewerChannelOptionRecord } from "@/lib/types";
import { formatPipetz } from "@/lib/utils";

export function ViewerChannelListCard({
  channels,
}: {
  channels: ViewerChannelOptionRecord[];
}) {
  if (channels.length === 0) {
    return null;
  }

  return (
    <section className="landing-plane landing-divider bg-[var(--color-paper)] py-8 sm:py-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
        <div>
          <h2 className="text-3xl uppercase" style={{ fontFamily: "var(--font-display)" }}>
            Canais vinculados
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-ink-soft)]">
            Todos estes canais usam o mesmo saldo da sua conta. Se qualquer um deles aparecer no chat,
            os pipetz entram no mesmo histórico.
          </p>
        </div>

        <div className="mt-6 grid gap-3">
          {channels.map((channel) => (
            <article
              key={channel.id}
              className="card-brutal-static flex flex-wrap items-center justify-between gap-4 bg-[var(--color-paper)] p-4"
            >
              <div className="min-w-0">
                <h3 className="text-lg font-black">{channel.youtubeDisplayName}</h3>
                <p className="mono mt-2 truncate text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                  {channel.youtubeHandle ?? channel.youtubeChannelId}
                </p>
              </div>

              <span className="retro-label neutral-chip">
                Saldo unificado: {formatPipetz(channel.currentBalance)}
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
