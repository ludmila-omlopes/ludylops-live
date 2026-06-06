"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  flattenProductRecommendationSchemaErrors,
  formatProductRecommendationSchemaError,
  productRecommendationSchema,
} from "@/lib/recommendation-schemas";
import {
  getRecommendationCategoryLabel,
  getRecommendationCategoryOptions,
} from "@/lib/recommendations";
import type { ProductRecommendationRecord } from "@/lib/types";

const INITIAL_VISIBLE_RECOMMENDATIONS = 6;

function mapRecommendationError(message: string) {
  switch (message) {
    case "recommendation_slug_exists":
      return "Já existe uma recomendação com esse slug.";
    case "recommendation_not_found":
      return "Recomendação não encontrada.";
    case "invalid_slug":
      return "Não consegui gerar um slug válido para esse produto.";
    default:
      return message;
  }
}

export function AdminRecommendationsPanel({
  recommendations,
}: {
  recommendations: ProductRecommendationRecord[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductRecommendationRecord["category"]>("videogames");
  const [context, setContext] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [href, setHref] = useState("");
  const [storeLabel, setStoreLabel] = useState("");
  const [linkKind, setLinkKind] = useState<ProductRecommendationRecord["linkKind"]>("external");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [pendingCategories, setPendingCategories] = useState<Record<string, string>>({});
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pendingCategoryChanges = recommendations
    .map((item) => ({
      item,
      category: pendingCategories[item.id]?.trim() ?? item.category,
    }))
    .filter(({ item, category }) => category && category !== item.category);
  const categoryOptions = getRecommendationCategoryOptions(
    [
      ...recommendations.map((item) => item.category),
      ...Object.values(pendingCategories),
    ],
  );
  const visibleRecommendations = showAllRecommendations
    ? recommendations
    : recommendations.slice(0, INITIAL_VISIBLE_RECOMMENDATIONS);
  const hiddenRecommendationCount = Math.max(recommendations.length - visibleRecommendations.length, 0);

  function resetForm() {
    setName("");
    setCategory("videogames");
    setContext("");
    setImageUrl("");
    setHref("");
    setStoreLabel("");
    setLinkKind("external");
    setSortOrder("0");
    setIsActive(true);
    setFieldErrors({});
  }

  function clearFieldError(field: string) {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function getFieldClass(field: string) {
    return [
      "rounded-[var(--radius)] border-[3px] bg-[var(--color-paper)] px-3 py-2 font-bold",
      fieldErrors[field] ? "border-[var(--color-rose)]" : "border-[var(--color-ink)]",
    ].join(" ");
  }

  function renderFieldError(field: string) {
    if (!fieldErrors[field]) {
      return null;
    }

    return <span className="text-xs font-bold text-[var(--color-rose)]">{fieldErrors[field]}</span>;
  }

  async function runAction(
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: Record<string, unknown>,
  ) {
    const response = await fetch(url, {
      method,
      headers: body
        ? {
            "content-type": "application/json",
          }
        : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const payload = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "Falha ao salvar recomendação.");
    }
  }

  function handleCreate() {
    const normalizedSortOrder = sortOrder.trim() === "" ? Number.NaN : Number(sortOrder);
    const parsed = productRecommendationSchema.safeParse({
      name,
      category,
      context,
      imageUrl,
      href,
      storeLabel,
      linkKind,
      sortOrder: normalizedSortOrder,
      isActive,
    });

    if (!parsed.success) {
      setFieldErrors(flattenProductRecommendationSchemaErrors(parsed.error));
      setFeedback(formatProductRecommendationSchemaError(parsed.error));
      return;
    }

    setFieldErrors({});
    setFeedback(null);
    startTransition(async () => {
      try {
        await runAction("/api/admin/recommendations", "POST", parsed.data);

        resetForm();
        setFeedback("Recomendação adicionada.");
        router.refresh();
      } catch (error) {
        setFeedback(
          error instanceof Error ? mapRecommendationError(error.message) : "Falha ao criar recomendação.",
        );
      }
    });
  }

  function toggleStatus(item: ProductRecommendationRecord) {
    setFeedback(null);
    startTransition(async () => {
      try {
        await runAction(`/api/admin/recommendations/${item.id}`, "PATCH", {
          isActive: !item.isActive,
        });
        setFieldErrors({});
        setConfirmingDeleteId(null);
        setFeedback(item.isActive ? "Recomendação desativada." : "Recomendação ativada.");
        router.refresh();
      } catch (error) {
        setFeedback(
          error instanceof Error ? mapRecommendationError(error.message) : "Falha ao atualizar recomendação.",
        );
      }
    });
  }

  function updatePendingCategory(item: ProductRecommendationRecord, nextCategory: string) {
    setFeedback(null);
    setPendingCategories((current) => {
      const trimmedCategory = nextCategory.trim();
      const next = { ...current };

      if (trimmedCategory === item.category) {
        delete next[item.id];
      } else {
        next[item.id] = nextCategory;
      }

      return next;
    });
  }

  function discardCategoryChanges() {
    setFeedback(null);
    setPendingCategories({});
  }

  function saveCategoryChanges() {
    if (pendingCategoryChanges.length === 0) {
      setFeedback("Nenhuma categoria alterada.");
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        await Promise.all(
          pendingCategoryChanges.map(({ item, category }) =>
            runAction(`/api/admin/recommendations/${item.id}`, "PATCH", {
              category,
            }),
          ),
        );
        setFieldErrors({});
        setConfirmingDeleteId(null);
        setPendingCategories({});
        setFeedback(
          pendingCategoryChanges.length === 1
            ? "Categoria atualizada."
            : `${pendingCategoryChanges.length} categorias atualizadas.`,
        );
        router.refresh();
      } catch (error) {
        setFeedback(
          error instanceof Error ? mapRecommendationError(error.message) : "Falha ao atualizar recomendação.",
        );
      }
    });
  }

  function confirmDelete(item: ProductRecommendationRecord) {
    setFeedback(null);
    startTransition(async () => {
      try {
        await runAction(`/api/admin/recommendations/${item.id}`, "DELETE");
        setFieldErrors({});
        setConfirmingDeleteId(null);
        setFeedback("Recomendação excluída.");
        router.refresh();
      } catch (error) {
        setFeedback(
          error instanceof Error ? mapRecommendationError(error.message) : "Falha ao excluir recomendação.",
        );
      }
    });
  }

  return (
    <section className="panel bg-[var(--color-periwinkle)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-3xl uppercase"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Produtos recomendados
          </h2>
        </div>
        {feedback ? <div className="retro-label neutral-chip">{feedback}</div> : null}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="card-brutal-static p-5">
          <p className="mono text-xs uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">
            Novo produto
          </p>

          <div className="mt-4 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-black uppercase tracking-[0.14em]">Nome</span>
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  clearFieldError("name");
                }}
                placeholder="Ex.: Produto novo"
                aria-invalid={Boolean(fieldErrors.name)}
                className={getFieldClass("name")}
              />
              {renderFieldError("name")}
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-black uppercase tracking-[0.14em]">Categoria</span>
              <input
                value={category}
                list="product-recommendation-category-options"
                onChange={(event) => {
                  setCategory(event.target.value);
                  clearFieldError("category");
                }}
                placeholder="Ex.: Casa"
                aria-invalid={Boolean(fieldErrors.category)}
                className={getFieldClass("category")}
              />
              <datalist id="product-recommendation-category-options">
                {categoryOptions.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.label}
                  </option>
                ))}
              </datalist>
              {renderFieldError("category")}
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-black uppercase tracking-[0.14em]">Contexto curto</span>
              <textarea
                value={context}
                onChange={(event) => {
                  setContext(event.target.value);
                  clearFieldError("context");
                }}
                rows={4}
                placeholder="Por que esse item faz sentido para a comunidade."
                aria-invalid={Boolean(fieldErrors.context)}
                className={[
                  "rounded-[var(--radius)] border-[3px] bg-[var(--color-paper)] px-3 py-2 text-sm font-bold",
                  fieldErrors.context ? "border-[var(--color-rose)]" : "border-[var(--color-ink)]",
                ].join(" ")}
              />
              {renderFieldError("context")}
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-black uppercase tracking-[0.14em]">Imagem</span>
              <input
                value={imageUrl}
                onChange={(event) => {
                  setImageUrl(event.target.value);
                  clearFieldError("imageUrl");
                }}
                placeholder="/uploads/produto.jpg ou https://..."
                aria-invalid={Boolean(fieldErrors.imageUrl)}
                className={getFieldClass("imageUrl")}
              />
              {renderFieldError("imageUrl")}
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-black uppercase tracking-[0.14em]">Link</span>
                <input
                  value={href}
                  onChange={(event) => {
                    setHref(event.target.value);
                    clearFieldError("href");
                  }}
                  placeholder="https://..."
                  aria-invalid={Boolean(fieldErrors.href)}
                  className={getFieldClass("href")}
                />
                {renderFieldError("href")}
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black uppercase tracking-[0.14em]">Loja</span>
                <input
                  value={storeLabel}
                  onChange={(event) => {
                    setStoreLabel(event.target.value);
                    clearFieldError("storeLabel");
                  }}
                  placeholder="Amazon, Kabum, Nintendo..."
                  aria-invalid={Boolean(fieldErrors.storeLabel)}
                  className={getFieldClass("storeLabel")}
                />
                {renderFieldError("storeLabel")}
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-black uppercase tracking-[0.14em]">Tipo de link</span>
                <select
                  value={linkKind}
                  onChange={(event) => {
                    setLinkKind(event.target.value as ProductRecommendationRecord["linkKind"]);
                    clearFieldError("linkKind");
                  }}
                  aria-invalid={Boolean(fieldErrors.linkKind)}
                  className={getFieldClass("linkKind")}
                >
                  <option value="external">Link externo</option>
                  <option value="affiliate">Link afiliado</option>
                </select>
                {renderFieldError("linkKind")}
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black uppercase tracking-[0.14em]">Ordem</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={sortOrder}
                  onChange={(event) => {
                    setSortOrder(event.target.value);
                    clearFieldError("sortOrder");
                  }}
                  aria-invalid={Boolean(fieldErrors.sortOrder)}
                  className={getFieldClass("sortOrder")}
                />
                {renderFieldError("sortOrder")}
              </label>
            </div>

            <label className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.14em]">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="h-4 w-4"
              />
              Mostrar na página pública
            </label>

            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending}
              className="btn-brutal ink-button px-4 py-2 text-xs disabled:opacity-60"
            >
              {isPending ? "Salvando..." : "Adicionar produto"}
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          {recommendations.length > 0 ? (
            <div className="card-brutal-static flex flex-wrap items-center justify-between gap-3 p-4">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                {pendingCategoryChanges.length === 0
                  ? "Nenhuma categoria pendente"
                  : `${pendingCategoryChanges.length} alteração(ões) de categoria pendente(s)`}
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={discardCategoryChanges}
                  disabled={isPending || pendingCategoryChanges.length === 0}
                  className="btn-brutal bg-[var(--color-paper)] px-3 py-2 text-xs disabled:opacity-60"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={saveCategoryChanges}
                  disabled={isPending || pendingCategoryChanges.length === 0}
                  className="btn-brutal ink-button px-3 py-2 text-xs disabled:opacity-60"
                >
                  {isPending ? "Salvando..." : "Salvar categorias"}
                </button>
              </div>
            </div>
          ) : null}

          {recommendations.length === 0 ? (
            <div className="card-brutal-static p-4 text-sm font-bold text-[var(--color-ink-soft)]">
              Nenhuma recomendação cadastrada.
            </div>
          ) : null}

          {visibleRecommendations.map((item) => {
            return (
              <article key={item.id} className="card-brutal-static overflow-hidden">
                <div className="grid gap-0 md:grid-cols-[168px_1fr]">
                  <div className="min-h-[140px] bg-[var(--color-paper)]">
                    <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                  </div>

                  <div className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-bold">{item.name}</p>
                          <span className="badge-brutal bg-[var(--color-paper)] px-2 py-1 text-[10px] text-[var(--color-ink)]">
                            {getRecommendationCategoryLabel(item.category)}
                          </span>
                          <span className="badge-brutal bg-[var(--color-paper)] px-2 py-1 text-[10px] text-[var(--color-ink)]">
                            {item.linkKind === "affiliate" ? "Afiliado" : "Externo"}
                          </span>
                          <span
                            className="badge-brutal px-2 py-1 text-[10px] text-[var(--color-ink)]"
                            style={{
                              backgroundColor: item.isActive ? "var(--color-mint)" : "var(--color-rose)",
                            }}
                          >
                            {item.isActive ? "Ativo" : "Inativo"}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{item.context}</p>
                        <p className="mono mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
                          ordem {item.sortOrder} . {item.storeLabel}
                        </p>
                        <label className="mt-3 grid max-w-xs gap-1">
                          <span className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
                            Categoria
                          </span>
                          <input
                            value={pendingCategories[item.id] ?? item.category}
                            list="product-recommendation-category-options"
                            onChange={(event) => updatePendingCategory(item, event.target.value)}
                            disabled={isPending}
                            placeholder="Ex.: Casa"
                            className={[
                              "rounded-[var(--radius)] border-[3px] bg-[var(--color-paper)] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-60",
                              pendingCategories[item.id] !== undefined &&
                                pendingCategories[item.id]?.trim() !== item.category
                                ? "border-[var(--color-admin)]"
                                : "border-[var(--color-ink)]",
                            ].join(" ")}
                          />
                        </label>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <button
                          type="button"
                          onClick={() => toggleStatus(item)}
                          disabled={isPending}
                          className="btn-brutal bg-[var(--color-paper)] px-3 py-2 text-xs disabled:opacity-60"
                        >
                          {item.isActive ? "Desativar" : "Ativar"}
                        </button>

                        {confirmingDeleteId === item.id ? (
                          <div className="flex flex-wrap items-center justify-end gap-2 rounded-[var(--radius)] border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] px-3 py-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.14em]">
                              Você tem certeza?
                            </span>
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteId(null)}
                              disabled={isPending}
                              className="btn-brutal bg-white px-3 py-2 text-[10px] disabled:opacity-60"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => confirmDelete(item)}
                              disabled={isPending}
                              className="btn-brutal bg-[var(--color-rose)] px-3 py-2 text-[10px] disabled:opacity-60"
                            >
                              Excluir
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setFeedback(null);
                              setConfirmingDeleteId(item.id);
                            }}
                            disabled={isPending}
                            className="btn-brutal bg-[var(--color-rose)] px-3 py-2 text-xs disabled:opacity-60"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <a
                        href={item.href}
                        target="_blank"
                        rel={item.linkKind === "affiliate" ? "noopener noreferrer sponsored" : "noopener noreferrer"}
                        className="retro-label neutral-chip"
                      >
                        abrir link
                      </a>
                      <span className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
                        {item.imageUrl}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          {hiddenRecommendationCount > 0 || showAllRecommendations ? (
            <div className="card-brutal-static flex justify-center p-4">
              <button
                type="button"
                onClick={() => setShowAllRecommendations((current) => !current)}
                className="btn-brutal bg-[var(--color-paper)] px-3 py-2 text-xs"
              >
                {showAllRecommendations ? "Ver menos" : `Ver mais ${hiddenRecommendationCount}`}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
