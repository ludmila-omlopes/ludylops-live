import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CommunitySectionHeading } from "@/components/community-section-heading";
import { RefreshButton } from "@/components/refresh-button";
import { getOwnedChatRewards } from "@/lib/creators/chat-rewards-settings.server";
import { isCommunitySectionAvailable } from "@/lib/creators/community-sections";
import { loadCommunitySection } from "@/lib/creators/community-workspace.server";
import { communitySectionPath, summarizeSetup } from "@/lib/creators/owner-dashboard";
import type { SetupStep } from "@/lib/creators/setup";
import { getOwnedCreatorSetup } from "@/lib/creators/setup.server";

export const metadata: Metadata = {
  title: "Visão geral da comunidade",
};

const stepLabels: Record<SetupStep["state"], string> = {
  configured: "Registrado",
  pending: "Falta configurar",
  blocked: "Indisponível",
  verify: "Verificar na live",
};

const stepTones: Record<SetupStep["state"], string> = {
  configured: "bg-[var(--color-mint)]",
  pending: "bg-[var(--color-yellow)]",
  blocked: "bg-[var(--color-paper)]",
  verify: "bg-[var(--color-sky)]",
};

type SummaryItem = { label: string; value: string; href?: string };

function SummaryCard({ item }: { item: SummaryItem }) {
  const content = (
    <>
      <span className="text-xs font-black uppercase tracking-[0.08em] text-[var(--color-ink-soft)]">{item.label}</span>
      <span className="mt-1 block break-words text-base font-bold text-[var(--color-ink)]">{item.value}</span>
    </>
  );
  const className =
    "block border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-4 shadow-[4px_4px_0_var(--shadow-color)]";

  return item.href ? (
    <Link href={item.href} className={`${className} transition-transform hover:-translate-y-0.5`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

export default async function CommunityOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { community, tenant, viewerId } = await loadCommunitySection(params, "overview");
  const slug = community.slug;

  const setup = await getOwnedCreatorSetup(viewerId, community.id).catch(() => null);
  const chatRewards =
    community.status === "active" && isCommunitySectionAvailable(tenant, "economia")
      ? await getOwnedChatRewards(viewerId, community.id).catch(() => null)
      : null;
  const progress = setup ? summarizeSetup(setup) : null;
  const percent = progress && progress.total > 0 ? Math.round((progress.configured / progress.total) * 100) : 0;

  const summary: SummaryItem[] = [];
  if (setup) {
    summary.push({
      label: "Moeda",
      value: setup.currencyLabel,
      href: isCommunitySectionAvailable(tenant, "identidade") ? communitySectionPath(slug, "identidade") : undefined,
    });
  }
  if (chatRewards) {
    summary.push({
      label: "Ganhos no chat",
      value: chatRewards.enabled
        ? `${chatRewards.amount} ${setup?.currencyLabel ?? "unidades"} a cada ${chatRewards.cooldownSeconds} s`
        : "Pausados",
      href: communitySectionPath(slug, "economia"),
    });
  }
  if (progress) {
    summary.push({
      label: "Streamer.bot",
      value: progress.authenticated ? "Autenticação recebida" : "Aguardando autenticação",
      href: communitySectionPath(slug, "integracao"),
    });
  }

  return (
    <>
      <CommunitySectionHeading title="Visão geral" />

      {summary.length > 0 ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {summary.map((item) => (
            <SummaryCard key={item.label} item={item} />
          ))}
        </div>
      ) : null}

      <section aria-labelledby="primeira-live" className="grid gap-5 border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-5 shadow-[6px_6px_0_var(--shadow-color)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="primeira-live" className="text-2xl uppercase" style={{ fontFamily: "var(--font-display)" }}>
            Antes da primeira live
          </h2>
          <RefreshButton label="Verificar novamente" pendingLabel="Verificando…" />
        </div>

        {setup && progress ? (
          <>
            <div className="grid gap-2">
              <p className="text-sm font-bold text-[var(--color-ink)]">
                {progress.configured} de {progress.total} etapas registradas
              </p>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.configured}
                aria-label="Etapas registradas antes da primeira live"
                className="h-3 w-full border-[2px] border-[var(--color-ink)] bg-[var(--color-paper)]"
              >
                <div className="h-full bg-[var(--color-mint)]" style={{ width: `${percent}%` }} />
              </div>
              <p className="text-sm text-[var(--color-ink-soft)]">
                Depois de mudar uma configuração, verifique novamente. Itens marcados para verificar na live só se
                confirmam com um teste real.
              </p>
            </div>

            <ol className="grid gap-3">
              {setup.steps.map((step, index) => (
                <li key={step.id} className="grid min-w-0 gap-2 border-[2px] border-[var(--color-ink)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-black">
                      {index + 1}. {step.title}
                    </h3>
                    <span className={`badge-brutal px-2 py-0.5 text-[10px] text-[var(--color-ink)] ${stepTones[step.state]}`}>
                      {stepLabels[step.state]}
                    </span>
                  </div>
                  <p className="break-words text-sm leading-6">{step.detail}</p>
                  {step.href ? (
                    <Link
                      href={step.href}
                      className="inline-flex items-center gap-1 justify-self-start text-sm font-bold underline decoration-2 underline-offset-4"
                    >
                      {step.link}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  ) : null}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p role="alert" className="text-sm">
            Não foi possível verificar a configuração agora. Tente novamente em instantes.
          </p>
        )}
      </section>
    </>
  );
}
