"use client";

import { Check } from "lucide-react";

import { creatorColorInk, safeCreatorColor } from "@/lib/creators/profile";
import { CREATOR_TEMPLATES, creatorTemplateOptions, type CreatorTemplate } from "@/lib/creators/templates";

// Inline styles keep each preview faithful to its template: the Creator Hub theme
// would otherwise soften the neobrutalist borders, shadows and uppercase.
function Preview({ template, name, primary, accent }: { template: CreatorTemplate; name: string; primary: string; accent: string }) {
  const ink = creatorColorInk(primary);

  if (template === "neobrutalista") {
    return (
      <div aria-hidden="true" style={{ border: "3px solid #111", boxShadow: "4px 4px 0 #111", background: "#fff", color: "#111" }}>
        <div style={{ background: primary, color: ink, padding: "14px 14px 12px", fontFamily: '"Archivo Black", sans-serif', textTransform: "uppercase", fontSize: 17, lineHeight: 1 }}>
          {name}
        </div>
        <div style={{ height: 8, background: accent, borderBlock: "3px solid #111" }} />
        <div style={{ padding: 12, display: "flex", justifyContent: "flex-end" }}>
          <span style={{ background: primary, color: ink, border: "2px solid #111", boxShadow: "3px 3px 0 #111", padding: "6px 10px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Ver produto
          </span>
        </div>
      </div>
    );
  }

  return (
    <div aria-hidden="true" style={{ borderRadius: 16, overflow: "hidden", background: `linear-gradient(140deg, ${primary}, ${accent})` }}>
      <div style={{ padding: "14px 14px 10px", color: ink, fontSize: 17, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1 }}>{name}</div>
      <div style={{ margin: "0 8px 8px", padding: 10, borderRadius: 12, background: "rgb(255 255 255 / 0.72)", boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.9)", display: "flex", justifyContent: "flex-end" }}>
        <span style={{ background: primary, color: ink, borderRadius: 999, padding: "6px 12px", fontSize: 11, fontWeight: 600, boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.5)" }}>
          Ver produto
        </span>
      </div>
    </div>
  );
}

export function CreatorTemplatePicker({
  name,
  value,
  onChange,
  displayName,
  primaryColor,
  accentColor,
  disabled = false,
}: {
  name: string;
  value: CreatorTemplate;
  onChange: (template: CreatorTemplate) => void;
  displayName: string;
  primaryColor: string;
  accentColor: string;
  disabled?: boolean;
}) {
  const primary = safeCreatorColor(primaryColor, "#c7a2e9");
  const accent = safeCreatorColor(accentColor, "#40a9ff");
  const title = displayName.trim() || "Sua comunidade";

  return (
    <fieldset className="grid min-w-0 gap-3" disabled={disabled}>
      <legend className="mb-3 text-sm font-semibold">Template da página</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {CREATOR_TEMPLATES.map((template) => {
          const option = creatorTemplateOptions[template];
          const selected = value === template;
          return (
            <label
              key={template}
              className="hub-well relative grid cursor-pointer gap-3 p-3 transition-shadow has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--hub-accent,#8f56c8)]"
              style={selected ? { boxShadow: "inset 0 0 0 2px var(--hub-accent, #8f56c8)" } : undefined}
            >
              <input
                type="radio"
                name={name}
                value={template}
                checked={selected}
                onChange={() => onChange(template)}
                className="sr-only"
              />
              <Preview template={template} name={title} primary={primary} accent={accent} />
              <span className="flex items-start justify-between gap-2">
                <span className="grid gap-1">
                  <span className="font-semibold">{option.label}</span>
                  <span className="text-[13px] leading-5 text-[var(--color-ink-soft)]">{option.description}</span>
                </span>
                {selected ? (
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--hub-accent,#8f56c8)] text-[var(--hub-on-accent,#fff)]">
                    <Check className="size-4" aria-hidden="true" />
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
