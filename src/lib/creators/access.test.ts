import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/client", () => ({
  getDb: getDbMock,
}));

import {
  canCreateCreatorArea,
  getCreatorAreaAccessSettings,
  parseCreatorAreaAccessText,
  updateCreatorAreaAccessSettings,
} from "@/lib/creators/access";
import type { CreatorAreaAccessSettingsRecord } from "@/lib/types";

function resetDemoSettings() {
  (globalThis as typeof globalThis & {
    __creatorAreaAccessSettings?: CreatorAreaAccessSettingsRecord;
  }).__creatorAreaAccessSettings = undefined;
}

describe("creator area access settings", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    getDbMock.mockReturnValue(null);
    resetDemoSettings();
  });

  it("parses newline, comma and semicolon separated emails", () => {
    expect(parseCreatorAreaAccessText("a@example.com\nb@example.com, c@example.com;d@example.com")).toEqual([
      "a@example.com",
      "b@example.com",
      "c@example.com",
      "d@example.com",
    ]);
  });

  it("stores normalized unique emails in demo mode", async () => {
    const settings = await updateCreatorAreaAccessSettings({
      allowedEmails: ["Beta@Example.com", "beta@example.com", "ana@example.com"],
      updatedBy: "admin@example.com",
    });

    expect(settings.allowedEmails).toEqual(["ana@example.com", "beta@example.com"]);
    await expect(getCreatorAreaAccessSettings()).resolves.toMatchObject({
      allowedEmails: ["ana@example.com", "beta@example.com"],
      updatedBy: "admin@example.com",
    });
  });

  it("allows only emails present in the beta list", async () => {
    await updateCreatorAreaAccessSettings({
      allowedEmails: ["beta@example.com"],
      updatedBy: null,
    });

    await expect(canCreateCreatorArea("beta@example.com")).resolves.toBe(true);
    await expect(canCreateCreatorArea("other@example.com")).resolves.toBe(false);
    await expect(canCreateCreatorArea(null)).resolves.toBe(false);
  });
});
