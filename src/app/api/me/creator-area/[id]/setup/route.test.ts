import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), setup: vi.fn() }));
vi.mock("@/lib/api", () => ({ requireApiSession: mocks.auth }));
vi.mock("@/lib/creators/setup.server", async original => ({ ...await original<typeof import("@/lib/creators/setup.server")>(), getOwnedCreatorSetup: mocks.setup }));
import { GET } from "./route";
import { SetupAccessError } from "@/lib/creators/setup.server";
const context = { params: Promise.resolve({ id: "creator-a" }) }, request = new Request("https://example.com/api/me/creator-area/creator-a/setup?viewerId=other");
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { activeViewerId: "owner-a" } }); mocks.setup.mockResolvedValue({ steps: [] }); });
it("requires a session and derives ownership only from its active viewer", async () => {
  const response = await GET(request, context); expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.setup).toHaveBeenCalledWith("owner-a", "creator-a");
  mocks.auth.mockResolvedValue(null); expect((await GET(request, context)).status).toBe(401);
});
it("does not leak another owner's state or storage failures", async () => {
  mocks.setup.mockRejectedValue(new SetupAccessError()); expect((await GET(request, context)).status).toBe(404);
  mocks.setup.mockRejectedValue(Error("secret database failure")); const response = await GET(request, context);
  expect(response.status).toBe(503); expect(await response.text()).not.toContain("secret database");
});
