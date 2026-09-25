import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { CreatorEconomyManager } from "@/components/creator-economy-manager";
import { CreatorChatRewardsForm } from "@/components/creator-chat-rewards-form";
import { getCreatorAreaBySlug } from "@/lib/creators/service";
import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";
import { canUseModules } from "@/lib/creators/module-access";
import { readCreatorEconomy } from "@/lib/creators/economy";
import { getCurrencyLabel } from "@/lib/creators/currency";
import { canReadCreatorRanking } from "@/lib/creators/ranking";

export default async function CreatorCurrencyPage({ params }: { params: Promise<{ creatorSlug: string }> }) {
  const { creatorSlug } = await params;
  const requestHeaders = await headers();
  const tenant = await getCreatorAreaBySlug(creatorSlug, { hostname: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") });
  if (!tenant) notFound();
  if (tenant.creator.id === DEFAULT_CREATOR_ID) {
    if (!canUseModules(tenant, ["points"])) notFound();
    redirect("/me");
  }
  if (!canUseModules(tenant, ["points"], "economy")) notFound();
  const session = await auth();
  const viewerId = session?.user?.activeViewerId;
  const currencyLabel = getCurrencyLabel(tenant.modules.find((m) => m.moduleKey === "points")?.configJson);
  let data: Awaited<ReturnType<typeof readCreatorEconomy>> | null = null;
  let unavailable = false;
  if (viewerId) {
    try { data = await readCreatorEconomy({ creatorId: tenant.creator.id }, { kind: "viewer", viewerId }, viewerId); }
    catch { unavailable = true; }
  }
  return <div className="mx-auto grid w-full max-w-4xl gap-8 px-4 py-10 sm:px-6">
    <Link href={`/c/${tenant.creator.slug}`} className="font-bold underline">{tenant.creator.displayName}</Link>
    <h1 className="break-words text-4xl font-black">Seus {currencyLabel}</h1>
    {canReadCreatorRanking(tenant) && <Link href={`/c/${tenant.creator.slug}/ranking`} className="font-bold underline">Ver ranking da comunidade</Link>}
    {!viewerId ? <a className="font-bold underline" href={`/api/auth/signin?callbackUrl=${encodeURIComponent(`/c/${tenant.creator.slug}/moeda`)}`}>Entre para consultar seu saldo</a>
      : unavailable ? <p role="alert">Não foi possível consultar sua moeda agora. Tente novamente mais tarde.</p>
      : data && <section className="grid gap-4">
        <p className="text-3xl font-bold">{data.balance.currentBalance.toLocaleString("pt-BR")} {currencyLabel}</p>
        <h2 className="text-2xl font-bold">Suas últimas movimentações</h2>
        {!data.entries.length && <p>Você ainda não recebeu {currencyLabel} nesta comunidade.</p>}
        <ul className="grid gap-3">{data.entries.map((entry) => <li key={entry.id} className="border-b border-[var(--color-ink)] py-3">
          <p className="font-bold">{entry.amount > 0 ? "+" : ""}{entry.amount.toLocaleString("pt-BR")} {currencyLabel}</p>
          <p>{entry.reason}</p><time dateTime={new Date(entry.createdAt).toISOString()}>{new Date(entry.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time>
        </li>)}</ul>
      </section>}
    {data && viewerId === tenant.creator.ownerUserId && <>
      <CreatorChatRewardsForm creatorId={tenant.creator.id} />
      <CreatorEconomyManager creatorId={tenant.creator.id} currencyLabel={currencyLabel} />
    </>}
  </div>;
}
