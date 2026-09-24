import { z } from "zod";

export const periodicMessageSchema = z.object({
  text: z.string().trim().min(1).max(200).regex(/^[^\r\n\u0000-\u001f]+$/),
  intervalSeconds: z.number().int().min(60).max(86_400), enabled: z.boolean(),
}).strict();
export type PeriodicMessage = z.infer<typeof periodicMessageSchema> & { id: string };
const id = z.string().uuid();
export const periodicEditSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), expectedRevision: z.number().int().nonnegative(), message: periodicMessageSchema }).strict(),
  z.object({ action: z.literal("update"), expectedRevision: z.number().int().nonnegative(), id, message: periodicMessageSchema }).strict(),
  z.object({ action: z.literal("delete"), expectedRevision: z.number().int().nonnegative(), id }).strict(),
]);
const broadcast = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const periodicDispatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("claim"), broadcastId: broadcast, isLive: z.boolean() }).strict(),
  z.object({ action: z.literal("confirm"), id, token: id, broadcastId: broadcast }).strict(),
  z.object({ action: z.literal("ack"), id, token: id, outcome: z.enum(["sent", "failed"]), error: z.string().trim().max(200).optional() }).strict(),
]);
const runtimeSchema = z.object({
  nextDueAt: z.number(), lastAttemptAt: z.string().nullable(), lastSentAt: z.string().nullable(), lastError: z.string().nullable(),
  lease: z.object({ token: id, expiresAt: z.number(), broadcastId: broadcast, acknowledged: z.boolean() }).nullable(),
});
export const periodicStateSchema = z.object({
  revision: z.number().int().nonnegative(),
  items: z.array(periodicMessageSchema.extend({ id })).max(20),
  runtime: z.record(z.string(), runtimeSchema),
  lastContactAt: z.string().nullable(), lastAttemptAt: z.number(),
});
export type PeriodicState = z.infer<typeof periodicStateSchema>;
export type PeriodicSettingsView = {
  revision: number; lastContactAt: string | null;
  items: Array<PeriodicMessage & { lastAttemptAt: string | null; lastSentAt: string | null; lastError: string | null }>;
};
export class PeriodicAccessError extends Error {}
export class PeriodicConflictError extends Error {}
export function readPeriodicState(config: Record<string, unknown>): PeriodicState {
  if (config.periodicMessages === undefined) return { revision: 0, items: [], runtime: {}, lastContactAt: null, lastAttemptAt: 0 };
  return periodicStateSchema.parse(config.periodicMessages);
}
export function periodicView(state: PeriodicState): PeriodicSettingsView {
  return { revision: state.revision, lastContactAt: state.lastContactAt, items: state.items.map((item) => {
    const runtime = state.runtime[item.id];
    return { ...item, lastAttemptAt: runtime?.lastAttemptAt ?? null, lastSentAt: runtime?.lastSentAt ?? null, lastError: runtime?.lastError ?? null };
  }) };
}
export function editPeriodicState(state: PeriodicState, input: z.infer<typeof periodicEditSchema>, newId: string, now: number) {
  if (input.expectedRevision !== state.revision) throw new PeriodicConflictError("As mensagens mudaram. Atualize antes de salvar.");
  if (input.action === "create") {
    if (state.items.length >= 20) throw new PeriodicConflictError("Use até 20 mensagens por comunidade.");
    state.items.push({ ...input.message, id: newId });
    state.runtime[newId] = { nextDueAt: now + input.message.intervalSeconds * 1000, lastAttemptAt: null, lastSentAt: null, lastError: null, lease: null };
  } else {
    const index = state.items.findIndex((item) => item.id === input.id);
    if (index < 0) throw new PeriodicAccessError();
    if (input.action === "delete") { state.items.splice(index, 1); delete state.runtime[input.id]; }
    else {
      state.items[index] = { ...input.message, id: input.id };
      state.runtime[input.id] = { ...state.runtime[input.id], nextDueAt: now + input.message.intervalSeconds * 1000, lease: null };
    }
  }
  state.revision++;
  return periodicView(state);
}
export function dispatchPeriodicState(state: PeriodicState, input: z.infer<typeof periodicDispatchSchema>, token: string, now: number) {
  const at = new Date(now).toISOString();
  state.lastContactAt = at;
  if (input.action === "claim") {
    // The interval is consumed before external IO. An uncertain delivery is never retried within the same slot.
    if (!input.isLive || now - state.lastAttemptAt < 15_000) return null;
    const item = [...state.items].filter((entry) => entry.enabled && state.runtime[entry.id]?.nextDueAt <= now)
      .sort((a, b) => state.runtime[a.id].nextDueAt - state.runtime[b.id].nextDueAt)[0];
    if (!item) return null;
    const runtime = state.runtime[item.id];
    runtime.nextDueAt = now + item.intervalSeconds * 1000; runtime.lastAttemptAt = at;
    runtime.lastError = "Envio reservado; confirmação pendente.";
    runtime.lease = { token, expiresAt: now + 30_000, broadcastId: input.broadcastId, acknowledged: false };
    state.lastAttemptAt = now;
    return { id: item.id, token, text: item.text, broadcastId: input.broadcastId };
  }
  const item = state.items.find((entry) => entry.id === input.id);
  const runtime = state.runtime[input.id];
  if (!item || !runtime?.lease || runtime.lease.token !== input.token) throw new PeriodicConflictError("Envio não está mais disponível.");
  if (input.action === "confirm") return { allowed: item.enabled && !runtime.lease.acknowledged && runtime.lease.expiresAt >= now && runtime.lease.broadcastId === input.broadcastId };
  if (runtime.lease.acknowledged) return { acknowledged: true };
  if (runtime.lease.expiresAt < now) throw new PeriodicConflictError("A confirmação de envio expirou.");
  runtime.lease.acknowledged = true;
  if (input.outcome === "sent") { runtime.lastSentAt = at; runtime.lastError = null; }
  else runtime.lastError = input.error || "O Streamer.bot não conseguiu chamar o envio.";
  return { acknowledged: true };
}
