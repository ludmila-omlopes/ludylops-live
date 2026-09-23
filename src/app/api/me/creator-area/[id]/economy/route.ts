import { isTrustedAppMutationRequest, requireApiSession } from "@/lib/api";
import { economyFailure, economyReply, mutateChannelEconomy } from "@/lib/creators/economy-api";
import { readOwnedChannelEconomy } from "@/lib/creators/economy";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession();
    if (!session?.user?.activeViewerId) return economyReply({ ok: false, error: "Entre novamente para continuar." }, 401);
    const { id } = await params;
    const channels = new URL(request.url).searchParams.getAll("viewerExternalId");
    if (channels.length !== 1 || !/^UC[A-Za-z0-9_-]{22}$/.test(channels[0])) return economyReply({ ok: false, error: "Informe o ID do canal do YouTube." }, 400);
    return economyReply({ ok: true, data: await readOwnedChannelEconomy({ creatorId: id }, session.user.activeViewerId, channels[0]) });
  } catch (error) { return economyFailure(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isTrustedAppMutationRequest(request)) return economyReply({ ok: false, error: "Origem inválida." }, 403);
    const session = await requireApiSession();
    if (!session?.user?.activeViewerId) return economyReply({ ok: false, error: "Entre novamente para continuar." }, 401);
    const { id } = await params;
    return economyReply({ ok: true, data: await mutateChannelEconomy({ creatorId: id },
      { kind: "owner", viewerId: session.user.activeViewerId }, await request.json().catch(() => null)) });
  } catch (error) { return economyFailure(error); }
}
