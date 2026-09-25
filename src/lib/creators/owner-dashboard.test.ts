import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/client", () => ({
  getDb: getDbMock,
}));

import { createCreatorArea } from "@/lib/creators/service";
import {
  communityDashboardPath,
  sortOwnedCommunities,
  summarizeSetup,
} from "@/lib/creators/owner-dashboard";
import {
  getOwnedCommunityBySlug,
  listOwnedCommunities,
  listOwnedCommunityCards,
} from "@/lib/creators/owner-dashboard.server";
import type { SetupStep } from "@/lib/creators/setup";
import type { CreatorTenantRecord } from "@/lib/types";

function demoStore() {
  const store = globalThis as typeof globalThis & { __creatorTenantStore?: CreatorTenantRecord[] };
  return store;
}

function step(id: string, state: SetupStep["state"]): SetupStep {
  return { id, title: id, state, detail: "" };
}

describe("owner dashboard helpers", () => {
  it("counts configured setup steps and reports authentication separately", () => {
    expect(
      summarizeSetup({
        steps: [
          step("profile", "configured"),
          step("credential", "pending"),
          step("authentication", "configured"),
          step("bridge", "verify"),
        ],
      }),
    ).toEqual({ configured: 2, total: 4, authenticated: true });

    expect(summarizeSetup({ steps: [step("authentication", "pending")] }).authenticated).toBe(false);
  });

  it("lists active communities first, then disabled and archived, alphabetically", () => {
    const sorted = sortOwnedCommunities([
      { displayName: "Zeta", status: "archived" as const },
      { displayName: "beta", status: "active" as const },
      { displayName: "Omega", status: "disabled" as const },
      { displayName: "Alfa", status: "active" as const },
    ]);

    expect(sorted.map((item) => item.displayName)).toEqual(["Alfa", "beta", "Omega", "Zeta"]);
  });

  it("builds encoded dashboard paths", () => {
    expect(communityDashboardPath("canal-da-mari")).toBe("/comunidades/canal-da-mari");
  });
});

describe("owner dashboard loaders", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    getDbMock.mockReturnValue(null);
    demoStore().__creatorTenantStore = [];
  });

  async function createDemo(ownerId: string, slug: string, displayName: string) {
    return createCreatorArea(ownerId, {
      displayName,
      slug,
      primaryColor: "#11aa99",
      accentColor: "#ffcc00",
    });
  }

  it("lists only the viewer's communities with their colors, including disabled ones", async () => {
    await createDemo("viewer_1", "canal-da-mari", "Canal da Mari");
    const other = await createDemo("viewer_1", "arquivo", "Arquivo");
    await createDemo("viewer_2", "outra", "Outra");
    other.creator.status = "disabled";

    const communities = await listOwnedCommunities("viewer_1");

    expect(communities.map((item) => [item.slug, item.status])).toEqual([
      ["canal-da-mari", "active"],
      ["arquivo", "disabled"],
    ]);
    expect(communities[0]).toMatchObject({ primaryColor: "#11aa99", accentColor: "#ffcc00", isLegacy: false });
  });

  it("resolves a slug only among the viewer's own communities", async () => {
    await createDemo("viewer_1", "canal-da-mari", "Canal da Mari");
    await createDemo("viewer_2", "outra", "Outra");

    await expect(getOwnedCommunityBySlug("viewer_1", "canal-da-mari")).resolves.toMatchObject({ slug: "canal-da-mari" });
    await expect(getOwnedCommunityBySlug("viewer_1", "outra")).resolves.toBeNull();
    await expect(getOwnedCommunityBySlug("viewer_1", "nao-existe")).resolves.toBeNull();
    await expect(getOwnedCommunityBySlug("viewer_1", "../outra")).resolves.toBeNull();
    await expect(getOwnedCommunityBySlug(null, "canal-da-mari")).resolves.toBeNull();
  });

  it("adds currency and setup progress to each card", async () => {
    await createDemo("viewer_1", "canal-da-mari", "Canal da Mari");

    const [card] = await listOwnedCommunityCards("viewer_1");

    expect(card.currencyLabel).toEqual(expect.any(String));
    expect(card.setup).toMatchObject({ total: expect.any(Number), authenticated: false });
    expect(card.setup!.configured).toBeLessThanOrEqual(card.setup!.total);
  });

  it("returns no cards without a session viewer", async () => {
    await expect(listOwnedCommunityCards(undefined)).resolves.toEqual([]);
  });
});
