import { notFound } from "next/navigation";
import { CreatorQuotes } from "@/components/creator-quotes";
import { resolveQuotePage } from "@/lib/creators/quote-page-context";
import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";

export default async function QuotesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const tenant = await resolveQuotePage(await searchParams);
  if (!tenant || tenant.creator.id !== DEFAULT_CREATOR_ID) notFound();
  return <CreatorQuotes context={{ creatorId: tenant.creator.id }} creatorSlug={tenant.creator.slug} />;
}
