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
  getCreatorBetaRequest,
  listPendingCreatorBetaRequests,
  reviewCreatorBetaRequest,
  submitCreatorBetaRequest,
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
    globalThis.__creatorBetaRequests = undefined;
    globalThis.__creatorBetaLock = undefined;
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

  it("deduplicates normalized requests and preserves their original date", async () => {
    const [first, duplicate] = await Promise.all([submitCreatorBetaRequest(" Beta@Example.com "), submitCreatorBetaRequest("beta@example.com")]);
    expect(duplicate).toEqual(first);
    expect(first.request).toMatchObject({ email: "beta@example.com", status: "pending", reviewedBy: null });
    expect((await listPendingCreatorBetaRequests()).requests).toHaveLength(1);
    expect(await getCreatorBetaRequest("other@example.com")).toBeNull();
  });

  it("approves concurrent requests without replacing existing emails and rejects stale manual saves", async () => {
    const old = await updateCreatorAreaAccessSettings({ allowedEmails: ["existing@example.com"], updatedBy: null });
    const a = await submitCreatorBetaRequest("a@example.com");
    const b = await submitCreatorBetaRequest("b@example.com");
    await Promise.all([reviewCreatorBetaRequest(a.request!.id, "approved", "admin@example.com"), reviewCreatorBetaRequest(b.request!.id, "approved", "admin@example.com")]);
    expect((await getCreatorAreaAccessSettings()).allowedEmails).toEqual(["a@example.com", "b@example.com", "existing@example.com"]);
    expect((await listPendingCreatorBetaRequests()).requests).toHaveLength(0);
    await expect(updateCreatorAreaAccessSettings({ allowedEmails: old.allowedEmails, updatedBy: null, expectedUpdatedAt: old.updatedAt })).rejects.toThrow("A lista foi alterada");
    expect((await getCreatorBetaRequest("a@example.com"))?.reviewedBy).toBe("admin@example.com");
  });

  it("refuses conflicting decisions, allows retry after rejection, and never grants rejected access", async () => {
    const first = await submitCreatorBetaRequest("beta@example.com");
    await reviewCreatorBetaRequest(first.request!.id, "rejected", "admin@example.com");
    await expect(canCreateCreatorArea("beta@example.com")).resolves.toBe(false);
    await expect(reviewCreatorBetaRequest(first.request!.id, "approved", "admin@example.com")).rejects.toThrow("já foi analisada");
    const retry = await submitCreatorBetaRequest("beta@example.com");
    expect(retry.request).toMatchObject({ id: first.request!.id, status: "pending", reviewedBy: null });
    await expect(reviewCreatorBetaRequest("death_count", "approved", "admin@example.com")).rejects.toThrow("inválida");
  });

  it("does not queue already allowed emails or regrant manually revoked approvals on repeated review", async () => {
    const request = await submitCreatorBetaRequest("beta@example.com");
    await reviewCreatorBetaRequest(request.request!.id, "approved", "admin@example.com");
    expect((await submitCreatorBetaRequest("beta@example.com")).canCreate).toBe(true);
    await updateCreatorAreaAccessSettings({ allowedEmails: [], updatedBy: "admin@example.com" });
    await reviewCreatorBetaRequest(request.request!.id, "approved", "admin@example.com");
    expect(await canCreateCreatorArea("beta@example.com")).toBe(false);
    expect((await submitCreatorBetaRequest("beta@example.com")).request?.status).toBe("pending");
  });

  it("pages the pending queue without dropping requests", async () => {
    await Promise.all(Array.from({ length: 53 }, (_, index) => submitCreatorBetaRequest(`person${index}@example.com`)));
    const first = await listPendingCreatorBetaRequests();
    const second = await listPendingCreatorBetaRequests(first.nextCursor!);
    expect(first.requests).toHaveLength(50);
    expect(second.requests).toHaveLength(3);
    expect(new Set([...first.requests, ...second.requests].map(request => request.id)).size).toBe(53);
    expect(second.nextCursor).toBeNull();
  });
});
