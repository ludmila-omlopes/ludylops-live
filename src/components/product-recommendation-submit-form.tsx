"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";

import {
  flattenProductRecommendationSchemaErrors,
  formatProductRecommendationSchemaError,
  productRecommendationSubmissionSchema,
} from "@/lib/recommendation-schemas";
import { getRecommendationCategoryOptions } from "@/lib/recommendations";

const categoryOptions = getRecommendationCategoryOptions([]);

function mapSubmissionError(message: string) {
  switch (message) {
    case "invalid_slug":
      return "Não consegui gerar um slug válido para esse produto.";
    case "recommendation_slug_exists":
      return "Já existe uma recomendação com esse nome. Tente detalhar o produto.";
    default:
      return message;
  }
}

export function ProductRecommendationSubmitDialog() {
  const titleId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("videogames");
  const [context, setContext] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [href, setHref] = useState("");
  const [storeLabel, setStoreLabel] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function resetForm() {
    setName("");
    setCategory("videogames");
    setContext("");
    setImageUrl("");
    setHref("");
    setStoreLabel("");
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = productRecommendationSubmissionSchema.safeParse({
      name,
      category,
      context,
      imageUrl,
      href,
      storeLabel,
    });

    if (!parsed.success) {
      setFieldErrors(flattenProductRecommendationSchemaErrors(parsed.error));
      setFeedback(formatProductRecommendationSchemaError(parsed.error));
      return;
    }

    setFieldErrors({});
    setFeedback(null);
    startTransition(async () => {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(parsed.data),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setFeedback(mapSubmissionError(payload.error ?? "Falha ao enviar recomendação."));
        return;
      }

      resetForm();
      setFeedback("Recomendação enviada para aprovação.");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFeedback(null);
          setIsOpen(true);
        }}
        className="btn-brutal ink-button inline-flex items-center gap-2 px-5 py-3 text-xs"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        Indicar produto
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="panel surface-section relative max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto p-5 text-[var(--color-ink)] shadow-[8px_8px_0_var(--color-ink)] sm:p-6"
          >
            <div className="bg-dots-light pointer-events-none absolute inset-0 opacity-15" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mono text-xs uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">
                    Envie sua indicação
                  </p>
                  <h2
                    id={titleId}
                    className="mt-2 text-2xl uppercase sm:text-3xl"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Indique um produto para a Ludy avaliar
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-ink-soft)]">
                    A sugestão entra como pendente e só aparece na página depois de aprovada.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Fechar formulário"
                  className="btn-brutal bg-[var(--color-paper)] p-2 text-[var(--color-ink)]"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-5 grid gap-4 lg:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-black uppercase tracking-[0.14em]">Nome</span>
                  <input
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      clearFieldError("name");
                    }}
                    placeholder="Ex.: Controle, headset, luz..."
                    aria-invalid={Boolean(fieldErrors.name)}
                    className={getFieldClass("name")}
                  />
                  {renderFieldError("name")}
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black uppercase tracking-[0.14em]">Categoria</span>
                  <input
                    value={category}
                    list="public-product-recommendation-category-options"
                    onChange={(event) => {
                      setCategory(event.target.value);
                      clearFieldError("category");
                    }}
                    placeholder="Ex.: Casa"
                    aria-invalid={Boolean(fieldErrors.category)}
                    className={getFieldClass("category")}
                  />
                  <datalist id="public-product-recommendation-category-options">
                    {categoryOptions.map((entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry.label}
                      </option>
                    ))}
                  </datalist>
                  {renderFieldError("category")}
                </label>

                <label className="grid gap-2 lg:col-span-2">
                  <span className="text-sm font-black uppercase tracking-[0.14em]">Por que indicar?</span>
                  <textarea
                    value={context}
                    onChange={(event) => {
                      setContext(event.target.value);
                      clearFieldError("context");
                    }}
                    rows={4}
                    placeholder="Conta por que esse produto faz sentido para a comunidade."
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
                    placeholder="https://... ou /uploads/produto.jpg"
                    aria-invalid={Boolean(fieldErrors.imageUrl)}
                    className={getFieldClass("imageUrl")}
                  />
                  {renderFieldError("imageUrl")}
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black uppercase tracking-[0.14em]">Link do produto</span>
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
                    placeholder="Amazon, Mercado Livre, AliExpress..."
                    aria-invalid={Boolean(fieldErrors.storeLabel)}
                    className={getFieldClass("storeLabel")}
                  />
                  {renderFieldError("storeLabel")}
                </label>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="btn-brutal ink-button w-full px-5 py-3 text-xs disabled:opacity-60 sm:w-fit"
                  >
                    {isPending ? "Enviando..." : "Enviar para análise"}
                  </button>
                </div>
              </form>

              {feedback ? (
                <div className="sticker sticker-pop accent-chip mt-4 inline-flex px-3 py-1.5 text-sm">
                  {feedback}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
