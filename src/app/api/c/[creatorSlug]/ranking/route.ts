import { getCreatorAreaBySlug } from "@/lib/creators/service";
import { canReadCreatorRanking, CreatorRankingUnavailableError, readCreatorRanking } from "@/lib/creators/ranking";

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request, { params }: { params: Promise<{ creatorSlug: string }> }) {
  try {
    const query = new URL(request.url).searchParams;
    const limits = query.getAll("limit");
    if ([...query.keys()].some((key) => key !== "limit") || limits.length > 1
      || (limits.length && (!/^\d{1,3}$/.test(limits[0]) || Number(limits[0]) < 1 || Number(limits[0]) > 100)))
      return reply({ ok: false, error: "Informe um limite de 1 a 100 participantes." }, 400);
    const { creatorSlug } = await params;
    const tenant = await getCreatorAreaBySlug(creatorSlug, { request });
    if (!canReadCreatorRanking(tenant)) throw new CreatorRankingUnavailableError();
    return reply({ ok: true, data: await readCreatorRanking({ creatorId: tenant!.creator.id }, limits.length ? Number(limits[0]) : 100) });
  } catch (error) {
    if (error instanceof CreatorRankingUnavailableError) return reply({ ok: false, error: "Ranking indisponível para esta comunidade." }, 404);
    return reply({ ok: false, error: "Não foi possível consultar os saldos agora. Tente novamente mais tarde." }, 503);
  }
}
