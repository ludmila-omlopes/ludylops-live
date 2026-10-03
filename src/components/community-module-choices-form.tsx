"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  joinModuleLabels,
  moduleChoiceClosure,
  type ModuleChoice,
  type ModuleChoiceKey,
  type ModuleChoiceState,
} from "@/lib/creators/module-choices";

const chips: Record<ModuleChoiceState, { label: string; tone: string } | null> = {
  active: { label: "Ativo", tone: "hub-chip-success" },
  soon: { label: "Em breve", tone: "hub-chip-on" },
  off: null,
  blocked: { label: "Desativado pela administração", tone: "" },
};

const editableKeys = (choices: ModuleChoice[]) => new Set(choices.filter((choice) => choice.chosen && choice.editable).map((choice) => choice.key));

export function CommunityModuleChoicesForm({ creatorId, initial }: { creatorId: string; initial: ModuleChoice[] }) {
  const router = useRouter();
  const [choices, setChoices] = useState(initial);
  const [picked, setPicked] = useState(() => editableKeys(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const endpoint = `/api/me/creator-area/${encodeURIComponent(creatorId)}/modules`;

  // Modules installed by the platform still bring their requirements along.
  const included = moduleChoiceClosure([...picked, ...choices.filter((choice) => choice.chosen && !choice.editable).map((choice) => choice.key)]);
  const requiredBy = (key: ModuleChoiceKey) =>
    choices.filter((choice) => choice.key !== key && included.has(choice.key) && choice.requires.includes(key)).map((choice) => choice.key);

  function toggle(key: ModuleChoiceKey) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSaved(false);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(null); setSaved(false);
    try {
      const modules = choices.filter((choice) => choice.editable && included.has(choice.key)).map((choice) => choice.key);
      const response = await fetch(endpoint, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ modules }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível salvar os módulos.");
      const next = payload.data as ModuleChoice[];
      setChoices(next); setPicked(editableKeys(next)); setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar os módulos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-6">
      <fieldset disabled={busy} className="grid min-w-0 gap-3">
        <legend className="sr-only">Módulos da comunidade</legend>
        {choices.map((choice) => {
          const dependents = requiredBy(choice.key);
          const checked = choice.editable ? included.has(choice.key) : choice.chosen;
          const disabled = !choice.editable || dependents.length > 0;
          const chip = chips[choice.state];
          const note = dependents.length
            ? `Vem junto com ${joinModuleLabels(dependents)}.`
            : !choice.editable && choice.chosen
              ? "Gerenciado pela administração."
              : choice.requires.length
                ? `Inclui ${joinModuleLabels(choice.requires)}.`
                : null;
          return (
            <label
              key={choice.key}
              className={`hub-well flex min-w-0 items-start gap-3 p-4 transition-shadow has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--hub-accent,#8f56c8)] ${disabled ? "cursor-default" : "cursor-pointer"} ${choice.state === "blocked" ? "opacity-60" : ""}`}
              style={checked ? { boxShadow: "inset 0 0 0 2px var(--hub-accent, #8f56c8)" } : undefined}
            >
              <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={() => toggle(choice.key)} />
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-[5px] border"
                style={checked
                  ? { background: "var(--hub-accent, #8f56c8)", borderColor: "var(--hub-accent, #8f56c8)", color: "var(--hub-on-accent, #fff)" }
                  : { borderColor: "var(--hub-line, currentColor)" }}
              >
                {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
              </span>
              <span className="grid min-w-0 flex-1 gap-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{choice.label}</span>
                  {chip ? <span className={`hub-chip ${chip.tone}`}>{chip.label}</span> : null}
                </span>
                <span className="hub-muted break-words text-sm leading-6">{choice.description}</span>
                {note ? <span className="hub-muted text-[13px] leading-5">{note}</span> : null}
              </span>
            </label>
          );
        })}
      </fieldset>
      {error ? <p role="alert" className="text-sm">{error}</p> : null}
      {saved ? <p role="status" className="text-sm">Módulos salvos.</p> : null}
      <div>
        <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar módulos"}</Button>
      </div>
    </form>
  );
}
