import { describe, expect, it } from "vitest";
import { formatDateTime } from "./utils";
import { streamerbotEventSchema } from "./streamerbot/schemas";

describe("app timestamp presentation", () => {
  it("displays a Streamer.bot UTC event in Brasília without shifting the stored instant", () => {
    const event = streamerbotEventSchema.parse({ eventId: "event-time", eventType: "chat_bonus", occurredAt: "2026-09-24T01:15:00.000Z" });
    const stored = new Date(event.occurredAt);
    expect(formatDateTime(stored)).toBe("23/09/2026, 22:15");
    expect(formatDateTime(event.occurredAt)).toBe("23/09/2026, 22:15");
    expect(stored.toISOString()).toBe(event.occurredAt);
  });

  it("interprets an explicit offset as the same instant, without applying it twice", () => {
    expect(formatDateTime("2026-09-23T22:15:00-03:00")).toBe(formatDateTime("2026-09-24T01:15:00Z"));
  });

  it("uses the IANA historical offset instead of subtracting a fixed three hours", () => {
    expect(formatDateTime("2018-12-10T12:00:00Z")).toBe("10/12/2018, 10:00");
    expect(formatDateTime("2026-12-10T12:00:00Z")).toBe("10/12/2026, 09:00");
  });

  it("preserves the existing absent-date fallback", () => {
    expect(formatDateTime(null)).toBe("agora");
    expect(formatDateTime(undefined)).toBe("agora");
  });
});
