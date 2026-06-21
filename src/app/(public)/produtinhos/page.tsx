import type { Metadata } from "next";
import Link from "next/link";

import { ProductRecommendationCard } from "@/components/product-recommendation-card";
import { ProductRecommendationSubmitDialog } from "@/components/product-recommendation-submit-form";
import { listProductRecommendations } from "@/lib/db/repository";
import {
  getRecommendationCategoryLabel,
  getRecommendationCategoryOptions,
} from "@/lib/recommendations";

export const metadata: Metadata = {
  title: "Produtinhos que indico | Pipetz",
  description: "Produtos de setup, jogos e live que eu indico para a comunidade.",
};

type ProdutinhosPageProps = {
  searchParams: Promise<{ categoria?: string | string[] | undefined }>;
};

export default async function ProdutinhosPage({ searchParams }: ProdutinhosPageProps) {
  const resolvedSearchParams = await searchParams;
  const selectedCategoryParam = Array.isArray(resolvedSearchParams.categoria)
    ? resolvedSearchParams.categoria[0]
    : resolvedSearchParams.categoria;
  const productRecommendations = await listProductRecommendations();
  const categoryOptions = getRecommendationCategoryOptions(
    productRecommendations.map((item) => item.category),
    { includeDefaults: false },
  );
  const categoryLookup = Object.fromEntries(categoryOptions.map((category) => [category.key, category]));
  const selectedCategory =
    selectedCategoryParam && selectedCategoryParam in categoryLookup ? selectedCategoryParam : null;
  const filteredRecommendations = selectedCategory
    ? productRecommendations.filter((item) => item.category === selectedCategory)
    : productRecommendations;

  return (
    <div className="flex w-full flex-col">
      <section className="landing-plane surface-hero relative overflow-hidden py-8 sm:py-10">
        <div className="bg-dots-light pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
          <h1
            className="text-4xl uppercase sm:text-6xl lg:text-7xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Produtinhos que indico
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-ink-soft)] sm:text-base">
            Produtos que eu recomendo para setup, jogo e live. Se algum link
            virar afiliado, isso aparece marcado no próprio item antes do
            clique.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ProductRecommendationSubmitDialog />
          </div>
        </div>
      </section>

      <section className="landing-plane landing-divider py-8 sm:py-10">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/produtinhos"
              className={`retro-label ${
                selectedCategory ? "bg-[var(--color-paper)] text-[var(--color-ink)]" : "ink-button"
              }`}
            >
              Todas
            </Link>
            {categoryOptions.map((category) => (
              <Link
                key={category.key}
                href={`/produtinhos?categoria=${encodeURIComponent(category.key)}`}
                className={`retro-label ${
                  selectedCategory === category.key
                    ? "ink-button"
                    : "bg-[var(--color-paper)] text-[var(--color-ink)]"
                }`}
              >
                {category.label}
              </Link>
            ))}
          </div>

          <section className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredRecommendations.length === 0 ? (
                <div className="panel surface-section p-6 text-sm font-bold text-[var(--color-ink-soft)]">
                  Nenhuma recomendação publicada ainda.
                </div>
              ) : null}

              {filteredRecommendations.map((item) => {
                return (
                  <ProductRecommendationCard
                    key={item.id}
                    item={item}
                    categoryLabel={getRecommendationCategoryLabel(item.category)}
                    categoryHref={`/produtinhos?categoria=${encodeURIComponent(item.category)}`}
                  />
                );
              })}
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="btn-brutal bg-[var(--color-paper)] px-5 py-3 text-xs text-[var(--color-ink)]"
            >
              Voltar para home
            </Link>
            <Link
              href="/indicacoes"
              className="btn-brutal bg-[var(--color-blue)] px-5 py-3 text-xs text-[var(--color-accent-ink)]"
            >
              Ver canais
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
