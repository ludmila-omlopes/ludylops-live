import { guardModuleRequest } from '@/lib/creators/module-access';
import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { createCatalogItemFromInput, getCatalog } from "@/lib/db/repository";
import { catalogItemSchema } from "@/lib/streamerbot/schemas";

export async function GET(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["redemptions"]);
  if (moduleDenial) return moduleDenial;

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }
  return ok(await getCatalog());
}

export async function POST(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["redemptions"]);
  if (moduleDenial) return moduleDenial;

  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  const json = await request.json();
  const payload = catalogItemSchema.parse(json);
  const item = await createCatalogItemFromInput({
    slug: payload.slug,
    ...payload,
  });
  return ok(item, { status: 201 });
}
