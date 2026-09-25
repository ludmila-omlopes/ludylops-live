import { guardModuleRequest } from '@/lib/creators/module-access';
import { fail, ok, requireApiSession } from "@/lib/api";
import { getViewerLinkCodeState, issueViewerLinkCode } from "@/lib/db/repository";

export async function GET(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["streamerbot"]);
  if (moduleDenial) return moduleDenial;

  const session = await requireApiSession();
  if (!session?.user?.googleAccountId) {
    return fail("Unauthorized", 401);
  }

  const link = await getViewerLinkCodeState(session.user.googleAccountId);
  return ok({
    link,
  });
}

export async function POST(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["streamerbot"]);
  if (moduleDenial) return moduleDenial;

  const session = await requireApiSession();
  if (!session?.user?.googleAccountId) {
    return fail("Unauthorized", 401);
  }

  const link = await issueViewerLinkCode(session.user.googleAccountId);
  return ok({
    link,
  });
}
