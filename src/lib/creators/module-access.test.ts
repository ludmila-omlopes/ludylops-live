import { beforeEach, describe, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({ resolve: vi.fn(), db: vi.fn() }));
vi.mock("./tenant", () => ({
  resolvePublicCreatorFromRequest: storage.resolve,
}));
vi.mock("@/lib/db/client", () => ({ getDb: storage.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: false }));
import {
  canUseModules,
  guardModuleRequest,
  guardVerifiedModules,
} from "./module-access";
import { DEFAULT_CREATOR_ID, DEFAULT_CREATOR_MODULES } from "./defaults";
import { creatorModuleCatalog } from "./modules";

const tenant = (id = DEFAULT_CREATOR_ID) => ({
  creator: { id, status: "active" },
  modules: structuredClone(DEFAULT_CREATOR_MODULES),
});
describe("server module authorization", () => {
  it("allows only the isolated Streamer.bot operation for periodic messages", () => {
    const other = tenant("another");
    expect(canUseModules(other, ["streamerbot"], "periodic-messages")).toBe(true);
    expect(canUseModules(other, ["points"], "periodic-messages")).toBe(false);
    expect(canUseModules(other, ["streamerbot", "redemptions"], "periodic-messages")).toBe(false);
    other.modules.find((entry) => entry.moduleKey === "streamerbot")!.status = "disabled";
    expect(canUseModules(other, ["streamerbot"], "periodic-messages")).toBe(false);
  });
  beforeEach(() => {
    storage.resolve.mockReset().mockResolvedValue(tenant());
    storage.db.mockReset().mockReturnValue(null);
  });
  it.each(["disabled", "archived", "unknown"])(
    "denies every operation for %s creators",
    (status) => {
      const other = tenant();
      other.creator.status = status;
      for (const manifest of creatorModuleCatalog)
        expect(canUseModules(other, [manifest.key])).toBe(false);
    },
  );
  it("denies missing tenants and empty requirements", () => {
    expect(canUseModules(null, ["points"])).toBe(false);
    expect(canUseModules(tenant(), [])).toBe(false);
  });
  it("keeps row isolation separate from installed modules", () => {
    const other = tenant("another");
    for (const manifest of creatorModuleCatalog)
      expect(canUseModules(other, [manifest.key])).toBe(false);
    expect(canUseModules(other, ["quotes"], "quotes.read")).toBe(true);
    expect(canUseModules(other, ["quotes"], "quotes.create")).toBe(true);
    expect(canUseModules(other, ["points"], "quotes.read")).toBe(false);
    other.modules = other.modules.filter((row) => row.moduleKey !== "points");
    expect(canUseModules(other, ["quotes"], "quotes.read")).toBe(false);
  });
  it("rejects repeated selectors before resolution and does not retry unknown creators", async () => {
    expect(
      (
        await guardModuleRequest(
          new Request("https://example.test/api/bets?creator=a&creator=b"),
          ["bets"],
        )
      )?.status,
    ).toBe(403);
    expect(storage.resolve).not.toHaveBeenCalled();
    storage.resolve.mockResolvedValue(null);
    expect(
      (
        await guardModuleRequest(
          new Request("https://example.test/api/bets?creator=missing"),
          ["bets"],
        )
      )?.status,
    ).toBe(403);
    expect(storage.resolve).toHaveBeenCalledOnce();
    expect(storage.resolve).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "missing" }),
    );
  });
  it("allows only the isolated ranking reader without unlocking other modules or legacy queries", () => {
    const other = tenant("another");
    expect(canUseModules(other, ["ranking"], "ranking.read")).toBe(true);
    expect(canUseModules(other, ["ranking"])).toBe(false);
    expect(canUseModules(other, ["points"], "ranking.read")).toBe(false);
    expect(canUseModules(other, ["ranking", "bets"], "ranking.read")).toBe(false);
    expect(canUseModules(tenant(), ["ranking"], "ranking.read")).toBe(false);
    other.modules.find((m) => m.moduleKey === "streamerbot")!.status = "disabled";
    expect(canUseModules(other, ["ranking"], "ranking.read")).toBe(true);
    other.modules.find((m) => m.moduleKey === "points")!.status = "disabled";
    expect(canUseModules(other, ["ranking"], "ranking.read")).toBe(false);
  });
  it("fails closed on lookup errors and absent production storage", async () => {
    storage.resolve.mockRejectedValue(
      new Error("sensitive connection failure"),
    );
    const result = await guardModuleRequest(
      new Request("https://example.test/api/bets"),
      ["bets"],
    );
    expect(result?.status).toBe(503);
    expect(result?.headers.get("cache-control")).toBe("no-store");
    expect(await result?.text()).not.toContain("sensitive");
    expect(
      (
        await guardVerifiedModules({ creatorId: DEFAULT_CREATOR_ID }, [
          "points",
        ])
      )?.status,
    ).toBe(503);
  });
  it("loads verified creator identity and all dependencies from storage", async () => {
    const other = tenant("verified");
    const where = vi
      .fn()
      .mockResolvedValueOnce([other.creator])
      .mockResolvedValueOnce(other.modules);
    storage.db.mockReturnValue({ select: () => ({ from: () => ({ where }) }) });
    expect(
      await guardVerifiedModules(
        { creatorId: "verified" },
        ["quotes"],
        "quotes.read",
      ),
    ).toBeNull();
    expect(where).toHaveBeenCalledTimes(2);
  });
});
