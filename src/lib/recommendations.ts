import type { ProductRecommendationCategory } from "@/lib/types";

export type RecommendationCategory = {
  key: ProductRecommendationCategory;
  label: string;
  accentClass: string;
};

export const recommendationCategories: RecommendationCategory[] = [
  {
    key: "videogames",
    label: "Videogames",
    accentClass: "bg-[var(--color-blue)]",
  },
  {
    key: "perifericos",
    label: "Periféricos",
    accentClass: "bg-[var(--color-purple)]",
  },
  {
    key: "acessorios",
    label: "Acessórios",
    accentClass: "bg-[var(--color-pink)]",
  },
  {
    key: "casa",
    label: "Casa",
    accentClass: "bg-[var(--color-mint)]",
  },
  {
    key: "pets",
    label: "Pets",
    accentClass: "bg-[var(--color-yellow)]",
  },
  {
    key: "home_office",
    label: "Home office",
    accentClass: "bg-[var(--color-sky)]",
  },
  {
    key: "organizacao",
    label: "Organização",
    accentClass: "bg-[var(--color-lavender)]",
  },
];

export function getRecommendationCategoryLabel(categoryKey: string) {
  const knownCategory = recommendationCategories.find((category) => category.key === categoryKey);
  if (knownCategory) {
    return knownCategory.label;
  }

  return categoryKey
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\p{Ll}/u, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

export function getRecommendationCategoryOptions(categories: string[], options?: { includeDefaults?: boolean }) {
  const categoryOptions = new Map(
    options?.includeDefaults === false
      ? []
      : recommendationCategories.map((category) => [category.key, category]),
  );

  for (const categoryKey of categories) {
    const normalizedKey = categoryKey.trim();
    if (!normalizedKey || categoryOptions.has(normalizedKey)) {
      continue;
    }

    categoryOptions.set(normalizedKey, {
      key: normalizedKey,
      label: getRecommendationCategoryLabel(normalizedKey),
      accentClass: "bg-[var(--color-paper)]",
    });
  }

  return Array.from(categoryOptions.values()).sort((left, right) =>
    left.label.localeCompare(right.label, "pt-BR"),
  );
}
