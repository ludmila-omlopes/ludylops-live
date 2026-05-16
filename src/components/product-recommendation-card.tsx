/* eslint-disable @next/next/no-img-element */
import type { ProductRecommendationRecord } from "@/lib/types";

function recommendationRel(linkKind: ProductRecommendationRecord["linkKind"]) {
  return linkKind === "affiliate" ? "noopener noreferrer sponsored" : "noopener noreferrer";
}

export function ProductRecommendationCard({
  item,
  categoryLabel,
  accentClass,
}: {
  item: ProductRecommendationRecord;
  categoryLabel: string;
  accentClass: string;
}) {
  return (
    <article className="panel surface-section flex h-full flex-col overflow-hidden">
      <div className="flex flex-1 flex-col">
        <div className={`aspect-[4/3] border-b-[3px] border-[var(--color-ink)] ${accentClass}`}>
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
        </div>

        <div className="flex flex-1 flex-col justify-between gap-5 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="retro-label bg-[var(--color-paper)] text-[var(--color-ink)]">
                {categoryLabel}
              </span>
              <span className="retro-label bg-[var(--color-paper)] text-[var(--color-ink-soft)]">
                {item.storeLabel}
              </span>
              <span className="retro-label bg-[var(--color-paper)] text-[var(--color-ink-soft)]">
                {item.linkKind === "affiliate" ? "Link afiliado" : "Link externo"}
              </span>
            </div>

            <h2
              className="mt-4 text-xl uppercase leading-[0.95]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {item.name}
            </h2>

            <p className="mt-4 text-sm leading-7 text-[var(--color-ink-soft)] sm:text-base">
              {item.context}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t-[2px] border-[var(--color-ink)] pt-4">
            <p className="text-xs font-bold leading-5 text-[var(--color-ink-soft)]">
              {item.linkKind === "affiliate"
                ? "Link afiliado marcado antes do clique."
                : "Link externo para abrir o produto."}
            </p>

            <a
              href={item.href}
              target="_blank"
              rel={recommendationRel(item.linkKind)}
              className="btn-brutal bg-[var(--color-paper)] px-5 py-3 text-xs text-[var(--color-ink)]"
            >
              Abrir produto
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
