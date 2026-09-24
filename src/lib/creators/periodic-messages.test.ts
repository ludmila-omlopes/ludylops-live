import { describe, expect, it } from "vitest";
import { dispatchPeriodicState, editPeriodicState, readPeriodicState, periodicView, periodicEditSchema, periodicDispatchSchema } from "./periodic-messages";
const id = "11111111-1111-4111-8111-111111111111", token = "22222222-2222-4222-8222-222222222222";
const start = Date.parse("2026-09-24T10:00:00Z");
const message = { text: "Lembre de se hidratar!", intervalSeconds: 60, enabled: true };
function setup() { const state = readPeriodicState({}); editPeriodicState(state, { action: "create", expectedRevision: 0, message }, id, start); return state; }
const claim = { action: "claim" as const, broadcastId: "broadcast-a", isLive: true };
describe("periodic messages", () => {
  it("waits for the interval and live state, then consumes the slot before IO", () => {
    const state = setup();
    expect(dispatchPeriodicState(state, claim, token, start + 59999)).toBeNull();
    expect(dispatchPeriodicState(state, { ...claim, isLive: false }, token, start + 60000)).toBeNull();
    expect(dispatchPeriodicState(state, claim, token, start + 60000)).toEqual({ id, token, text: message.text, broadcastId: claim.broadcastId });
    expect(dispatchPeriodicState(state, claim, token, start + 60001)).toBeNull();
    expect(dispatchPeriodicState(state, claim, token, start + 119999)).toBeNull();
    expect(dispatchPeriodicState(state, claim, token, start + 120000)).not.toBeNull();
  });
  it("checks recipient and expiry before sending and preserves the first acknowledgement", () => {
    const state = setup(); dispatchPeriodicState(state, claim, token, start + 60000);
    const confirmation = { action: "confirm" as const, id, token, broadcastId: claim.broadcastId };
    expect(dispatchPeriodicState(state, confirmation, token, start + 60001)).toEqual({ allowed: true });
    expect(dispatchPeriodicState(state, { ...confirmation, broadcastId: "other" }, token, start + 60001)).toEqual({ allowed: false });
    expect(dispatchPeriodicState(state, confirmation, token, start + 90001)).toEqual({ allowed: false });
    dispatchPeriodicState(state, { action: "ack", id, token, outcome: "sent" }, token, start + 60002);
    dispatchPeriodicState(state, { action: "ack", id, token, outcome: "failed", error: "retry" }, token, start + 60003);
    expect(state.runtime[id].lastError).toBeNull(); expect(state.runtime[id].lastSentAt).toBe(new Date(start + 60002).toISOString());
    expect(dispatchPeriodicState(state, confirmation, token, start + 60003)).toEqual({ allowed: false });
    expect(JSON.stringify(periodicView(state))).not.toContain(token);
  });
  it("invalidates a reserved send on edits, pause or delete, and rejects stale edits", () => {
    const state = setup(); dispatchPeriodicState(state, claim, token, start + 60000);
    expect(() => editPeriodicState(state, { action: "delete", expectedRevision: 0, id }, id, start)).toThrow("Atualize");
    editPeriodicState(state, { action: "update", expectedRevision: 1, id, message: { ...message, enabled: false } }, id, start + 60000);
    expect(() => dispatchPeriodicState(state, { action: "confirm", id, token, broadcastId: "broadcast-a" }, token, start + 60001)).toThrow();
    expect(dispatchPeriodicState(state, claim, token, start + 200000)).toBeNull();
    editPeriodicState(state, { action: "delete", expectedRevision: 2, id }, id, start); expect(state.items).toEqual([]); expect(state.runtime).toEqual({});
  });
  it("records failures and spaces different messages by at least 15 seconds", () => {
    const state = setup(); editPeriodicState(state, { action: "create", expectedRevision: 1, message }, token, start);
    dispatchPeriodicState(state, claim, token, start + 60000);
    dispatchPeriodicState(state, { action: "ack", id, token, outcome: "failed", error: "Chat indisponível" }, token, start + 60001);
    expect(state.runtime[id].lastError).toBe("Chat indisponível"); expect(state.runtime[id].lastSentAt).toBeNull();
    expect(dispatchPeriodicState(state, claim, token, start + 74999)).toBeNull();
    expect(dispatchPeriodicState(state, claim, token, start + 75000)).toMatchObject({ id: token });
  });
  it("validates copy/interval and rejects creator injection and corrupt stored settings", () => {
    for (const input of [{ ...message, text: " " }, { ...message, text: "a\nb" }, { ...message, text: "a".repeat(201) }, { ...message, intervalSeconds: 59 }, { ...message, intervalSeconds: 86401 }]) {
      expect(periodicEditSchema.safeParse({ action: "create", expectedRevision: 0, message: input }).success).toBe(false);
    }
    expect(periodicDispatchSchema.safeParse({ ...claim, creatorId: "other" }).success).toBe(false);
    expect(() => readPeriodicState({ periodicMessages: { items: "corrupt" } })).toThrow();
  });
});
