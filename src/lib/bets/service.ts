import type { BetEntryRecord, BetOptionRecord, BetStatus, BetWithOptionsRecord } from "@/lib/types";

type PlacementInput = {
  bet: BetWithOptionsRecord;
  amount: number;
  optionId: string;
  balance: number;
  existingEntry: BetEntryRecord | null;
  now?: Date;
};

type PlacementResult =
  | { canPlace: true }
  | {
      canPlace: false;
      reason:
        | "bet_not_open"
        | "bet_closed"
        | "invalid_option"
        | "invalid_amount"
        | "saldo_insuficiente"
        | "aposta_ja_registrada";
    };

type BetLifecycleAction = "lock" | "resolve" | "cancel";

type BetLifecycleResult =
  | { canTransition: true }
  | {
      canTransition: false;
      reason:
        | "bet_not_open"
        | "bet_not_locked"
        | "bet_already_locked"
        | "bet_already_resolved"
        | "bet_already_cancelled";
    };

export function evaluateBetPlacement(input: PlacementInput): PlacementResult {
  const now = input.now ?? new Date();

  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    return { canPlace: false, reason: "invalid_amount" };
  }

  if (input.bet.status !== "open") {
    return { canPlace: false, reason: "bet_not_open" };
  }

  if (new Date(input.bet.closesAt).getTime() <= now.getTime()) {
    return { canPlace: false, reason: "bet_closed" };
  }

  if (!input.bet.options.some((option) => option.id === input.optionId)) {
    return { canPlace: false, reason: "invalid_option" };
  }

  if (input.existingEntry && input.existingEntry.optionId !== input.optionId) {
    return { canPlace: false, reason: "aposta_ja_registrada" };
  }

  if (input.balance < input.amount) {
    return { canPlace: false, reason: "saldo_insuficiente" };
  }

  return { canPlace: true };
}

export function evaluateBetLifecycleAction(input: {
  action: BetLifecycleAction;
  status: BetStatus;
}): BetLifecycleResult {
  if (input.action === "lock") {
    switch (input.status) {
      case "open":
        return { canTransition: true };
      case "locked":
        return { canTransition: false, reason: "bet_already_locked" };
      case "resolved":
        return { canTransition: false, reason: "bet_already_resolved" };
      case "cancelled":
        return { canTransition: false, reason: "bet_already_cancelled" };
      default:
        return { canTransition: false, reason: "bet_not_open" };
    }
  }

  if (input.action === "resolve") {
    switch (input.status) {
      case "locked":
        return { canTransition: true };
      case "resolved":
        return { canTransition: false, reason: "bet_already_resolved" };
      case "cancelled":
        return { canTransition: false, reason: "bet_already_cancelled" };
      default:
        return { canTransition: false, reason: "bet_not_locked" };
    }
  }

  switch (input.status) {
    case "draft":
    case "open":
    case "locked":
      return { canTransition: true };
    case "resolved":
      return { canTransition: false, reason: "bet_already_resolved" };
    case "cancelled":
      return { canTransition: false, reason: "bet_already_cancelled" };
  }

  return { canTransition: false, reason: "bet_already_cancelled" };
}

export function calculateBetPayouts(input: {
  entries: BetEntryRecord[];
  options: BetOptionRecord[];
  winningOptionId: string;
}) {
  const totalPool = input.options.reduce((sum, option) => sum + option.poolAmount, 0);
  const winningEntries = input.entries.filter((entry) => entry.optionId === input.winningOptionId);
  const rankedEntries = [...winningEntries]
    .sort((a, b) => {
      if (b.amount !== a.amount) {
        return b.amount - a.amount;
      }

      return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    });

  const winningPool = winningEntries.reduce((sum, entry) => sum + entry.amount, 0);
  if (winningPool <= 0 || totalPool <= 0) {
    return winningEntries.map((entry) => ({ entryId: entry.id, viewerId: entry.viewerId, payoutAmount: 0 }));
  }

  const base = winningEntries.map((entry) => ({
    entryId: entry.id,
    viewerId: entry.viewerId,
    payoutAmount: Math.floor((totalPool * entry.amount) / winningPool),
    remainder: (totalPool * entry.amount) % winningPool,
  }));

  let distributed = base.reduce((sum, entry) => sum + entry.payoutAmount, 0);
  let leftovers = totalPool - distributed;

  const byRemainder = [...base].sort((a, b) => {
    if (b.remainder !== a.remainder) {
      return b.remainder - a.remainder;
    }

    const entryA = rankedEntries.find((entry) => entry.id === a.entryId)!;
    const entryB = rankedEntries.find((entry) => entry.id === b.entryId)!;
    if (entryA.createdAt !== entryB.createdAt) {
      return entryA.createdAt.localeCompare(entryB.createdAt);
    }

    return entryA.id.localeCompare(entryB.id);
  });

  let index = 0;
  while (leftovers > 0 && byRemainder.length > 0) {
    byRemainder[index % byRemainder.length].payoutAmount += 1;
    distributed += 1;
    leftovers -= 1;
    index += 1;
  }

  return base.map(({ entryId, viewerId }) => {
    const settled = byRemainder.find((entry) => entry.entryId === entryId)!;
    return { entryId, viewerId, payoutAmount: settled.payoutAmount };
  });
}

export function shouldRefundBetOnResolve(input: {
  entries: BetEntryRecord[];
  winningOptionId: string;
}) {
  return !input.entries.some((entry) => entry.optionId === input.winningOptionId && !entry.isHouseEntry);
}

export function calculateHouseBetEntries(input: {
  options: BetOptionRecord[];
  existingEntries: BetEntryRecord[];
}) {
  return input.options
    .filter((option) => option.poolAmount === 0)
    .filter(
      (option) =>
        !input.existingEntries.some(
          (entry) => entry.optionId === option.id && entry.isHouseEntry,
        ),
    )
    .map((option) => ({
      optionId: option.id,
      amount: input.options
        .filter((candidate) => candidate.id !== option.id)
        .reduce((sum, candidate) => sum + candidate.poolAmount, 0),
    }))
    .filter((entry) => entry.amount > 0);
}
