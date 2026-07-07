import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import {
  createCreatorAreaSchema,
  flattenCreatorAreaSchemaErrors,
  formatCreateCreatorAreaError,
  type CreateCreatorAreaInput,
} from "@/lib/creators/area-form";
import { DEFAULT_CREATOR_BRANDING, DEFAULT_CREATOR_DOMAIN } from "@/lib/creators/defaults";
import {
  buildDemoCreatorModules,
  findDemoCreatorTenantBySlug,
  findDemoCreatorTenantsByOwner,
  insertDemoCreatorTenant,
} from "@/lib/creators/demo-store";
import { creatorSlugFromInput, isReservedCreatorSlug, normalizeCreatorSlug } from "@/lib/creators/identity";
import { creatorModuleCatalog } from "@/lib/creators/modules";
import { resolveCreatorFromRequest } from "@/lib/creators/tenant";
import { getDb } from "@/lib/db/client";
import { creatorBranding, creatorDomains, creatorModules, creators } from "@/lib/db/schema";
import type { CreatorRecord, CreatorTenantRecord } from "@/lib/types";

// Client-safe validation/formatting lives in area-form.ts so the "use client"
// CreatorAreaCreateForm can import it without dragging this server module (and
// its db/env dependencies) into the browser bundle. Re-exported here so
// existing server-side imports from "@/lib/creators/service" keep working.
export {
  createCreatorAreaSchema,
  formatCreateCreatorAreaError,
  flattenCreatorAreaSchemaErrors,
  type CreateCreatorAreaInput,
};

export type CreatorAreaSummary = CreatorRecord & {
  publicPath: string;
  publicHostname: string;
};

function nowIso() {
  return new Date().toISOString();
}

function toIsoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function serializeCreator(row: typeof creators.$inferSelect): CreatorRecord {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    ownerUserId: row.ownerUserId,
    status: row.status as CreatorRecord["status"],
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
  };
}

function toAreaSummary(creator: CreatorRecord): CreatorAreaSummary {
  return {
    ...creator,
    publicPath: `/c/${creator.slug}`,
    publicHostname: `${creator.slug}.${DEFAULT_CREATOR_DOMAIN}`,
  };
}

function isMissingCreatorSchemaError(error: unknown) {
  const schemaTerms = [
    '"creators"',
    '"creator_domains"',
    '"creator_branding"',
    '"creator_modules"',
    "creators",
    "creator_domains",
    "creator_branding",
    "creator_modules",
    "owner_user_id",
    "display_name",
  ];
  const queue: unknown[] = [error];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);

    const message = current instanceof Error ? current.message : typeof current === "string" ? current : "";
    const normalized = message.toLowerCase();
    const mentionsCreatorSchema = schemaTerms.some((term) => normalized.includes(term));

    if (
      mentionsCreatorSchema &&
      (normalized.includes("does not exist") ||
        normalized.includes("relation") ||
        normalized.includes("column") ||
        normalized.includes("failed query"))
    ) {
      return true;
    }

    if (typeof current === "object" && current && "cause" in current) {
      queue.push((current as { cause?: unknown }).cause);
    }
  }

  return false;
}


function parseCreatorAreaInput(input: unknown) {
  const parsed = createCreatorAreaSchema.parse(input);
  const slug = creatorSlugFromInput(parsed);
  if (!slug) {
    throw new Error("invalid_creator_slug");
  }
  if (isReservedCreatorSlug(slug)) {
    throw new Error("creator_slug_reserved");
  }
  return { ...parsed, slug };
}

function buildDemoTenant(input: {
  ownerUserId: string;
  displayName: string;
  slug: string;
  primaryColor: string;
  accentColor: string;
}): CreatorTenantRecord {
  const creatorId = `creator_${input.slug}`.slice(0, 64);
  const now = nowIso();

  return {
    creator: {
      id: creatorId,
      slug: input.slug,
      displayName: input.displayName,
      ownerUserId: input.ownerUserId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    branding: {
      ...DEFAULT_CREATOR_BRANDING,
      creatorId,
      primaryColor: input.primaryColor,
      accentColor: input.accentColor,
      updatedAt: now,
    },
    domains: [
      {
        id: `domain_${input.slug}`.slice(0, 64),
        creatorId,
        hostname: `${input.slug}.${DEFAULT_CREATOR_DOMAIN}`,
        isPrimary: true,
        createdAt: now,
      },
    ],
    modules: buildDemoCreatorModules(creatorId),
  };
}

export async function createCreatorArea(ownerUserId: string | null | undefined, input: unknown) {
  if (!ownerUserId) {
    throw new Error("missing_creator_owner");
  }

  const parsed = parseCreatorAreaInput(input);
  const db = getDb();

  if (!db) {
    if (findDemoCreatorTenantBySlug(parsed.slug)) {
      throw new Error("creator_slug_exists");
    }
    return insertDemoCreatorTenant(
      buildDemoTenant({
        ownerUserId,
        displayName: parsed.displayName,
        slug: parsed.slug,
        primaryColor: parsed.primaryColor,
        accentColor: parsed.accentColor,
      }),
    );
  }

  try {
    const [existing] = await db
      .select({ id: creators.id })
      .from(creators)
      .where(eq(creators.slug, parsed.slug))
      .limit(1);
    if (existing) {
      throw new Error("creator_slug_exists");
    }

    const creatorId = `creator_${randomUUID()}`.slice(0, 64);
    const domainId = `creator_domain_${randomUUID()}`.slice(0, 64);

    await db.transaction(async (tx) => {
      await tx.insert(creators).values({
        id: creatorId,
        slug: parsed.slug,
        displayName: parsed.displayName,
        ownerUserId,
        status: "active",
      });

      await tx.insert(creatorDomains).values({
        id: domainId,
        creatorId,
        hostname: `${parsed.slug}.${DEFAULT_CREATOR_DOMAIN}`,
        isPrimary: true,
      });

      await tx.insert(creatorBranding).values({
        creatorId,
        primaryColor: parsed.primaryColor,
        secondaryColor: DEFAULT_CREATOR_BRANDING.secondaryColor,
        backgroundColor: DEFAULT_CREATOR_BRANDING.backgroundColor,
        accentColor: parsed.accentColor,
        fontHeading: DEFAULT_CREATOR_BRANDING.fontHeading,
        fontBody: DEFAULT_CREATOR_BRANDING.fontBody,
        borderRadius: DEFAULT_CREATOR_BRANDING.borderRadius,
        themeJson: {},
      });

      await tx.insert(creatorModules).values(
        creatorModuleCatalog.map((module) => ({
          id: `creator_module_${randomUUID()}`.slice(0, 64),
          creatorId,
          moduleKey: module.key,
          status: "installed",
          configJson: module.defaultConfig,
        })),
      );
    });
  } catch (error) {
    if (isMissingCreatorSchemaError(error)) {
      throw new Error("creator_schema_missing");
    }
    throw error;
  }

  return resolveCreatorFromRequest({ slug: parsed.slug });
}

export async function listCreatorAreasForOwner(ownerUserId: string | null | undefined): Promise<CreatorAreaSummary[]> {
  if (!ownerUserId) {
    return [];
  }

  const db = getDb();
  if (!db) {
    return findDemoCreatorTenantsByOwner(ownerUserId).map((tenant) => toAreaSummary(tenant.creator));
  }

  let rows: Array<typeof creators.$inferSelect>;
  try {
    rows = await db
      .select()
      .from(creators)
      .where(eq(creators.ownerUserId, ownerUserId))
      .orderBy(desc(creators.createdAt));
  } catch (error) {
    if (isMissingCreatorSchemaError(error)) {
      return [];
    }
    throw error;
  }

  return rows.map((row) => toAreaSummary(serializeCreator(row)));
}

export async function getCreatorAreaBySlug(slugInput: string | null | undefined) {
  const slug = normalizeCreatorSlug(slugInput);
  if (!slug) {
    return null;
  }

  const tenant = await resolveCreatorFromRequest({ slug });
  return tenant.creator.slug === slug ? tenant : null;
}
