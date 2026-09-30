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
import { creatorColorInk, safeCreatorColor } from "@/lib/creators/profile";

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
      aria-label="Etapas concluídas"
      className="hub-progress"
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

function CommunityCard({ community }: { community: OwnedCommunityCard }) {
  const primary = safeCreatorColor(community.primaryColor, "#c7a2e9");
  const accent = safeCreatorColor(community.accentColor, "#40a9ff");
  const manageHref = community.isLegacy ? LEGACY_ADMIN_URL : communityDashboardPath(community.slug);

  return (
    <article className="hub-card flex min-w-0 flex-col overflow-hidden">
      <div aria-hidden="true" className="h-20" style={{ background: `linear-gradient(120deg, ${primary}, ${accent})` }} />
      <div className="-mt-7 grid flex-1 content-start gap-5 px-6 pb-6">
        <span
          aria-hidden="true"
          className="grid size-14 place-items-center rounded-full text-xl font-bold shadow-[0_0_0_4px_var(--hub-surface)]"
          style={{ background: primary, color: creatorColorInk(primary) }}
        >
          {Array.from(community.displayName)[0]?.toUpperCase()}
        </span>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="hub-h2 min-w-0 break-words">{community.displayName}</h2>
          <CommunityStatusBadge status={community.status} />
        </div>

        {community.isLegacy ? (
          <p className="hub-muted text-sm leading-6">A operação da Ludylops continua na administração da live.</p>
        ) : (
          <dl className="grid gap-3 text-sm">
            {community.setup?.live ? (
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="hub-muted">Moeda</dt>
                <dd className="font-semibold">{community.currencyLabel ?? "Indisponível"}</dd>
              </div>
            ) : null}
            <div className="grid gap-2">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="hub-muted">{community.setup?.live ? "Primeira live" : "Primeiros passos"}</dt>
                <dd className="font-semibold">
                  {community.setup ? `${community.setup.configured} de ${community.setup.total} etapas` : "Indisponível"}
                </dd>
              </div>
              {community.setup ? (
                <SetupProgressBar configured={community.setup.configured} total={community.setup.total} />
              ) : null}
            </div>
            {community.setup?.live ? (
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="hub-muted">Streamer.bot</dt>
                <dd className="font-semibold">
                  {community.setup.authenticated ? "Autenticação recebida" : "Aguardando autenticação"}
                </dd>
              </div>
            ) : null}
          </dl>
        )}

        <a href={community.publicUrl} target="_blank" rel="noreferrer" className="hub-link min-w-0 break-all text-sm">
          {community.publicUrl.replace(/^https?:\/\//u, "")}
          <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
        </a>
      </div>

      <div className="px-6 pb-6">
        <Link href={manageHref} className="hub-btn hub-btn-primary hub-btn-block" aria-label={`Gerenciar ${community.displayName}`}>
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
    <div className="hub-page grid gap-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="hub-h1">Minhas comunidades</h1>
        {canCreate && communities.length > 0 ? (
          <Link href={NEW_COMMUNITY_PATH} className="hub-btn hub-btn-primary">
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
        <div className="hub-card hub-card-pad grid max-w-2xl gap-4 sm:p-8">
          <h2 className="hub-h2">Nenhuma comunidade ainda</h2>
          {canCreate ? (
            <>
              <p className="hub-muted text-[15px] leading-6">
                Escolha o nome e as cores da sua comunidade e compartilhe suas indicações.
              </p>
              <Link href={NEW_COMMUNITY_PATH} className="hub-btn hub-btn-primary justify-self-start">
                <Plus className="size-4" aria-hidden="true" />
                Criar comunidade
              </Link>
            </>
          ) : (
            <p className="hub-muted text-[15px] leading-6">
              Novas comunidades estão em beta fechado, e o acesso é liberado por convite. O email{" "}
              <strong className="text-[var(--hub-ink)]">{session.user?.email}</strong> ainda não está na lista de aprovados.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
