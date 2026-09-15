import { ZodError } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireApiSession } from "@/lib/api";
import { canCreateCreatorArea } from "@/lib/creators/access";
import { CreatorAreaError, creatorAreaErrorLogMetadata } from "@/lib/creators/area-errors.server";
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
  let stage = "authorization";
  try {
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

    stage = "payload";
    let input: unknown;
    try {
      input = await request.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        return fail("Payload inválido.", 400);
      }
      throw error;
    }
    stage = "creation";
    const creatorArea = await createCreatorArea(session.user.activeViewerId, input);
    return ok(creatorArea, { status: 201 });
  } catch (error) {
    if (stage === "creation") {
      if (error instanceof ZodError) {
        return fail(formatCreateCreatorAreaError(error), 400);
      }
      if (error instanceof CreatorAreaError) {
        if (error.code === "creator_slug_exists") {
          return fail(formatCreateCreatorAreaError(error), 409);
        }
        if (error.code === "invalid_creator_slug" || error.code === "creator_slug_reserved") {
          return fail(formatCreateCreatorAreaError(error), 400);
        }
        if (error.code === "missing_creator_owner") {
          return fail(formatCreateCreatorAreaError(error), 401);
        }
      }
    }
    console.error("creator_area_creation_failed", { stage, ...creatorAreaErrorLogMetadata(error) });
    return fail(formatCreateCreatorAreaError(null), 500);
  }
}
