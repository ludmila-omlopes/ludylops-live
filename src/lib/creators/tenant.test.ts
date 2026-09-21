import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/client", () => ({
  getDb: getDbMock,
}));
vi.mock("@/lib/env", () => ({ isDemoMode: false }));

import { DEFAULT_CREATOR_ID, DEFAULT_CREATOR_SLUG } from "@/lib/creators/defaults";
import { getEnabledModuleNav } from "@/lib/creators/modules";
import { getCreatorRootPath } from "@/lib/creators/hostname-routing";
import { defaultCreatorTenant, requireCreator, resolveCreatorFromRequest, resolvePublicCreatorFromRequest } from "@/lib/creators/tenant";
import { listPlatformCreatorInstances, updatePlatformCreatorStatus } from "@/lib/creators/instances";
import { getCreatorAreaBySlug, listCreatorAreasForOwner } from "@/lib/creators/service";
import { creatorBranding, creatorDomains, creatorModules, creators } from "@/lib/db/schema";

type CreatorRow = typeof creators.$inferSelect;
type CreatorDomainRow = typeof creatorDomains.$inferSelect;
type CreatorBrandingRow = typeof creatorBranding.$inferSelect;
type CreatorModuleRow = typeof creatorModules.$inferSelect;

function getStringValueFromWhereClause(whereClause: unknown) {
  if (!whereClause || typeof whereClause !== "object" || !("queryChunks" in whereClause)) {
    return null;
  }

  const queryChunks = (whereClause as { queryChunks?: unknown[] }).queryChunks;
  if (!Array.isArray(queryChunks)) {
    return null;
  }

  for (const chunk of queryChunks) {
    if (chunk && typeof chunk === "object" && "value" in chunk) {
      const value = (chunk as { value?: unknown }).value;
      if (typeof value === "string") {
        return value;
      }
    }
  }

  return null;
}

function createCreatorDb({
  creatorRows = [],
  domainRows = [],
  brandingRows = [],
  moduleRows = [],
  error,
}: {
  creatorRows?: CreatorRow[];
  domainRows?: CreatorDomainRow[];
  brandingRows?: CreatorBrandingRow[];
  moduleRows?: CreatorModuleRow[];
  error?: Error;
}) {
  function rowsForTable(table: unknown, whereClause?: unknown) {
    if (error) {
      throw error;
    }

    const value = getStringValueFromWhereClause(whereClause);

    if (table === creators) {
      return value
        ? creatorRows.filter((row) => row.id === value || row.slug === value || row.ownerUserId === value)
        : creatorRows;
    }

    if (table === creatorDomains) {
      return value
        ? domainRows.filter((row) => row.creatorId === value || row.hostname === value)
        : domainRows;
    }

    if (table === creatorBranding) {
      return value ? brandingRows.filter((row) => row.creatorId === value) : brandingRows;
    }

    if (table === creatorModules) {
      return value ? moduleRows.filter((row) => row.creatorId === value) : moduleRows;
    }

    throw new Error("Unexpected table in creator db test stub.");
  }

  return {
    update() {
      return {
        set(values: Partial<CreatorRow>) {
          return {
            where(whereClause: unknown) {
              const rows = rowsForTable(creators, whereClause) as CreatorRow[];
              rows.forEach((row) => Object.assign(row, values));
              return { returning: async () => rows };
            },
          };
        },
      };
    },
    select() {
      return {
        from(table: unknown) {
          return {
            leftJoin() {
              return { orderBy: async () => rowsForTable(table) };
            },
            where(whereClause: unknown) {
              const rows = rowsForTable(table, whereClause);
              return Object.assign(rows, {
                limit: async (count: number) => rows.slice(0, count),
                orderBy: async () => rows,
              });
            },
          };
        },
      };
    },
  };
}

function creatorRow(input: Partial<CreatorRow> = {}): CreatorRow {
  return {
    id: DEFAULT_CREATOR_ID,
    slug: DEFAULT_CREATOR_SLUG,
    displayName: "Ludylops",
    ownerUserId: null,
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...input,
  };
}

describe("creator tenant resolution", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("falls back to the default creator without a database", async () => {
    getDbMock.mockReturnValue(null);

    const tenant = await resolveCreatorFromRequest();

    expect(tenant.creator.slug).toBe("ludylops");
    expect(tenant.modules.map((module) => module.moduleKey)).toContain("product_recommendations");
  });

  it("resolves a creator by custom domain", async () => {
    getDbMock.mockReturnValue(
      createCreatorDb({
        creatorRows: [
          creatorRow({
            id: "creator_cozy",
            slug: "cozygames",
            displayName: "Cozy Games",
          }),
          creatorRow(),
        ],
        domainRows: [
          {
            id: "domain_cozy",
            creatorId: "creator_cozy",
            hostname: "cozy.example.com",
            isPrimary: true,
            createdAt: new Date("2026-01-02T00:00:00.000Z"),
          },
        ],
      }),
    );

    const tenant = await resolveCreatorFromRequest({
      hostname: "cozy.example.com",
    });

    expect(tenant.creator).toMatchObject({
      id: "creator_cozy",
      slug: "cozygames",
      displayName: "Cozy Games",
    });
  });

  it("resolves a local dev creator by /c/:slug", async () => {
    getDbMock.mockReturnValue(
      createCreatorDb({
        creatorRows: [
          creatorRow({
            id: "creator_teste",
            slug: "teste",
            displayName: "Criador Teste",
          }),
          creatorRow(),
        ],
      }),
    );

    const request = new Request("http://localhost:3000/c/teste/produtinhos");
    const tenant = await resolveCreatorFromRequest(request);

    expect(tenant.creator).toMatchObject({
      id: "creator_teste",
      slug: "teste",
    });
  });

  it("keeps the default creator available while the creator schema is missing", async () => {
    getDbMock.mockReturnValue(
      createCreatorDb({
        error: new Error('Failed query: select * from "creators": relation "creators" does not exist'),
      }),
    );

    const tenant = await resolveCreatorFromRequest({
      hostname: "ludylops.live",
    });

    expect(tenant).toBe(defaultCreatorTenant);
  });

  it("derives public navigation from installed modules", () => {
    const nav = getEnabledModuleNav([
      {
        id: "creator_module_test_bets",
        creatorId: "creator_test",
        moduleKey: "bets",
        status: "installed",
        configJson: {},
        installedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "creator_module_test_quotes",
        creatorId: "creator_test",
        moduleKey: "quotes",
        status: "disabled",
        configJson: {},
        installedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    expect(nav).toEqual([
      {
        key: "bets",
        label: "Apostas",
        href: "/apostas",
      },
    ]);
  });
});

describe("public creator lifecycle policy", () => {
  let cozy: CreatorRow;
  let defaultCreator: CreatorRow;

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    globalThis.__creatorTenantStore = [];
    cozy = creatorRow({ id: "creator_cozy", slug: "cozy", ownerUserId: "owner_cozy" });
    defaultCreator = creatorRow();
    getDbMock.mockReturnValue(createCreatorDb({
      creatorRows: [defaultCreator, cozy],
      domainRows: ["cozy.example.com", "cozy.ludylops.live"].map((hostname, index) => ({
        id: `domain_${index}`, creatorId: cozy.id, hostname, isPrimary: index === 0, createdAt: new Date(),
      })).concat([{
        id: "domain_default", creatorId: defaultCreator.id, hostname: "ludylops.live", isPrimary: true, createdAt: new Date(),
      }]),
    }));
  });

  it.each(["active", "disabled", "archived"] as const)("serves only active creators by slug and hostname: %s", async (status) => {
    cozy.status = status;
    for (const input of [
      { slug: "cozy" },
      { hostname: "cozy.example.com" },
      { hostname: "cozy.ludylops.live" },
      { hostname: "ludylops.live", pathname: "/c/cozy" },
      { hostname: "localhost:3000", pathname: "/c/cozy" },
    ]) {
      const result = await resolvePublicCreatorFromRequest(input);
      expect(result?.creator.id ?? null).toBe(status === "active" ? cozy.id : null);
    }
    expect((await getCreatorAreaBySlug("cozy"))?.creator.id ?? null).toBe(status === "active" ? cozy.id : null);
    const request = new Request("https://cozy.ludylops.live/");
    const destination = getCreatorRootPath(request);
    expect(destination).toBe("/c/cozy");
    const rewritten = new Request(new URL(destination!, request.url));
    expect((await resolvePublicCreatorFromRequest(rewritten))?.creator.id ?? null).toBe(status === "active" ? cozy.id : null);
  });

  it.each([
    {}, { slug: "" }, { slug: null }, { slug: "bad/slug" }, { slug: "unknown" },
    { hostname: "unknown.example.com" },
    { hostname: "unknown.example.com", slug: "cozy" },
    { hostname: "unknown.ludylops.live", pathname: "/" },
    { hostname: "cozy.example.com", slug: "ludylops" },
    { hostname: "localhost", pathname: "/c" },
    { hostname: "localhost", pathname: "/c/" },
    { hostname: "localhost", pathname: "/c/%2F" },
    { hostname: "localhost", pathname: "/c/cozy", slug: "ludylops" },
    { hostname: "localhost", pathname: "/", slug: "!" },
    { hostname: "ludylops.live", pathname: "/admin" },
    { hostname: "ludylops.live", pathname: "/api/quotes" },
    { hostname: "ludylops.live" },
    { hostname: "ludylops.live", pathname: "/unknown" },
    { hostname: "localhost/unknown", slug: "cozy" },
    { hostname: "ludylops.live:garbage", pathname: "/" },
    { hostname: "ludylops.live:99999", pathname: "/" },
    { hostname: "https://ludylops.live", pathname: "/" },
    { hostname: "user@ludylops.live", pathname: "/" },
    { hostname: "ludylops.live?anything", pathname: "/" },
    { hostname: "", slug: "cozy" },
  ])("rejects missing, invalid, unknown or conflicting contexts: %j", async (input) => {
    await expect(resolvePublicCreatorFromRequest(input)).resolves.toBeNull();
  });

  it("does not lose invalid or conflicting header slugs during normalization", async () => {
    for (const slug of ["", "!", "ludylops"]) {
      await expect(resolvePublicCreatorFromRequest(new Request("http://localhost/c/cozy", {
        headers: { "x-creator-slug": slug },
      }))).resolves.toBeNull();
    }
    await expect(resolvePublicCreatorFromRequest(new Request("https://cozy.example.com/c/cozy", {
      headers: { "x-creator-slug": "cozy" },
    }))).resolves.toMatchObject({ creator: { id: cozy.id } });
  });

  it.each(["ludylops.live", "www.ludylops.live", "localhost:3000", "127.0.0.1:3000", "[::1]:3000"])("allows default only for explicit legacy host/path: %s", async (hostname) => {
    await expect(resolvePublicCreatorFromRequest({ hostname, pathname: "/quotes" })).resolves.toMatchObject({ creator: { id: defaultCreator.id } });
    defaultCreator.status = "disabled";
    await expect(resolvePublicCreatorFromRequest({ hostname, pathname: "/quotes" })).resolves.toBeNull();
  });

  it("allows only exact configured deployment hosts", async () => {
    vi.stubEnv("APP_URL", "https://product.example.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://public.example.com");
    vi.stubEnv("VERCEL_URL", "this-preview.vercel.app");
    for (const hostname of ["product.example.com", "public.example.com", "this-preview.vercel.app"]) {
      await expect(resolvePublicCreatorFromRequest({ hostname, slug: "cozy" })).resolves.toMatchObject({ creator: { id: cozy.id } });
    }
    for (const hostname of ["other-preview.vercel.app", "sub.product.example.com"]) {
      await expect(resolvePublicCreatorFromRequest({ hostname, slug: "cozy" })).resolves.toBeNull();
    }
  });

  it("uses the first forwarded host and never retries another host after rejection", async () => {
    await expect(resolvePublicCreatorFromRequest(new Request("http://internal/c/cozy", {
      headers: { "x-forwarded-host": "cozy.example.com, internal", host: "internal" },
    }))).resolves.toMatchObject({ creator: { id: cozy.id } });
    await expect(resolvePublicCreatorFromRequest(new Request("http://localhost/c/cozy", {
      headers: { "x-forwarded-host": "unknown.example.com, localhost", host: "localhost" },
    }))).resolves.toBeNull();
  });

  it("does not turn database or missing-schema failures into an active default", async () => {
    for (const message of ['Failed query: select * from "creators"', 'relation "creators" does not exist']) {
      getDbMock.mockReturnValue(createCreatorDb({ error: new Error(message) }));
      await expect(resolvePublicCreatorFromRequest({ hostname: "ludylops.live", pathname: "/" })).rejects.toThrow(message);
    }
    getDbMock.mockReturnValue(createCreatorDb({}));
    await expect(resolvePublicCreatorFromRequest({ hostname: "ludylops.live", pathname: "/" })).resolves.toBeNull();
  });

  it("keeps administrative visibility and recovery through persisted lifecycle transitions", async () => {
    for (const status of ["disabled", "active", "archived", "active"] as const) {
      await expect(updatePlatformCreatorStatus({ creatorId: cozy.id, status })).resolves.toMatchObject({ id: cozy.id, status });
      expect((await listPlatformCreatorInstances()).find((entry) => entry.creator.id === cozy.id)?.creator.status).toBe(status);
      expect((await resolveCreatorFromRequest({ slug: "cozy" })).creator.status).toBe(status);
      expect((await listCreatorAreasForOwner("owner_cozy")).length).toBe(status === "archived" ? 0 : 1);
      expect((await getCreatorAreaBySlug("cozy"))?.creator.id ?? null).toBe(status === "active" ? cozy.id : null);
      expect((await resolvePublicCreatorFromRequest({ hostname: "cozy.example.com" }))?.creator.id ?? null).toBe(status === "active" ? cozy.id : null);
    }
  });

  it("throws a generic unavailable error from the required public resolver", async () => {
    cozy.status = "archived";
    await expect(requireCreator({ slug: "cozy" })).rejects.toThrow("creator_unavailable");
    await expect(requireCreator({ slug: "ludylops" })).resolves.toMatchObject({ creator: { id: defaultCreator.id } });
  });

  it("applies the same public policy to stored demo creators without inventing host mappings", async () => {
    getDbMock.mockReturnValue(null);
    const tenant = structuredClone(defaultCreatorTenant);
    tenant.creator = { ...tenant.creator, id: "demo_cozy", slug: "cozy" };
    tenant.domains = [{ ...tenant.domains[0], creatorId: "demo_cozy", hostname: "cozy.example.com" }];
    globalThis.__creatorTenantStore = [tenant];
    await expect(resolvePublicCreatorFromRequest({ slug: "cozy" })).resolves.toBe(tenant);
    await expect(resolvePublicCreatorFromRequest({ hostname: "cozy.ludylops.live" })).resolves.toBeNull();
    for (const status of ["disabled", "archived"] as const) {
      tenant.creator.status = status;
      await expect(resolvePublicCreatorFromRequest({ hostname: "cozy.example.com" })).resolves.toBeNull();
      await expect(getCreatorAreaBySlug("cozy")).resolves.toBeNull();
    }
    await expect(resolvePublicCreatorFromRequest({ hostname: "unknown.example.com", pathname: "/" })).resolves.toBeNull();
  });
});
