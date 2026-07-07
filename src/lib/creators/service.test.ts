import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/client", () => ({
  getDb: getDbMock,
}));

import {
  createCreatorArea,
  formatCreateCreatorAreaError,
  getCreatorAreaBySlug,
  listCreatorAreasForOwner,
} from "@/lib/creators/service";
import type { CreatorTenantRecord } from "@/lib/types";

function resetDemoStore() {
  (globalThis as typeof globalThis & { __creatorTenantStore?: CreatorTenantRecord[] }).__creatorTenantStore = [];
}

describe("creator area service", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    getDbMock.mockReturnValue(null);
    resetDemoStore();
  });

  it("creates a demo creator area from a logged-in viewer", async () => {
    const tenant = await createCreatorArea("viewer_1", {
      displayName: "Canal da Mari",
      slug: "canal-da-mari",
      primaryColor: "#11aa99",
      accentColor: "#ffcc00",
    });

    expect(tenant.creator).toMatchObject({
      slug: "canal-da-mari",
      displayName: "Canal da Mari",
      ownerUserId: "viewer_1",
    });
    expect(tenant.branding).toMatchObject({
      primaryColor: "#11aa99",
      accentColor: "#ffcc00",
    });
    expect(tenant.domains[0]?.hostname).toBe("canal-da-mari.ludylops.live");
    expect(tenant.modules.map((module) => module.moduleKey)).toContain("points");
  });

  it("resolves a created demo area by slug", async () => {
    await createCreatorArea("viewer_1", {
      displayName: "Cozy Games",
      primaryColor: "#11aa99",
      accentColor: "#ffcc00",
    });

    const tenant = await getCreatorAreaBySlug("cozy-games");

    expect(tenant?.creator.slug).toBe("cozy-games");
  });

  it("lists creator areas owned by the viewer", async () => {
    await createCreatorArea("viewer_1", {
      displayName: "Canal Um",
      primaryColor: "#11aa99",
      accentColor: "#ffcc00",
    });
    await createCreatorArea("viewer_2", {
      displayName: "Canal Dois",
      primaryColor: "#11aa99",
      accentColor: "#ffcc00",
    });

    const areas = await listCreatorAreasForOwner("viewer_1");

    expect(areas).toHaveLength(1);
    expect(areas[0]).toMatchObject({
      slug: "canal-um",
      publicPath: "/c/canal-um",
      publicHostname: "canal-um.ludylops.live",
    });
  });

  it("rejects duplicate and reserved creator slugs", async () => {
    await createCreatorArea("viewer_1", {
      displayName: "Canal Um",
      slug: "canal-um",
      primaryColor: "#11aa99",
      accentColor: "#ffcc00",
    });

    await expect(
      createCreatorArea("viewer_2", {
        displayName: "Outro Canal",
        slug: "canal-um",
        primaryColor: "#11aa99",
        accentColor: "#ffcc00",
      }),
    ).rejects.toThrow("creator_slug_exists");

    await expect(
      createCreatorArea("viewer_2", {
        displayName: "Admin",
        slug: "admin",
        primaryColor: "#11aa99",
        accentColor: "#ffcc00",
      }),
    ).rejects.toThrow("creator_slug_reserved");
  });

  it("formats user-facing errors", () => {
    expect(formatCreateCreatorAreaError(new Error("creator_slug_exists"))).toBe("Esse endereço já está em uso.");
    expect(formatCreateCreatorAreaError(new Error("creator_slug_reserved"))).toBe("Esse endereço é reservado.");
    expect(formatCreateCreatorAreaError(new Error("creator_schema_missing"))).toContain("migrações");
  });

  it("does not crash owner listing when the creator schema is outdated", async () => {
    getDbMock.mockReturnValue({
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  orderBy() {
                    throw new Error('Failed query: column "creators"."owner_user_id" does not exist');
                  },
                };
              },
            };
          },
        };
      },
    });

    await expect(listCreatorAreasForOwner("viewer_1")).resolves.toEqual([]);
  });

  it("returns a controlled error when creating with an outdated creator schema", async () => {
    getDbMock.mockReturnValue({
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  limit: async () => [],
                };
              },
            };
          },
        };
      },
      transaction: async () => {
        throw new Error('Failed query: column "owner_user_id" of relation "creators" does not exist');
      },
    });

    await expect(
      createCreatorArea("viewer_1", {
        displayName: "Canal da Mari",
        primaryColor: "#11aa99",
        accentColor: "#ffcc00",
      }),
    ).rejects.toThrow("creator_schema_missing");
  });
});
