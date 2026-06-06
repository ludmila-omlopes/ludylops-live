"use client";

import { Plus, Save, Trash2, Play } from "lucide-react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WheelConfigRecord, WheelOptionRecord } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const palette = ["#ff66b3", "#41d1ff", "#00beae", "#ffe066", "#b4ff39", "#d7b7ff"];

function buildOption(index: number): WheelOptionRecord {
  return {
    id: `opcao_${index + 1}`,
    label: "",
    weight: 1,
    color: palette[index % palette.length],
    isActive: true,
    sortOrder: index,
  };
}

export function AdminWheelPanel({ initialConfig }: { initialConfig: WheelConfigRecord }) {
  const router = useRouter();
  const [title, setTitle] = useState(initialConfig.title);
  const [spinDurationMs, setSpinDurationMs] = useState(String(initialConfig.spinDurationMs));
  const [resultHoldSeconds, setResultHoldSeconds] = useState(String(initialConfig.resultHoldSeconds));
  const [options, setOptions] = useState<WheelOptionRecord[]>(initialConfig.options);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeCount = options.filter((option) => option.isActive && option.label.trim()).length;
  const canSave = title.trim().length > 0 && activeCount >= 2;

  function updateOption(optionId: string, patch: Partial<WheelOptionRecord>) {
    setOptions((current) =>
      current.map((option) => (option.id === optionId ? { ...option, ...patch } : option)),
    );
  }

  function addOption() {
    setOptions((current) => [...current, buildOption(current.length)]);
  }

  function removeOption(optionId: string) {
    setOptions((current) =>
      current.filter((option) => option.id !== optionId).map((option, index) => ({ ...option, sortOrder: index })),
    );
  }

  function saveConfig() {
    if (!canSave) {
      setFeedback("Cadastre pelo menos duas opções ativas.");
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/wheel", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          spinDurationMs: Number.parseInt(spinDurationMs, 10),
          resultHoldSeconds: Number.parseInt(resultHoldSeconds, 10),
          options: options
            .map((option, index) => ({ ...option, label: option.label.trim(), sortOrder: index }))
            .filter((option) => option.label),
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; data?: WheelConfigRecord };
      if (!response.ok || !payload.ok || !payload.data) {
        setFeedback(payload.error ?? "Falha ao salvar roleta.");
        return;
      }

      setTitle(payload.data.title);
      setSpinDurationMs(String(payload.data.spinDurationMs));
      setResultHoldSeconds(String(payload.data.resultHoldSeconds));
      setOptions(payload.data.options);
      setFeedback("Roleta salva.");
      router.refresh();
    });
  }

  function spinWheel() {
    setFeedback(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/wheel/spin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "admin", requestedBy: "admin" }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; data?: WheelConfigRecord };
      if (!response.ok || !payload.ok || !payload.data?.lastSpin) {
        setFeedback(payload.error ?? "Falha ao girar roleta.");
        return;
      }

      setFeedback(`Resultado: ${payload.data.lastSpin.label}.`);
      router.refresh();
    });
  }

  return (
    <section className="panel surface-section p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl uppercase" style={{ fontFamily: "var(--font-display)" }}>
            Prêmios do chat
          </h2>
        </div>
        {feedback ? <div className="retro-label neutral-chip max-w-sm">{feedback}</div> : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_180px_180px]">
        <label className="grid gap-2">
          <span className="text-sm font-black uppercase tracking-[0.14em]">Título</span>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-black uppercase tracking-[0.14em]">Animação</span>
          <Input
            type="number"
            min={2500}
            max={12000}
            value={spinDurationMs}
            onChange={(event) => setSpinDurationMs(event.target.value)}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-black uppercase tracking-[0.14em]">Visível por</span>
          <Input
            type="number"
            min={5}
            max={120}
            value={resultHoldSeconds}
            onChange={(event) => setResultHoldSeconds(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-6 grid gap-3">
        {options.map((option, index) => (
          <article
            key={option.id}
            className="card-flat grid gap-3 bg-[var(--color-paper)] p-4 lg:grid-cols-[44px_1fr_110px_110px_auto]"
          >
            <button
              type="button"
              className="h-11 w-11 border-[3px] border-[var(--color-ink)]"
              style={{ backgroundColor: option.color }}
              title="Cor da opção"
              onClick={() => updateOption(option.id, { color: palette[(palette.indexOf(option.color) + 1) % palette.length] ?? palette[0] })}
            />
            <Input
              value={option.label}
              placeholder={`Opção ${index + 1}`}
              onChange={(event) => updateOption(option.id, { label: event.target.value })}
            />
            <Input
              type="number"
              min={1}
              max={100}
              value={option.weight}
              onChange={(event) => updateOption(option.id, { weight: Number.parseInt(event.target.value, 10) || 1 })}
            />
            <label className="flex min-h-11 items-center gap-2 text-sm font-black uppercase">
              <input
                type="checkbox"
                checked={option.isActive}
                onChange={(event) => updateOption(option.id, { isActive: event.target.checked })}
              />
              Ativa
            </label>
            <Button
              type="button"
              variant="danger"
              size="icon"
              onClick={() => removeOption(option.id)}
              disabled={isPending || options.length <= 2}
              title="Remover opção"
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </article>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="button" variant="neutral" onClick={addOption} disabled={isPending || options.length >= 24}>
          <Plus aria-hidden="true" />
          Adicionar
        </Button>
        <Button type="button" variant="success" onClick={saveConfig} disabled={isPending || !canSave}>
          <Save aria-hidden="true" />
          Salvar
        </Button>
        <Button type="button" variant="accent" onClick={spinWheel} disabled={isPending || activeCount < 2}>
          <Play aria-hidden="true" />
          Girar agora
        </Button>
        <Link href="/obs/wheel" className="btn-brutal ink-button px-5 py-2.5 text-sm">
          Abrir overlay
        </Link>
        <Link href="/obs/wheel?demo=1" className="btn-brutal bg-[var(--color-paper)] px-5 py-2.5 text-sm">
          Abrir demo
        </Link>
      </div>

      <div className="mt-4 grid gap-1 text-sm font-bold text-[var(--color-ink-soft)]">
        <p>URL do OBS: /obs/wheel</p>
        <p>Feed JSON: /api/obs/wheel/current</p>
        {initialConfig.lastSpin ? <p>Último resultado: {initialConfig.lastSpin.label} em {formatDateTime(initialConfig.lastSpin.startedAt)}</p> : null}
      </div>
    </section>
  );
}
