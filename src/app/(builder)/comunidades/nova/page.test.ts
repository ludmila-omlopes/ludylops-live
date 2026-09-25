import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), canCreate: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT;${url}`); },
}));
vi.mock("@/lib/auth/session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/creators/access", () => ({ canCreateCreatorArea: mocks.canCreate }));

import NewCommunityPage from "./page";

describe("new community page", () => {
  beforeEach(() => {
    mocks.requireSession.mockResolvedValue({ user: { email: "mari@example.com", activeViewerId: "viewer_1" } });
    mocks.canCreate.mockReset();
  });

  it("renders the creation form for approved viewers", async () => {
    mocks.canCreate.mockResolvedValue(true);
    expect(await NewCommunityPage()).toBeTruthy();
    expect(mocks.canCreate).toHaveBeenCalledWith("mari@example.com");
  });

  it("sends viewers outside the beta back to the landing", async () => {
    mocks.canCreate.mockResolvedValue(false);
    await expect(NewCommunityPage()).rejects.toThrow("NEXT_REDIRECT;/criar-area");
  });
});
