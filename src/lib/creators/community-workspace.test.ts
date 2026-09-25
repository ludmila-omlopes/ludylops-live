import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), getWorkspace: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_HTTP_ERROR_FALLBACK;404"); },
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT;${url}`); },
}));
vi.mock("@/lib/auth/session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/creators/owner-dashboard.server", () => ({ getOwnedCommunityWorkspace: mocks.getWorkspace }));

import { loadCommunitySection } from "@/lib/creators/community-workspace.server";
import { creatorModuleCatalog } from "@/lib/creators/modules";

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
const modules = creatorModuleCatalog.map((module) => ({ moduleKey: module.key, status: "installed" }));
const params = (slug: string) => Promise.resolve({ slug });

describe("community section guard", () => {
  beforeEach(() => {
    mocks.requireSession.mockResolvedValue({ user: { email: "mari@example.com", activeViewerId: "viewer_1" } });
    mocks.getWorkspace.mockReset();
  });

  it("resolves the slug with the session viewer and returns the workspace", async () => {
    mocks.getWorkspace.mockResolvedValue({ community, tenant: { creator: { id: community.id, status: "active" }, modules } });
    await expect(loadCommunitySection(params("canal-da-mari"), "identidade")).resolves.toMatchObject({
      viewerId: "viewer_1",
      community: { slug: "canal-da-mari" },
    });
    expect(mocks.getWorkspace).toHaveBeenCalledWith("viewer_1", "canal-da-mari");
  });

  it("answers 404 for a slug the viewer does not own", async () => {
    mocks.getWorkspace.mockResolvedValue(null);
    await expect(loadCommunitySection(params("outra"), "overview")).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("sends the Ludylops owner to its live administration", async () => {
    mocks.getWorkspace.mockResolvedValue({
      community: { ...community, id: "creator_ludylops", slug: "ludylops", isLegacy: true },
      tenant: { creator: { id: "creator_ludylops", status: "active" }, modules },
    });
    await expect(loadCommunitySection(params("ludylops"), "overview")).rejects.toThrow(
      "NEXT_REDIRECT;https://ludylops.live/admin",
    );
  });

  it("returns to the overview when a section is unavailable", async () => {
    mocks.getWorkspace.mockResolvedValue({
      community: { ...community, status: "disabled" as const },
      tenant: { creator: { id: community.id, status: "disabled" }, modules },
    });
    await expect(loadCommunitySection(params("canal-da-mari"), "identidade")).rejects.toThrow(
      "NEXT_REDIRECT;/comunidades/canal-da-mari",
    );
    await expect(loadCommunitySection(params("canal-da-mari"), "integracao")).resolves.toBeTruthy();
  });
});
