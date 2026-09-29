import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), settings: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAdminSession: mocks.requireAdmin }));
vi.mock("@/lib/creators/access", () => ({ getCreatorAreaAccessSettings: mocks.settings }));
vi.mock("@/components/admin-creator-area-access-panel", () => ({ AdminCreatorAreaAccessPanel: () => null }));
import BetaAdminPage from "./page";

describe("platform beta administration", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it("does not load beta data before admin authorization", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT;/"));
    await expect(BetaAdminPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.settings).not.toHaveBeenCalled();
  });
  it("renders for a general admin without a live community", async () => {
    mocks.requireAdmin.mockResolvedValue({ user: { email: "admin@example.com" } });
    mocks.settings.mockResolvedValue({ allowedEmails: [], updatedAt: null, updatedBy: null });
    expect(await BetaAdminPage()).toBeTruthy();
    expect(mocks.settings).toHaveBeenCalledOnce();
  });
});
