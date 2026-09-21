import { notFound } from "next/navigation";
import Link from "next/link";
import { CreatorQuotes } from "@/components/creator-quotes";
import { resolveQuotePage } from "@/lib/creators/quote-page-context";

export default async function CreatorQuotesPage({ params, searchParams }: {
  params: Promise<{ creatorSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { creatorSlug } = await params;
  const tenant = await resolveQuotePage(await searchParams, creatorSlug);
  if (!tenant) notFound();
  return <>
    <Link href={`/c/${tenant.creator.slug}`} className="block p-4 font-bold">{tenant.creator.displayName}</Link>
    <CreatorQuotes context={{ creatorId: tenant.creator.id }} creatorSlug={tenant.creator.slug} />
  </>;
}
