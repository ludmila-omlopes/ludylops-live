import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { CommunitySectionNav } from "@/components/community-section-nav";
import { CommunityStatusBadge } from "@/components/community-status-badge";
import { availableCommunitySections } from "@/lib/creators/community-sections";
import { loadCommunitySection } from "@/lib/creators/community-workspace.server";
import { COMMUNITIES_PATH } from "@/lib/creators/owner-dashboard";
import { safeCreatorColor } from "@/lib/creators/profile";

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
    <div className="surface-section flex w-full flex-1 flex-col">
      <section className="border-b-[3px] border-[var(--color-ink)] bg-[var(--color-paper)]">
        <div
          aria-hidden="true"
          className="h-3 border-b-[3px] border-[var(--color-ink)]"
          style={{ background: `linear-gradient(90deg, ${primary}, ${accent})` }}
        />
        <div className="mx-auto grid w-full max-w-[1200px] gap-3 px-4 py-6 sm:px-6 lg:px-10">
          <Link
            href={COMMUNITIES_PATH}
            className="inline-flex items-center gap-2 justify-self-start text-sm font-bold text-[var(--color-ink-soft)] underline decoration-2 underline-offset-4"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Minhas comunidades
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <p
              className="min-w-0 break-words text-3xl uppercase leading-[0.9] sm:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {community.displayName}
            </p>
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
          {community.status !== "active" ? (
            <p role="status" className="max-w-3xl border-[2px] border-[var(--color-ink)] bg-[var(--color-yellow)] px-3 py-2 text-sm font-bold text-[var(--color-ink)]">
              Comunidade {community.status === "archived" ? "arquivada" : "desativada"}. Você ainda pode revogar suas
              credenciais do Streamer.bot em Integração.
            </p>
          ) : null}
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-[minmax(0,1fr)] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 lg:px-10">
        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <CommunitySectionNav items={sections} />
        </div>
        <div className="min-w-0 max-w-3xl">{children}</div>
      </div>
    </div>
  );
}
