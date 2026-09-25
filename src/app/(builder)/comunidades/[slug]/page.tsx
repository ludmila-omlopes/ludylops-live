import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { CommunityStatusBadge } from "@/components/community-status-badge";
import { CreatorChatRewardsForm } from "@/components/creator-chat-rewards-form";
import { CreatorCurrencyForm } from "@/components/creator-currency-form";
import { CreatorProfileForm } from "@/components/creator-profile-form";
import { CreatorSetup } from "@/components/creator-setup";
import { PeriodicMessagesManager } from "@/components/periodic-messages-manager";
import { StreamerbotCredentials } from "@/components/streamerbot-credentials";
import { requireSession } from "@/lib/auth/session";
import { COMMUNITIES_PATH } from "@/lib/creators/owner-dashboard";
import { getOwnedCommunityBySlug } from "@/lib/creators/owner-dashboard.server";
import { safeCreatorColor } from "@/lib/creators/profile";

type CommunityPageProps = {
  params: Promise<{ slug: string }>;
};

const LEGACY_ADMIN_URL = "https://ludylops.live/admin";

export const metadata: Metadata = {
  title: "Gerenciar comunidade",
};

export default async function CommunityDashboardPage({ params }: CommunityPageProps) {
  const session = await requireSession();
  const { slug } = await params;
  const community = await getOwnedCommunityBySlug(session.user!.activeViewerId, slug);

  if (!community) {
    notFound();
  }
  if (community.isLegacy) {
    redirect(LEGACY_ADMIN_URL);
  }

  const active = community.status === "active";
  const primary = safeCreatorColor(community.primaryColor, "#c7a2e9");
  const accent = safeCreatorColor(community.accentColor, "#40a9ff");
  const publicPath = `/c/${encodeURIComponent(community.slug)}`;

  return (
    <div className="surface-section flex w-full flex-1 flex-col">
      <section className="border-b-[3px] border-[var(--color-ink)] bg-[var(--color-paper)]">
        <div
          aria-hidden="true"
          className="h-3 border-b-[3px] border-[var(--color-ink)]"
          style={{ background: `linear-gradient(90deg, ${primary}, ${accent})` }}
        />
        <div className="mx-auto grid w-full max-w-[1200px] gap-4 px-4 py-8 sm:px-6 lg:px-10">
          <Link
            href={COMMUNITIES_PATH}
            className="inline-flex items-center gap-2 justify-self-start text-sm font-bold text-[var(--color-ink-soft)] underline decoration-2 underline-offset-4"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Minhas comunidades
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1
              className="min-w-0 break-words text-4xl uppercase leading-[0.9] sm:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {community.displayName}
            </h1>
            <CommunityStatusBadge status={community.status} />
          </div>
          <a
            href={community.publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-w-0 items-center gap-1 justify-self-start break-all text-sm font-bold text-[var(--color-ink)] underline decoration-2 underline-offset-4"
          >
            {community.publicUrl.replace(/^https?:\/\//u, "")}
            <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
          </a>
          {!active ? (
            <p role="status" className="max-w-3xl border-[2px] border-[var(--color-ink)] bg-[var(--color-yellow)] px-3 py-2 text-sm font-bold text-[var(--color-ink)]">
              Comunidade {community.status === "archived" ? "arquivada" : "desativada"}. Você ainda pode revogar suas
              credenciais do Streamer.bot.
            </p>
          ) : null}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1200px] gap-2 px-4 py-8 sm:px-6 lg:px-10">
        <div className="max-w-3xl">
          <CreatorSetup creatorId={community.id} />
          {active ? (
            <>
              <div id={`perfil-${community.id}`} className="scroll-mt-24">
                <CreatorProfileForm creatorId={community.id} />
              </div>
              <CreatorCurrencyForm creatorId={community.id} />
              <div id={`ganhos-${community.id}`} className="scroll-mt-24">
                <CreatorChatRewardsForm creatorId={community.id} />
              </div>
              <PeriodicMessagesManager creatorId={community.id} />
              <Link href={`${publicPath}/quotes#gerenciar-frases`} className="mt-3 block font-bold underline">
                Gerenciar frases
              </Link>
              <Link href={`${publicPath}/produtinhos`} className="mt-3 block font-bold underline">
                Gerenciar produtos
              </Link>
            </>
          ) : null}
          <div id={`integracao-${community.id}`} className="scroll-mt-24">
            <StreamerbotCredentials creatorId={community.id} enabled={active} mode="creator" />
          </div>
        </div>
      </section>
    </div>
  );
}
