import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { CommunitySectionNav } from "@/components/community-section-nav";
import { CommunityStatusBadge } from "@/components/community-status-badge";
import { availableCommunitySections } from "@/lib/creators/community-sections";
import { loadCommunitySection } from "@/lib/creators/community-workspace.server";
import { COMMUNITIES_PATH } from "@/lib/creators/owner-dashboard";
import { creatorColorInk, safeCreatorColor } from "@/lib/creators/profile";

export default async function CommunityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { community, tenant } = await loadCommunitySection(params, "overview");
  const primary = safeCreatorColor(community.primaryColor, "#c7a2e9");
  const accent = safeCreatorColor(community.accentColor, "#40a9ff");
  const sections = availableCommunitySections(tenant, community.slug);

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="border-b border-[var(--hub-edge-2)]">
        <div aria-hidden="true" className="h-2" style={{ background: `linear-gradient(90deg, ${primary}, ${accent})` }} />
        <div className="mx-auto grid w-[min(1200px,100%-32px)] gap-3 py-7">
          <Link href={COMMUNITIES_PATH} className="hub-back">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Minhas comunidades
          </Link>
          <div className="flex flex-wrap items-center gap-4">
            <span
              aria-hidden="true"
              className="grid size-12 place-items-center rounded-xl text-lg font-semibold"
              style={{ background: primary, color: creatorColorInk(primary) }}
            >
              {Array.from(community.displayName)[0]?.toUpperCase()}
            </span>
            <p className="min-w-0 break-words text-3xl font-medium tracking-[-0.04em] sm:text-4xl">{community.displayName}</p>
            <CommunityStatusBadge status={community.status} />
          </div>
          <a href={community.publicUrl} target="_blank" rel="noreferrer" className="hub-link min-w-0 justify-self-start break-all text-sm">
            {community.publicUrl.replace(/^https?:\/\//u, "")}
            <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
          </a>
          {community.status !== "active" ? (
            <p role="status" className="hub-notice">
              Comunidade {community.status === "archived" ? "arquivada" : "desativada"}. Você ainda pode revogar suas
              credenciais do Streamer.bot em Integração.
            </p>
          ) : null}
        </div>
      </section>

      <div className="mx-auto grid w-[min(1200px,100%-32px)] grid-cols-[minmax(0,1fr)] gap-6 py-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <CommunitySectionNav items={sections} />
        </div>
        <div className="min-w-0 max-w-3xl pb-16">{children}</div>
      </div>
    </div>
  );
}
