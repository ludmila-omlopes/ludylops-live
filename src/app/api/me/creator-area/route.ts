import { ZodError } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireApiSession } from "@/lib/api";
import { canCreateCreatorArea } from "@/lib/creators/access";
import {
  createCreatorArea,
  formatCreateCreatorAreaError,
  listCreatorAreasForOwner,
} from "@/lib/creators/service";

export async function GET() {
  const session = await requireApiSession();
  if (!session?.user?.activeViewerId) {
    return fail("Unauthorized", 401);
  }
  if (!(await canCreateCreatorArea(session.user.email))) {
    return fail("Forbidden", 403);
  }

  return ok(await listCreatorAreasForOwner(session.user.activeViewerId));
}

export async function POST(request: Request) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireApiSession();
  if (!session?.user?.activeViewerId) {
    return fail("Unauthorized", 401);
  }
  if (!(await canCreateCreatorArea(session.user.email))) {
    return fail("Forbidden", 403);
  }

  try {
    const creatorArea = await createCreatorArea(session.user.activeViewerId, await request.json());
    return ok(creatorArea, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail("Payload inválido.", 400);
    }

    return fail(formatCreateCreatorAreaError(error instanceof ZodError ? error : error), 400);
  }
}
