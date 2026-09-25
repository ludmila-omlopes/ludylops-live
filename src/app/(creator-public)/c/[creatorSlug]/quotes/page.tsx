import { notFound } from "next/navigation";
import Link from "next/link";
import { CreatorQuotes } from "@/components/creator-quotes";
import { resolveQuotePage } from "@/lib/creators/quote-page-context";
import { auth } from "@/auth";
import { OwnerManageLink } from "@/components/owner-manage-link";
import { communitySectionPath } from "@/lib/creators/owner-dashboard";
import { canUseModules } from "@/lib/creators/module-access";

export default async function CreatorQuotesPage({ params, searchParams }: {
  params: Promise<{ creatorSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { creatorSlug } = await params;
  const tenant = await resolveQuotePage(await searchParams, creatorSlug);
  if (!tenant) notFound();
  const session = await auth();
  const canManage = Boolean(session?.user?.activeViewerId && tenant.creator.ownerUserId === session.user.activeViewerId
    && canUseModules(tenant, ["quotes"], "quotes.manage"));
  return <>
    <Link href={`/c/${tenant.creator.slug}`} className="block p-4 font-bold">{tenant.creator.displayName}</Link>
    {canManage && <div className="mx-auto w-full max-w-4xl px-4 sm:px-6"><OwnerManageLink href={communitySectionPath(tenant.creator.slug, "frases")} label="Gerenciar frases" /></div>}
    <CreatorQuotes context={{ creatorId: tenant.creator.id }} creatorSlug={tenant.creator.slug} />
  </>;
}
