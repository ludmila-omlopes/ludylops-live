import { describe, expect, it } from "vitest";
import { redemptionTimeline } from "./history";
import type { RedemptionRecord } from "@/lib/types";

const base: RedemptionRecord = { id: "r", viewerId: "v", catalogItemId: "i", status: "queued", costAtPurchase: 5,
  requestSource: "web", idempotencyKey: "r", bridgeAttemptCount: 0, claimedByBridgeId: null,
  queuedAt: "2026-09-24T10:00:00Z", executedAt: null, failedAt: null, failureReason: null };

describe("redemption history", () => {
  it("does not invent execution events for queued or directly failed redemptions", () => {
    expect(redemptionTimeline(base)).toHaveLength(1);
    const failed = redemptionTimeline({ ...base, status: "failed", failureReason: "Bridge indisponível", failedAt: "2026-09-24T10:01:00Z" });
    expect(failed).toHaveLength(2); expect(failed[1].detail).toBe("Bridge indisponível");
  });
  it("preserves recorded order and shows the bridge execution note", () => {
    const timeline = redemptionTimeline({ ...base, status: "completed", claimedAt: "2026-09-24T10:00:10Z", claimedByBridgeId: "bridge-a",
      bridgeAttemptCount: 1, executedAt: "2026-09-24T10:00:20Z", executionNote: "Ação recebida" });
    expect(timeline.map((event) => event.label)).toEqual(["Entrou na fila", "Assumido pela bridge", "Conclusão registrada"]);
    expect(timeline[1].detail).toContain("bridge-a"); expect(timeline[2].detail).toBe("Ação recebida");
  });
  it("keeps unknown legacy timestamps unknown instead of borrowing queue time", () => {
    const timeline = redemptionTimeline({ ...base, status: "completed", claimedByBridgeId: "old-bridge", bridgeAttemptCount: 1 });
    expect(timeline[1].at).toBeNull(); expect(timeline[2].at).toBeNull();
    expect(redemptionTimeline({ ...base, status: "cancelled" })[1].at).toBeNull();
  });
});
