/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { OwnerManageLink } from "@/components/owner-manage-link";
import { communitySectionPath } from "@/lib/creators/owner-dashboard";
import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";
import { canUseModules } from "@/lib/creators/module-access";
import { getCreatorAreaBySlug } from "@/lib/creators/service";
import { listCreatorRecommendations, RecommendationAccessError } from "@/lib/creators/recommendations.server";

export default async function CreatorProductsPage({ params, searchParams }: {
  params: Promise<{ creatorSlug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { creatorSlug } = await params;
  const h = await headers();
  const tenant = await getCreatorAreaBySlug(creatorSlug, { hostname: h.get("x-forwarded-host") ?? h.get("host") });
  if (!tenant) notFound();
  if (tenant.creator.id === DEFAULT_CREATOR_ID) {
    if (!canUseModules(tenant, ["product_recommendations"])) notFound();
    redirect("/produtinhos");
  }
  if (!canUseModules(tenant, ["product_recommendations"], "recommendations")) notFound();
  const query = await searchParams;
  if (typeof query.cursor !== "undefined" && typeof query.cursor !== "string") notFound();
  let data: Awaited<ReturnType<typeof listCreatorRecommendations>> | null = null;
  try { data = await listCreatorRecommendations(tenant.creator.id, undefined, query.cursor); }
  catch (e) { if (e instanceof RecommendationAccessError || (e instanceof Error && e.message === "invalid_cursor")) notFound(); }
  const session = await auth();
  const owner = Boolean(session?.user?.activeViewerId && session.user.activeViewerId === tenant.creator.ownerUserId);
  const path = `/c/${tenant.creator.slug}/produtinhos`;
  return <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
    <Link href={`/c/${tenant.creator.slug}`} className="font-bold underline">{tenant.creator.displayName}</Link>
    <h1 className="mt-6 break-words text-4xl font-black">Produtos indicados por {tenant.creator.displayName}</h1>
    <p className="mt-4 max-w-2xl leading-7">Escolhas para o setup, o jogo e o dia a dia.</p>
    {owner && <OwnerManageLink className="mt-6" href={communitySectionPath(tenant.creator.slug, "produtos")} label="Gerenciar produtos" />}
    {!data ? <p className="mt-6" role="alert">Não foi possível consultar os produtos agora. Tente novamente mais tarde.</p>
      : <>
        {!data.items.length && <p className="mt-8">Nenhum produto publicado ainda.</p>}
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {data.items.map((product) => <article key={product.id} className="flex min-w-0 flex-col gap-4 border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-5">
            <h2 className="break-words text-2xl font-black">{product.name}</h2>
            <p className="break-words text-sm">{product.category} · {product.storeLabel}</p>
            {product.imageUrl && <img src={product.imageUrl} alt={product.name} loading="lazy" referrerPolicy="no-referrer" className="aspect-[4/3] w-full object-contain" />}
            <p className="whitespace-pre-wrap break-words leading-7">{product.context}</p>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-2">
              <p className="text-sm font-bold">{product.linkKind === "affiliate" ? "Link afiliado" : "Link externo"}</p>
              <a href={product.href} target="_blank" rel={product.linkKind === "affiliate" ? "noopener noreferrer sponsored" : "noopener noreferrer"}
                className="btn-brutal ink-button px-5 py-3 text-xs">Ver produto</a>
            </div>
          </article>)}
        </div>
        <nav aria-label="Mais produtos" className="mt-8 flex flex-wrap gap-6 font-bold underline">
          {query.cursor && <Link href={path}>Produtos mais recentes</Link>}
          {data.nextCursor && <Link href={`${path}?cursor=${encodeURIComponent(data.nextCursor)}`}>Mais produtos</Link>}
        </nav>
      </>}
  </div>;
}
