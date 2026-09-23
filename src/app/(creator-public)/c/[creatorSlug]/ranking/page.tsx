import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CreatorLeaderboard } from "@/components/creator-leaderboard";
import { getCreatorAreaBySlug } from "@/lib/creators/service";
import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";
import { canUseModules } from "@/lib/creators/module-access";
import { canReadCreatorRanking, CreatorRankingUnavailableError, readCreatorRanking } from "@/lib/creators/ranking";

export default async function CreatorRankingPage({ params }: { params: Promise<{ creatorSlug: string }> }) {
  const { creatorSlug } = await params;
  const requestHeaders = await headers();
  const tenant = await getCreatorAreaBySlug(creatorSlug, { hostname: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") });
  if (!tenant) notFound();
  if (tenant.creator.id === DEFAULT_CREATOR_ID) {
    if (!canUseModules(tenant, ["ranking"])) notFound();
    redirect("/ranking");
  }
  if (!canReadCreatorRanking(tenant)) notFound();
  let data: Awaited<ReturnType<typeof readCreatorRanking>> | null = null;
  try { data = await readCreatorRanking({ creatorId: tenant.creator.id }); }
  catch (error) { if (error instanceof CreatorRankingUnavailableError) notFound(); }
  return <div className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-10 sm:px-6">
    <Link href={`/c/${tenant.creator.slug}`} className="font-bold underline">{tenant.creator.displayName}</Link>
    <h1 className="break-words text-4xl font-black">{data ? `Ranking de ${data.currencyLabel}` : "Ranking da comunidade"}</h1>
    {data ? <>
      <p>Os 100 maiores saldos da comunidade de {tenant.creator.displayName}.</p>
      <CreatorLeaderboard {...data} />
      <Link href={`/c/${tenant.creator.slug}/moeda`} className="font-bold underline">Consultar minha moeda</Link>
    </> : <p role="alert">Não foi possível consultar os saldos agora. Tente novamente mais tarde.</p>}
  </div>;
}
