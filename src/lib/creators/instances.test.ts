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

  it("returns the default creator when no database is configured", async () => {
    getDbMock.mockReturnValue(null);

    const instances = await listPlatformCreatorInstances();

    expect(instances).toHaveLength(1);
    expect(instances[0].creator.slug).toBe("ludylops");
    expect(instances[0].moduleSummary.installed).toBeGreaterThan(0);
  });

  it("keeps the default creator available while the creator schema is missing", async () => {
    getDbMock.mockReturnValue({
      select() {
        throw new Error('Failed query: select * from "creators": relation "creators" does not exist');
      },
    });

    const instances = await listPlatformCreatorInstances();

    expect(instances).toHaveLength(1);
    expect(instances[0].creator.id).toBe("creator_ludylops");
  });

  it("validates creator and module statuses", () => {
    expect(isCreatorStatus("active")).toBe(true);
    expect(isCreatorStatus("pending")).toBe(false);
    expect(isCreatorModuleStatus("installed")).toBe(true);
    expect(isCreatorModuleStatus("pending")).toBe(false);
  });
});
