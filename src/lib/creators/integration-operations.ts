import { z } from "zod";
export const BRIDGE_RECENT_MS = 90_000;
export const recoverySchema = z.object({
  redemptionId: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
  outcome: z.enum(["completed", "failed"]),
  note: z.string().trim().min(5).max(255),
  expectedStatus: z.literal("executing"),
  bridgeStopped: z.literal(true),
  resultChecked: z.literal(true),
}).strict();
export type RecoveryInput = z.infer<typeof recoverySchema>;
export type IntegrationOperations = {
  checkedAt: string;
  currencyLabel: string;
  bridges: { bridgeId: string; lastHeartbeatAt: string; recent: boolean }[];
  pending: { id: string; itemName: string; status: "queued" | "executing"; cost: number; queuedAt: string; claimedAt: string | null; bridgeId: string | null }[];
  resolutions: { redemptionId: string; ownerViewerId: string; outcome: string; note: string; createdAt: string }[];
};
