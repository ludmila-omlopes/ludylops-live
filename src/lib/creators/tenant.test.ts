import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/client", () => ({
  getDb: getDbMock,
}));

import { DEFAULT_CREATOR_ID, DEFAULT_CREATOR_SLUG } from "@/lib/creators/defaults";
import { getEnabledModuleNav } from "@/lib/creators/modules";
import { defaultCreatorTenant, resolveCreatorFromRequest } from "@/lib/creators/tenant";
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
        ? creatorRows.filter((row) => row.id === value || row.slug === value)
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
    select() {
      return {
        from(table: unknown) {
          return {
            where(whereClause: unknown) {
              const rows = rowsForTable(table, whereClause);
              return Object.assign(rows, {
                limit: async (count: number) => rows.slice(0, count),
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
