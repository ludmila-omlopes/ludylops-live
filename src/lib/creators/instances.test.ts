import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/client", () => ({
  getDb: getDbMock,
}));

vi.mock("@/lib/env", () => ({
  isDemoMode: false,
}));

import {
  isCreatorModuleStatus,
  isCreatorStatus,
  listPlatformCreatorInstances,
} from "@/lib/creators/instances";

describe("platform creator instances", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("does not synthesize installed modules when production storage is unavailable", async () => {
    getDbMock.mockReturnValue(null);

    await expect(listPlatformCreatorInstances()).rejects.toThrow("module_policy_unavailable");
  });

  it("reports missing schema instead of presenting a synthetic configuration", async () => {
    getDbMock.mockReturnValue({
      select() {
        throw new Error('Failed query: select * from "creators": relation "creators" does not exist');
      },
    });

    await expect(listPlatformCreatorInstances()).rejects.toThrow("does not exist");
  });

  it("validates creator and module statuses", () => {
    expect(isCreatorStatus("active")).toBe(true);
    expect(isCreatorStatus("pending")).toBe(false);
    expect(isCreatorModuleStatus("installed")).toBe(true);
    expect(isCreatorModuleStatus("pending")).toBe(false);
  });
});
