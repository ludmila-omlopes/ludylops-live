import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ demo: false, cache: vi.fn() }));
vi.mock("@/lib/env", () => ({ get isDemoMode() { return state.demo; } }));
vi.mock("next/cache", () => ({ unstable_cache: state.cache }));
import { cachePublicCreatorRead } from "./cache";
import type { CreatorContext } from "./creators/context";
beforeEach(() => {
  state.demo = false;
  const values = new Map<string, unknown>();
  state.cache.mockReset().mockImplementation((fn, keys) => async (...args: unknown[]) => {
    const key = JSON.stringify([keys, args]);
    if (!values.has(key)) values.set(key, await fn(...args));
    return values.get(key);
  });
});
describe("creator public cache contract", () => {
  it("keys by creator, resource and query dimensions and passes scope into the loader", async () => {
    const loader = vi.fn(async (context: CreatorContext, limit: number) => ({ creator: context.creatorId, limit }));
    const read = cachePublicCreatorRead("ranking", 15, loader);
    expect(await read({ creatorId: "a" }, 10)).toEqual({ creator: "a", limit: 10 });
    expect(await read({ creatorId: "a" }, 10)).toEqual({ creator: "a", limit: 10 });
    expect(await read({ creatorId: "b" }, 10)).toEqual({ creator: "b", limit: 10 });
    expect(await read({ creatorId: "a" }, 20)).toEqual({ creator: "a", limit: 20 });
    await cachePublicCreatorRead("other-resource", 15, loader)({ creatorId: "a" }, 10);
    expect(loader).toHaveBeenCalledTimes(4);
    expect(loader).toHaveBeenCalledWith({ creatorId: "b" }, 10);
    expect(state.cache).toHaveBeenCalledWith(expect.any(Function), ["creator-public-v1", "ranking", "a", "15"], {
      revalidate: 15, tags: ["creator:a", "creator:a:ranking"],
    });
    expect(state.cache).toHaveBeenCalledWith(expect.any(Function), ["creator-public-v1", "ranking", "b", "15"], {
      revalidate: 15, tags: ["creator:b", "creator:b:ranking"],
    });
  });
  it("rejects missing scope and invalid policies or query dimensions before invoking storage", async () => {
    const loader = vi.fn(async () => []);
    for (const resource of ["", "private result", "a".repeat(65)]) expect(() => cachePublicCreatorRead(resource, 15, loader)).toThrow("invalid_public_cache_policy");
    for (const ttl of [0, -1, 1.5, 61, Infinity]) expect(() => cachePublicCreatorRead("ranking", ttl, loader)).toThrow("invalid_public_cache_policy");
    const read = cachePublicCreatorRead("ranking", 15, loader);
    for (const creatorId of ["", " "]) await expect(read({ creatorId })).rejects.toThrow("creator_context_required");
    await expect(read(undefined as unknown as CreatorContext)).rejects.toThrow("creator_context_required");
    const query = cachePublicCreatorRead("ranking", 15, async (_context: CreatorContext, limit: number) => limit);
    await expect(query({ creatorId: "a" }, NaN)).rejects.toThrow("invalid_public_cache_key");
    expect(loader).not.toHaveBeenCalled(); expect(state.cache).not.toHaveBeenCalled();
  });
  it("bypasses the framework cache entirely in demo mode", async () => {
    state.demo = true;
    let balance = 10;
    const read = cachePublicCreatorRead("ranking", 15, async () => balance);
    expect(await read({ creatorId: "a" })).toBe(10); balance = 20;
    expect(await read({ creatorId: "a" })).toBe(20); expect(state.cache).not.toHaveBeenCalled();
  });
  it("propagates failures instead of substituting another creator or demo result", async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error("database unavailable")).mockResolvedValueOnce([]);
    const read = cachePublicCreatorRead("ranking", 15, loader);
    await expect(read({ creatorId: "a" })).rejects.toThrow("database unavailable");
    expect(await read({ creatorId: "a" })).toEqual([]); expect(loader).toHaveBeenCalledTimes(2);
  });
});
