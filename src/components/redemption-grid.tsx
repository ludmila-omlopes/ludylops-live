import Image from "next/image";

import { CatalogItemRecord } from "@/lib/types";
import { formatPipetz } from "@/lib/utils";

const typeColorMap: Record<string, string> = {
  play_sound: "var(--color-lavender)",
  show_image: "var(--color-sky)",
  run_action: "var(--color-lilac)",
  overlay_scene_trigger: "var(--color-rose)",
  tts: "var(--color-periwinkle)",
  generic_streamerbot_action: "var(--color-mint)",
};

const cardBgCycle = [
  "surface-card",
  "surface-card-alt",
  "surface-card-accent",
  "surface-card",
  "surface-card-alt",
  "surface-card",
];

export function RedemptionGrid({
  items,
  expanded = false,
  viewerBalance,
  staticCards = false,
  fullWidth = false,
  sectionClassName,
}: {
  items: CatalogItemRecord[];
  expanded?: boolean;
  viewerBalance?: number;
  staticCards?: boolean;
  fullWidth?: boolean;
  sectionClassName?: string;
}) {
  const content = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold uppercase" style={{ fontFamily: "var(--font-display)" }}>
            {expanded ? "Todos os resgates" : "Resgates em destaque"}
          </h2>
        </div>
        {typeof viewerBalance === "number" ? (
          <div className="badge-brutal accent-chip px-4 py-2 text-sm">
            Seus pipetz: {formatPipetz(viewerBalance)}
          </div>
        ) : null}
      </div>
      <div className={`mt-8 grid gap-5 ${expanded ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {items.map((item, index) => {
          const canAfford = typeof viewerBalance === "number" ? viewerBalance >= item.cost : null;
          const typeBg = typeColorMap[item.type] ?? "var(--color-paper)";
          const cardBg = cardBgCycle[index % cardBgCycle.length];

          return (
            <article
              key={item.id}
              className={`${staticCards ? "card-brutal-static" : "card-brutal"} overflow-hidden ${cardBg}`}
            >
              {item.previewImageUrl ? (
                <div className="relative h-44 overflow-hidden border-b-[3px] border-[var(--color-ink)]">
                  <Image
                    src={item.previewImageUrl}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className="badge-brutal inline-flex px-2 py-0.5 text-[10px] text-[var(--color-ink)]"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${typeBg} 20%, var(--surface-card) 80%)`,
                      }}
                    >
                      {item.type.replaceAll("_", " ")}
                    </p>
                    <h3 className="mt-2 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
                      {item.name}
                    </h3>
                  </div>
                  <div
                    className="badge-brutal shrink-0 px-3 py-1.5 text-sm text-[var(--color-accent-ink)]"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${item.accentColor} 24%, var(--surface-card) 76%)`,
                    }}
                  >
                    {formatPipetz(item.cost)}
                  </div>
                </div>
                <p className="text-sm leading-6 text-[var(--color-ink-soft)]">{item.description}</p>

                {canAfford !== null ? (
                  <div
                    className={`badge-brutal px-2 py-1 text-[10px] ${
                      canAfford
                        ? "accent-chip"
                        : "surface-card-accent text-[var(--color-ink)]"
                    }`}
                  >
                    {canAfford
                      ? "Dá pra resgatar!"
                      : `Faltam ${formatPipetz(item.cost - viewerBalance!)} pipetz`}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                  <span className="rounded-[var(--radius)] border border-[var(--color-muted)]/40 px-2 py-0.5">
                    CD: {item.viewerCooldownSeconds}s
                  </span>
                  <span className="rounded-[var(--radius)] border border-[var(--color-muted)]/40 px-2 py-0.5">
                    Global: {item.globalCooldownSeconds}s
                  </span>
                  <span className="rounded-[var(--radius)] border border-[var(--color-muted)]/40 px-2 py-0.5">
                    {item.stock === null ? "Infinito" : `Estoque ${item.stock}`}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );

  if (fullWidth) {
    return (
      <section className={`landing-plane landing-divider py-8 sm:py-10 ${sectionClassName ?? "surface-section"}`}>
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
          {content}
        </div>
      </section>
    );
  }

  return (
    <section className="panel surface-section p-6 sm:p-8">
      {content}
    </section>
  );
}
