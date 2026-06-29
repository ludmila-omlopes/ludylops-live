import { eq } from "drizzle-orm";

import {
  DEFAULT_CREATOR,
  DEFAULT_CREATOR_BRANDING,
  DEFAULT_CREATOR_DOMAIN,
  DEFAULT_CREATOR_DOMAINS,
  DEFAULT_CREATOR_ID,
  DEFAULT_CREATOR_MODULES,
  DEFAULT_CREATOR_SLUG,
} from "@/lib/creators/defaults";
import { getDb } from "@/lib/db/client";
import { creatorBranding, creatorDomains, creatorModules, creators } from "@/lib/db/schema";
import type {
  CreatorBrandingRecord,
  CreatorDomainRecord,
  CreatorModuleRecord,
  CreatorRecord,
  CreatorTenantRecord,
} from "@/lib/types";

type CreatorDb = Pick<NonNullable<ReturnType<typeof getDb>>, "select">;

type ResolveCreatorOptions = {
  request?: Request | null;
  hostname?: string | null;
  slug?: string | null;
  pathname?: string | null;
};

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

export const defaultCreatorTenant: CreatorTenantRecord = {
  creator: DEFAULT_CREATOR,
  branding: DEFAULT_CREATOR_BRANDING,
  domains: DEFAULT_CREATOR_DOMAINS,
  modules: DEFAULT_CREATOR_MODULES,
};

function toIsoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeHostname(value?: string | null) {
  const hostname = value?.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!hostname) {
    return null;
  }

  const withoutProtocol = hostname.replace(/^https?:\/\//u, "");
  const withoutPath = withoutProtocol.split("/")[0] ?? "";
  const withoutPort =
    withoutPath.startsWith("[") && withoutPath.includes("]")
      ? withoutPath.slice(1, withoutPath.indexOf("]"))
      : withoutPath.split(":")[0];

  return withoutPort || null;
}

function normalizeCreatorSlug(value?: string | null) {
  const slug = value?.trim().toLowerCase() ?? "";
  return /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/u.test(slug) || /^[a-z0-9]$/u.test(slug)
    ? slug
    : null;
}

function getRequestHostname(request?: Request | null) {
  if (!request) {
    return null;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  if (host) {
    return normalizeHostname(host);
  }

  try {
    return normalizeHostname(new URL(request.url).host);
  } catch {
    return null;
  }
}

function getRequestPathname(request?: Request | null) {
  if (!request) {
    return null;
  }

  try {
    return new URL(request.url).pathname;
  } catch {
    return null;
  }
}

function extractCreatorSlugFromPathname(pathname?: string | null) {
  const [, prefix, slug] = pathname?.split("/") ?? [];
  return prefix === "c" ? normalizeCreatorSlug(slug) : null;
}

function extractCreatorSlugFromSubdomain(hostname?: string | null) {
  if (!hostname || hostname === DEFAULT_CREATOR_DOMAIN || !hostname.endsWith(`.${DEFAULT_CREATOR_DOMAIN}`)) {
    return null;
  }

  const subdomain = hostname.slice(0, -DEFAULT_CREATOR_DOMAIN.length - 1);
  return subdomain === "www" ? null : normalizeCreatorSlug(subdomain);
}

function isLocalHostname(hostname?: string | null) {
  return Boolean(hostname && LOCAL_HOSTNAMES.has(hostname));
}

function isMissingCreatorSchemaError(error: unknown) {
  const tableNames = [
    '"creators"',
    '"creator_domains"',
    '"creator_branding"',
    '"creator_modules"',
    "creators",
    "creator_domains",
    "creator_branding",
    "creator_modules",
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
    const mentionsTable = tableNames.some((tableName) => normalized.includes(tableName));

    if (
      mentionsTable &&
      (normalized.includes("does not exist") ||
        normalized.includes("relation") ||
        normalized.includes("table") ||
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

function serializeCreatorBranding(row: typeof creatorBranding.$inferSelect): CreatorBrandingRecord {
  return {
    creatorId: row.creatorId,
    logoUrl: row.logoUrl,
    avatarUrl: row.avatarUrl,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    backgroundColor: row.backgroundColor,
    accentColor: row.accentColor,
    fontHeading: row.fontHeading,
    fontBody: row.fontBody,
    borderRadius: row.borderRadius,
    themeJson: row.themeJson as Record<string, unknown>,
    updatedAt: toIsoDate(row.updatedAt),
  };
}

function serializeCreatorDomain(row: typeof creatorDomains.$inferSelect): CreatorDomainRecord {
  return {
    id: row.id,
    creatorId: row.creatorId,
    hostname: row.hostname,
    isPrimary: row.isPrimary,
    createdAt: toIsoDate(row.createdAt),
  };
}

function serializeCreatorModule(row: typeof creatorModules.$inferSelect): CreatorModuleRecord {
  return {
    id: row.id,
    creatorId: row.creatorId,
    moduleKey: row.moduleKey,
    status: row.status as CreatorModuleRecord["status"],
    configJson: row.configJson as Record<string, unknown>,
    installedAt: toIsoDate(row.installedAt),
    updatedAt: toIsoDate(row.updatedAt),
  };
}

function withDefaultTenantParts(input: {
  creator: CreatorRecord;
  branding: CreatorBrandingRecord | null;
  domains: CreatorDomainRecord[];
  modules: CreatorModuleRecord[];
}): CreatorTenantRecord {
  const isDefaultCreator = input.creator.id === DEFAULT_CREATOR_ID;

  return {
    creator: input.creator,
    branding:
      input.branding ??
      (isDefaultCreator
        ? DEFAULT_CREATOR_BRANDING
        : {
            ...DEFAULT_CREATOR_BRANDING,
            creatorId: input.creator.id,
          }),
    domains: input.domains.length > 0 ? input.domains : isDefaultCreator ? DEFAULT_CREATOR_DOMAINS : [],
    modules: input.modules.length > 0 ? input.modules : isDefaultCreator ? DEFAULT_CREATOR_MODULES : [],
  };
}

async function loadCreatorTenant(db: CreatorDb, creator: CreatorRecord) {
  const [brandingRows, domainRows, moduleRows] = await Promise.all([
    db.select().from(creatorBranding).where(eq(creatorBranding.creatorId, creator.id)).limit(1),
    db.select().from(creatorDomains).where(eq(creatorDomains.creatorId, creator.id)),
    db.select().from(creatorModules).where(eq(creatorModules.creatorId, creator.id)),
  ]);

  return withDefaultTenantParts({
    creator,
    branding: brandingRows[0] ? serializeCreatorBranding(brandingRows[0]) : null,
    domains: domainRows.map(serializeCreatorDomain),
    modules: moduleRows.map(serializeCreatorModule),
  });
}

async function findCreatorBySlug(db: CreatorDb, slug: string) {
  const [row] = await db.select().from(creators).where(eq(creators.slug, slug)).limit(1);
  return row ? serializeCreator(row) : null;
}

async function findCreatorByHostname(db: CreatorDb, hostname: string) {
  const [domainRow] = await db
    .select()
    .from(creatorDomains)
    .where(eq(creatorDomains.hostname, hostname))
    .limit(1);

  if (!domainRow) {
    return null;
  }

  const [creatorRow] = await db
    .select()
    .from(creators)
    .where(eq(creators.id, domainRow.creatorId))
    .limit(1);

  return creatorRow ? serializeCreator(creatorRow) : null;
}

export async function resolveCreatorFromRequest(
  input?: Request | ResolveCreatorOptions | null,
): Promise<CreatorTenantRecord> {
  const options: ResolveCreatorOptions =
    input instanceof Request
      ? { request: input }
      : input && typeof input === "object"
        ? input
        : {};
  const request = options.request ?? null;
  const hostname = normalizeHostname(options.hostname) ?? getRequestHostname(request);
  const explicitSlug =
    normalizeCreatorSlug(options.slug) ??
    normalizeCreatorSlug(request?.headers.get("x-creator-slug")) ??
    extractCreatorSlugFromPathname(options.pathname ?? getRequestPathname(request));
  const subdomainSlug = extractCreatorSlugFromSubdomain(hostname);
  const db = getDb();

  if (!db) {
    return defaultCreatorTenant;
  }

  try {
    const slugForResolution = explicitSlug && (options.slug || isLocalHostname(hostname)) ? explicitSlug : subdomainSlug;
    const creator =
      (hostname && !slugForResolution ? await findCreatorByHostname(db, hostname) : null) ??
      (slugForResolution ? await findCreatorBySlug(db, slugForResolution) : null) ??
      (await findCreatorBySlug(db, DEFAULT_CREATOR_SLUG));

    return creator ? loadCreatorTenant(db, creator) : defaultCreatorTenant;
  } catch (error) {
    if (isMissingCreatorSchemaError(error)) {
      return defaultCreatorTenant;
    }
    throw error;
  }
}

export async function requireCreator(input?: Request | ResolveCreatorOptions | null) {
  return resolveCreatorFromRequest(input);
}
