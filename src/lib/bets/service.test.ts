import { describe, expect, it } from "vitest";

import {
  calculateHouseBetEntries,
  calculateBetPayouts,
  evaluateBetLifecycleAction,
  evaluateBetPlacement,
  shouldRefundBetOnResolve,
} from "@/lib/bets/service";
import type { BetEntryRecord, BetWithOptionsRecord } from "@/lib/types";

const baseBet: BetWithOptionsRecord = {
  id: "bet-1",
  question: "Boss no-hit?",
  optionMode: "preset",
  status: "open",
  openedAt: new Date("2026-03-31T10:00:00.000Z").toISOString(),
  closesAt: new Date("2026-03-31T12:00:00.000Z").toISOString(),
  lockedAt: null,
  resolvedAt: null,
  cancelledAt: null,
  winningOptionId: null,
  createdAt: new Date("2026-03-31T09:55:00.000Z").toISOString(),
  totalPool: 300,
  options: [
    { id: "yes", betId: "bet-1", label: "Yes", sortOrder: 0, poolAmount: 100 },
    { id: "no", betId: "bet-1", label: "No", sortOrder: 1, poolAmount: 200 },
  ],
  viewerPosition: null,
};

describe("evaluateBetPlacement", () => {
  it("blocks insufficient balance", () => {
    expect(
      evaluateBetPlacement({
        bet: baseBet,
        amount: 500,
        optionId: "yes",
        balance: 100,
        existingEntry: null,
        now: new Date("2026-03-31T11:00:00.000Z"),
      }),
    ).toEqual({ canPlace: false, reason: "saldo_insuficiente" });
  });

  it("blocks switching sides after an existing bet", () => {
    const entry: BetEntryRecord = {
      id: "entry-1",
      betId: "bet-1",
      optionId: "yes",
      viewerId: "viewer-1",
      amount: 50,
      payoutAmount: null,
      settledAt: null,
      refundedAt: null,
      createdAt: new Date("2026-03-31T10:30:00.000Z").toISOString(),
    };

    expect(
      evaluateBetPlacement({
        bet: baseBet,
        amount: 20,
        optionId: "no",
        balance: 100,
        existingEntry: entry,
        now: new Date("2026-03-31T11:00:00.000Z"),
      }),
    ).toEqual({ canPlace: false, reason: "aposta_ja_registrada" });
  });

  it("allows adding more to the same option", () => {
    const entry: BetEntryRecord = {
      id: "entry-1",
      betId: "bet-1",
      optionId: "yes",
      viewerId: "viewer-1",
      amount: 50,
      payoutAmount: null,
      settledAt: null,
      refundedAt: null,
      createdAt: new Date("2026-03-31T10:30:00.000Z").toISOString(),
    };

    expect(
      evaluateBetPlacement({
        bet: baseBet,
        amount: 20,
        optionId: "yes",
        balance: 100,
        existingEntry: entry,
        now: new Date("2026-03-31T11:00:00.000Z"),
      }),
    ).toEqual({ canPlace: true });
  });

  it("allows a valid bet", () => {
    expect(
      evaluateBetPlacement({
        bet: baseBet,
        amount: 20,
        optionId: "yes",
        balance: 100,
        existingEntry: null,
        now: new Date("2026-03-31T11:00:00.000Z"),
      }),
    ).toEqual({ canPlace: true });
  });
});

describe("calculateBetPayouts", () => {
  it("distributes the whole pool proportionally", () => {
    const entries: BetEntryRecord[] = [
      {
        id: "entry-a",
        betId: "bet-1",
        optionId: "yes",
        viewerId: "viewer-a",
        amount: 25,
        payoutAmount: null,
        settledAt: null,
        refundedAt: null,
        createdAt: new Date("2026-03-31T10:00:00.000Z").toISOString(),
      },
      {
        id: "entry-b",
        betId: "bet-1",
        optionId: "yes",
        viewerId: "viewer-b",
        amount: 75,
        payoutAmount: null,
        settledAt: null,
        refundedAt: null,
        createdAt: new Date("2026-03-31T10:01:00.000Z").toISOString(),
      },
      {
        id: "entry-c",
        betId: "bet-1",
        optionId: "no",
        viewerId: "viewer-c",
        amount: 200,
        payoutAmount: null,
        settledAt: null,
        refundedAt: null,
        createdAt: new Date("2026-03-31T10:02:00.000Z").toISOString(),
      },
    ];

    const payouts = calculateBetPayouts({
      entries,
      options: baseBet.options,
      winningOptionId: "yes",
    });

    expect(payouts).toEqual([
      { entryId: "entry-a", viewerId: "viewer-a", payoutAmount: 75 },
      { entryId: "entry-b", viewerId: "viewer-b", payoutAmount: 225 },
    ]);
  });
});

describe("calculateHouseBetEntries", () => {
  it("creates a house entry for each empty option using the sum of the other pools", () => {
    expect(
      calculateHouseBetEntries({
        options: [
          { id: "a", betId: "bet-1", label: "A", sortOrder: 0, poolAmount: 100 },
          { id: "b", betId: "bet-1", label: "B", sortOrder: 1, poolAmount: 0 },
          { id: "c", betId: "bet-1", label: "C", sortOrder: 2, poolAmount: 50 },
        ],
        existingEntries: [],
      }),
    ).toEqual([{ optionId: "b", amount: 150 }]);
  });

  it("does not duplicate an existing house entry", () => {
    expect(
      calculateHouseBetEntries({
        options: [
          { id: "a", betId: "bet-1", label: "A", sortOrder: 0, poolAmount: 100 },
          { id: "b", betId: "bet-1", label: "B", sortOrder: 1, poolAmount: 0 },
        ],
        existingEntries: [
          {
            id: "house-entry",
            betId: "bet-1",
            optionId: "b",
            viewerId: "house_b",
            amount: 100,
            isHouseEntry: true,
            payoutAmount: null,
            settledAt: null,
            refundedAt: null,
            createdAt: new Date("2026-03-31T10:00:00.000Z").toISOString(),
          },
        ],
      }),
    ).toEqual([]);
  });

  it("does not create house entries for freeform bets", () => {
    expect(
      calculateHouseBetEntries({
        optionMode: "freeform",
        options: [
          { id: "a", betId: "bet-1", label: "A", sortOrder: 0, poolAmount: 100 },
          { id: "b", betId: "bet-1", label: "B", sortOrder: 1, poolAmount: 0 },
        ],
        existingEntries: [],
      }),
    ).toEqual([]);
  });
});

describe("shouldRefundBetOnResolve", () => {
  it("refunds everyone when nobody picked the winning option", () => {
    const entries: BetEntryRecord[] = [
      {
        id: "entry-a",
        betId: "bet-1",
        optionId: "yes",
        viewerId: "viewer-a",
        amount: 25,
        payoutAmount: null,
        settledAt: null,
        refundedAt: null,
        createdAt: new Date("2026-03-31T10:00:00.000Z").toISOString(),
      },
      {
        id: "entry-b",
        betId: "bet-1",
        optionId: "yes",
        viewerId: "viewer-b",
        amount: 75,
        payoutAmount: null,
        settledAt: null,
        refundedAt: null,
        createdAt: new Date("2026-03-31T10:01:00.000Z").toISOString(),
      },
    ];

    expect(
      shouldRefundBetOnResolve({
        entries,
        winningOptionId: "no",
      }),
    ).toBe(true);
  });
});

describe("evaluateBetLifecycleAction", () => {
  it("only allows locking open bets", () => {
    expect(evaluateBetLifecycleAction({ action: "lock", status: "open" })).toEqual({
      canTransition: true,
    });
    expect(evaluateBetLifecycleAction({ action: "lock", status: "locked" })).toEqual({
      canTransition: false,
      reason: "bet_already_locked",
    });
    expect(evaluateBetLifecycleAction({ action: "lock", status: "resolved" })).toEqual({
      canTransition: false,
      reason: "bet_already_resolved",
    });
  });

  it("only allows resolving locked bets", () => {
    expect(evaluateBetLifecycleAction({ action: "resolve", status: "locked" })).toEqual({
      canTransition: true,
    });
    expect(evaluateBetLifecycleAction({ action: "resolve", status: "open" })).toEqual({
      canTransition: false,
      reason: "bet_not_locked",
    });
    expect(evaluateBetLifecycleAction({ action: "resolve", status: "cancelled" })).toEqual({
      canTransition: false,
      reason: "bet_already_cancelled",
    });
  });

  it("allows cancelling non-terminal bets only", () => {
    expect(evaluateBetLifecycleAction({ action: "cancel", status: "draft" })).toEqual({
      canTransition: true,
    });
    expect(evaluateBetLifecycleAction({ action: "cancel", status: "open" })).toEqual({
      canTransition: true,
    });
    expect(evaluateBetLifecycleAction({ action: "cancel", status: "locked" })).toEqual({
      canTransition: true,
    });
    expect(evaluateBetLifecycleAction({ action: "cancel", status: "resolved" })).toEqual({
      canTransition: false,
      reason: "bet_already_resolved",
    });
  });
});
