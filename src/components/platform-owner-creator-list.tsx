"use client";

import {
  Archive,
  CheckCircle2,
  ExternalLink,
  PauseCircle,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { creatorModuleCatalog } from "@/lib/creators/modules";
import type {
  CreatorModuleRecord,
  CreatorModuleStatus,
  CreatorStatus,
  PlatformCreatorInstanceRecord,
} from "@/lib/types";

type ApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

const creatorStatusLabels: Record<CreatorStatus, string> = {
  active: "Ativo",
  disabled: "Desabilitado",
  archived: "Arquivado",
};

const moduleStatusLabels: Record<CreatorModuleStatus | "missing", string> = {
  installed: "Habilitado",
  disabled: "Desabilitado",
  archived: "Arquivado",
  missing: "Não instalado",
};

function sortedModules(modules: CreatorModuleRecord[]) {
  return creatorModuleCatalog.map((manifest) => ({
    manifest,
    module: modules.find((entry) => entry.moduleKey === manifest.key) ?? null,
  }));
}

function creatorStatusTone(status: CreatorStatus) {
  if (status === "active") {
    return "bg-[var(--color-mint)]";
  }
  if (status === "disabled") {
    return "bg-[var(--color-yellow)]";
  }
  return "bg-[var(--color-paper)]";
}

function moduleStatusTone(status: CreatorModuleStatus | "missing") {
  if (status === "installed") {
    return "bg-[var(--color-mint)]";
  }
  if (status === "disabled") {
    return "bg-[var(--color-yellow)]";
  }
  return "bg-[var(--color-paper)]";
}

async function readApiResult<T>(response: Response) {
  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "Falha ao salvar alteração.");
  }
  return payload.data as T;
}

export function PlatformOwnerCreatorList({
  instances,
}: {
  instances: PlatformCreatorInstanceRecord[];
}) {
  const [items, setItems] = useState(instances);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const totalCreators = items.length;
  const activeCreators = useMemo(
    () => items.filter((item) => item.creator.status === "active").length,
    [items],
  );

  async function updateCreatorStatus(creatorId: string, status: CreatorStatus) {
    const key = `${creatorId}:status`;
    setBusyKey(key);
    setFeedback(null);
    try {
      const response = await fetch(`/api/owner/creators/${creatorId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const updated = await readApiResult<{ status: CreatorStatus; updatedAt: string }>(response);
      setItems((current) =>
        current.map((item) =>
          item.creator.id === creatorId
            ? {
                ...item,
                creator: {
                  ...item.creator,
                  status: updated.status,
                  updatedAt: updated.updatedAt,
                },
              }
            : item,
        ),
      );
      setFeedback("Status do criador atualizado.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao salvar alteração.");
    } finally {
      setBusyKey(null);
    }
  }

  async function updateModuleStatus(
    creatorId: string,
    moduleKey: string,
    status: CreatorModuleStatus,
  ) {
    const key = `${creatorId}:${moduleKey}`;
    setBusyKey(key);
    setFeedback(null);
    try {
      const response = await fetch(`/api/owner/creators/${creatorId}/modules/${moduleKey}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const updated = await readApiResult<CreatorModuleRecord>(response);
      setItems((current) =>
        current.map((item) => {
          if (item.creator.id !== creatorId) {
            return item;
          }

          const modules = item.modules.some((module) => module.moduleKey === moduleKey)
            ? item.modules.map((module) => (module.moduleKey === moduleKey ? updated : module))
            : [...item.modules, updated];

          return {
            ...item,
            modules,
            moduleSummary: {
              available: creatorModuleCatalog.length,
              installed: modules.filter((module) => module.status === "installed").length,
              disabled: modules.filter((module) => module.status === "disabled").length,
              archived: modules.filter((module) => module.status === "archived").length,
            },
          };
        }),
      );
      setFeedback("Módulo atualizado.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao salvar alteração.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="landing-plane landing-divider bg-[var(--color-paper-pink)] py-6 sm:py-8">
      <div className="mx-auto grid w-full max-w-[1500px] gap-5 px-4 sm:px-6 lg:px-10">
        <div className="panel surface-section p-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div>
              <h2
                className="text-3xl uppercase"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Instâncias de criadores
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-[var(--color-ink-soft)]">
                Controle global de criadores, domínios, branding básico e módulos instalados.
                Dados operacionais ainda precisam de `creatorId` antes de múltiplas comunidades
                reais dividirem o mesmo deploy.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] px-4 py-3 shadow-[4px_4px_0_var(--shadow-color)]">
                <p className="text-2xl font-black">{totalCreators}</p>
                <p className="text-[11px] font-black uppercase text-[var(--color-ink-soft)]">
                  Criadores
                </p>
              </div>
              <div className="border-[3px] border-[var(--color-ink)] bg-[var(--color-mint)] px-4 py-3 shadow-[4px_4px_0_var(--shadow-color)]">
                <p className="text-2xl font-black">{activeCreators}</p>
                <p className="text-[11px] font-black uppercase text-[var(--color-ink-soft)]">
                  Ativos
                </p>
              </div>
            </div>
          </div>
          {feedback ? (
            <p className="mt-4 border-[2px] border-[var(--color-ink)] bg-[var(--color-paper)] px-3 py-2 text-sm font-bold">
              {feedback}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4">
          {items.map((instance) => {
            const creatorBusy = busyKey === `${instance.creator.id}:status`;
            const modules = sortedModules(instance.modules);

            return (
              <article
                key={instance.creator.id}
                className="panel surface-section p-5"
              >
                <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(440px,1.1fr)]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            className="text-2xl uppercase"
                            style={{ fontFamily: "var(--font-display)" }}
                          >
                            {instance.creator.displayName}
                          </h3>
                          <span
                            className={`badge-brutal px-2 py-1 text-[10px] text-[var(--color-ink)] ${creatorStatusTone(
                              instance.creator.status,
                            )}`}
                          >
                            {creatorStatusLabels[instance.creator.status]}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-bold text-[var(--color-ink-soft)]">
                          /c/{instance.creator.slug}
                        </p>
                      </div>
                      <ShieldCheck className="size-7 text-[var(--color-purple-mid)]" aria-hidden />
                    </div>

                    <div className="mt-5 grid gap-3 text-sm font-bold text-[var(--color-ink-soft)]">
                      <p>
                        <span className="text-[var(--color-ink)]">Dono:</span>{" "}
                        {instance.owner
                          ? `${instance.owner.youtubeDisplayName}${
                              instance.owner.email ? ` (${instance.owner.email})` : ""
                            }`
                          : "Sem dono vinculado"}
                      </p>
                      <p>
                        <span className="text-[var(--color-ink)]">Domínio principal:</span>{" "}
                        {instance.publicUrl ? (
                          <a
                            href={instance.publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[var(--color-ink)] underline decoration-[3px] underline-offset-4"
                          >
                            {instance.primaryDomain}
                            <ExternalLink className="size-3.5" aria-hidden />
                          </a>
                        ) : (
                          "Sem domínio"
                        )}
                      </p>
                      <p>
                        <span className="text-[var(--color-ink)]">Módulos:</span>{" "}
                        {instance.moduleSummary.installed} habilitados,{" "}
                        {instance.moduleSummary.disabled} desabilitados,{" "}
                        {instance.moduleSummary.archived} arquivados
                      </p>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:items-end">
                      <label className="grid gap-2 text-xs font-black uppercase text-[var(--color-ink-soft)]">
                        Status
                        <Select
                          value={instance.creator.status}
                          onValueChange={(value) =>
                            updateCreatorStatus(instance.creator.id, value as CreatorStatus)
                          }
                          disabled={creatorBusy}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(creatorStatusLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>

                      <div className="flex flex-wrap gap-2">
                        {[
                          instance.branding.primaryColor,
                          instance.branding.secondaryColor,
                          instance.branding.accentColor,
                          instance.branding.backgroundColor,
                        ].map((color) => (
                          <span
                            key={color}
                            className="inline-flex h-10 min-w-24 items-center justify-center border-[2px] border-[var(--color-ink)] px-3 text-xs font-black uppercase shadow-[3px_3px_0_var(--shadow-color)]"
                            style={{ backgroundColor: color }}
                          >
                            {color}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {modules.map(({ manifest, module }) => {
                      const status = module?.status ?? "missing";
                      const key = `${instance.creator.id}:${manifest.key}`;
                      const busy = busyKey === key;
                      const enableStatus: CreatorModuleStatus = "installed";
                      const disableStatus: CreatorModuleStatus = "disabled";
                      const archiveStatus: CreatorModuleStatus = "archived";

                      return (
                        <div
                          key={manifest.key}
                          className="grid gap-3 border-[2px] border-[var(--color-ink)] bg-[var(--color-paper)] p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-black uppercase">{manifest.label}</p>
                              <span
                                className={`badge-brutal px-2 py-0.5 text-[10px] text-[var(--color-ink)] ${moduleStatusTone(
                                  status,
                                )}`}
                              >
                                {moduleStatusLabels[status]}
                              </span>
                            </div>
                            <p className="mt-1 text-xs font-bold text-[var(--color-ink-soft)]">
                              {[...manifest.publicRoutes, ...manifest.obsRoutes].join(", ") ||
                                "Sem rota pública"}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2 md:justify-end">
                            {status === "installed" ? (
                              <Button
                                type="button"
                                size="xs"
                                variant="neutral"
                                onClick={() =>
                                  updateModuleStatus(instance.creator.id, manifest.key, disableStatus)
                                }
                                disabled={busy}
                              >
                                <PauseCircle className="size-4" aria-hidden />
                                Desabilitar
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="xs"
                                variant="success"
                                onClick={() =>
                                  updateModuleStatus(instance.creator.id, manifest.key, enableStatus)
                                }
                                disabled={busy}
                              >
                                <CheckCircle2 className="size-4" aria-hidden />
                                {status === "disabled" ? "Habilitar" : "Instalar"}
                              </Button>
                            )}
                            {status !== "archived" && status !== "missing" ? (
                              <Button
                                type="button"
                                size="xs"
                                variant="danger"
                                onClick={() =>
                                  updateModuleStatus(instance.creator.id, manifest.key, archiveStatus)
                                }
                                disabled={busy}
                              >
                                <Archive className="size-4" aria-hidden />
                                Arquivar
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
