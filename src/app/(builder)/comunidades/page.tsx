import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink, Plus } from "lucide-react";

import { CommunityStatusBadge } from "@/components/community-status-badge";
import { requireSession } from "@/lib/auth/session";
import { canCreateCreatorArea } from "@/lib/creators/access";
import {
  communityDashboardPath,
  NEW_COMMUNITY_PATH,
  type OwnedCommunityCard,
} from "@/lib/creators/owner-dashboard";
import { listOwnedCommunityCards } from "@/lib/creators/owner-dashboard.server";
import { safeCreatorColor } from "@/lib/creators/profile";

export const metadata: Metadata = {
  title: "Minhas comunidades",
};

const LEGACY_ADMIN_URL = "https://ludylops.live/admin";

function SetupProgressBar({ configured, total }: { configured: number; total: number }) {
  const percent = total > 0 ? Math.round((configured / total) * 100) : 0;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={configured}
      aria-label="Etapas concluídas antes da primeira live"
      className="h-3 w-full border-[2px] border-[var(--color-ink)] bg-[var(--color-paper)]"
    >
      <div className="h-full bg-[var(--color-mint)]" style={{ width: `${percent}%` }} />
    </div>
  );
}

function CommunityCard({ community }: { community: OwnedCommunityCard }) {
  const primary = safeCreatorColor(community.primaryColor, "#c7a2e9");
  const accent = safeCreatorColor(community.accentColor, "#40a9ff");
  const manageHref = community.isLegacy ? LEGACY_ADMIN_URL : communityDashboardPath(community.slug);

  return (
    <article className="flex min-w-0 flex-col border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] shadow-[5px_5px_0_var(--shadow-color)]">
      <div
        aria-hidden="true"
        className="h-4 border-b-[3px] border-[var(--color-ink)]"
        style={{ background: `linear-gradient(90deg, ${primary}, ${accent})` }}
      />
      <div className="grid flex-1 content-start gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2
            className="min-w-0 break-words text-2xl uppercase leading-[0.95] text-[var(--color-ink)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {community.displayName}
          </h2>
          <CommunityStatusBadge status={community.status} />
        </div>

        {community.isLegacy ? (
          <p className="text-sm font-medium leading-6 text-[var(--color-ink-soft)]">
            A operação da Ludylops continua na administração da live.
          </p>
        ) : (
          <dl className="grid gap-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="font-black uppercase tracking-[0.08em] text-[var(--color-ink-soft)]">Moeda</dt>
              <dd className="font-bold text-[var(--color-ink)]">{community.currencyLabel ?? "Indisponível"}</dd>
            </div>
            <div className="grid gap-2">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="font-black uppercase tracking-[0.08em] text-[var(--color-ink-soft)]">
                  Primeira live
                </dt>
                <dd className="font-bold text-[var(--color-ink)]">
                  {community.setup
                    ? `${community.setup.configured} de ${community.setup.total} etapas`
                    : "Indisponível"}
                </dd>
              </div>
              {community.setup ? (
                <SetupProgressBar configured={community.setup.configured} total={community.setup.total} />
              ) : null}
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="font-black uppercase tracking-[0.08em] text-[var(--color-ink-soft)]">Streamer.bot</dt>
              <dd className="font-bold text-[var(--color-ink)]">
                {community.setup
                  ? community.setup.authenticated
                    ? "Autenticação recebida"
                    : "Aguardando autenticação"
                  : "Indisponível"}
              </dd>
            </div>
          </dl>
        )}

        <a
          href={community.publicUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 items-center gap-1 break-all text-sm font-bold text-[var(--color-ink-soft)] underline decoration-2 underline-offset-4"
        >
          {community.publicUrl.replace(/^https?:\/\//u, "")}
          <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
        </a>
      </div>

      <div className="border-t-[3px] border-[var(--color-ink)] p-4">
        <Link
          href={manageHref}
          className="btn-brutal ink-button w-full px-5 py-2.5 text-sm text-[var(--color-accent-ink)]"
          aria-label={`Gerenciar ${community.displayName}`}
        >
          Gerenciar
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export default async function CommunitiesPage() {
  const session = await requireSession();
  const viewerId = session.user!.activeViewerId;
  const [communities, canCreate] = await Promise.all([
    listOwnedCommunityCards(viewerId),
    canCreateCreatorArea(session.user!.email),
  ]);

  return (
    <div className="surface-section flex w-full flex-1 flex-col">
      <section className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 py-10 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1
            className="text-4xl uppercase leading-[0.9] sm:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Minhas comunidades
          </h1>
          {canCreate && communities.length > 0 ? (
            <Link
              href={NEW_COMMUNITY_PATH}
              className="btn-brutal accent-button px-5 py-2.5 text-sm text-[var(--color-accent-ink)]"
            >
              <Plus className="size-4" aria-hidden="true" />
              Nova comunidade
            </Link>
          ) : null}
        </div>

        {communities.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {communities.map((community) => (
              <CommunityCard key={community.id} community={community} />
            ))}
          </div>
        ) : (
          <div className="grid max-w-2xl gap-4 border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-6 shadow-[6px_6px_0_var(--shadow-color)]">
            <h2
              className="text-2xl uppercase text-[var(--color-ink)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Nenhuma comunidade ainda
            </h2>
            {canCreate ? (
              <>
                <p className="text-sm font-medium leading-6 text-[var(--color-ink-soft)]">
                  Escolha o nome, a moeda e as cores da sua comunidade para começar.
                </p>
                <Link
                  href={NEW_COMMUNITY_PATH}
                  className="btn-brutal accent-button justify-self-start px-5 py-2.5 text-sm text-[var(--color-accent-ink)]"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Criar comunidade
                </Link>
              </>
            ) : (
              <p className="text-sm font-medium leading-6 text-[var(--color-ink-soft)]">
                Novas comunidades estão em beta fechado, e o acesso é liberado por convite. O email{" "}
                <strong>{session.user?.email}</strong> ainda não está na lista de aprovados.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
