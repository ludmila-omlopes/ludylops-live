import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), getOwned: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_HTTP_ERROR_FALLBACK;404"); },
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT;${url}`); },
}));
vi.mock("@/lib/auth/session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/creators/owner-dashboard.server", () => ({ getOwnedCommunityBySlug: mocks.getOwned }));

import CommunityDashboardPage from "./page";

const community = {
  id: "creator_1",
  slug: "canal-da-mari",
  displayName: "Canal da Mari",
  status: "active" as const,
  publicUrl: "https://hub.example.com/c/canal-da-mari",
  isLegacy: false,
  primaryColor: "#11aa99",
  accentColor: "#ffcc00",
};

describe("community dashboard page", () => {
  beforeEach(() => {
    mocks.requireSession.mockResolvedValue({ user: { email: "mari@example.com", activeViewerId: "viewer_1" } });
    mocks.getOwned.mockReset();
  });

  it("resolves the slug with the session viewer and renders the community", async () => {
    mocks.getOwned.mockResolvedValue(community);
    expect(await CommunityDashboardPage({ params: Promise.resolve({ slug: "canal-da-mari" }) })).toBeTruthy();
    expect(mocks.getOwned).toHaveBeenCalledWith("viewer_1", "canal-da-mari");
  });

  it("answers 404 for a slug the viewer does not own", async () => {
    mocks.getOwned.mockResolvedValue(null);
    await expect(CommunityDashboardPage({ params: Promise.resolve({ slug: "outra" }) })).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
  });

  it("sends the Ludylops owner to its live administration", async () => {
    mocks.getOwned.mockResolvedValue({ ...community, id: "creator_ludylops", slug: "ludylops", isLegacy: true });
    await expect(CommunityDashboardPage({ params: Promise.resolve({ slug: "ludylops" }) })).rejects.toThrow(
      "NEXT_REDIRECT;https://ludylops.live/admin",
    );
  });
});
