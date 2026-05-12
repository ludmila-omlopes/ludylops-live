import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());
const isStreamerbotLivestreamActiveMock = vi.hoisted(() => vi.fn());
const getActiveDeathCounterGameMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/client", () => ({
  getDb: getDbMock,
}));

vi.mock("@/lib/env", () => ({
  isDemoMode: false,
  adminEmails: new Set(["admin@example.com"]),
}));

vi.mock("@/lib/streamerbot/live-status", () => ({
  eventRequiresActiveLivestream: (eventType: string) =>
    eventType === "presence_tick" || eventType === "chat_bonus",
  isStreamerbotLivestreamActive: isStreamerbotLivestreamActiveMock,
  resolveRequiredLivestreamState: async ({ explicitState }: { explicitState?: boolean | null } = {}) =>
    typeof explicitState === "boolean"
      ? explicitState
      : Boolean(await isStreamerbotLivestreamActiveMock()),
  requireActiveLivestream: async ({
    explicitState,
    failureError,
  }: {
    explicitState?: boolean | null;
    failureError?: string;
  } = {}) => {
    const isLive =
      typeof explicitState === "boolean"
        ? explicitState
        : Boolean(await isStreamerbotLivestreamActiveMock());

    if (!isLive) {
      throw new Error(failureError ?? "livestream_not_live");
    }

    return true;
  },
}));

vi.mock("@/lib/streamerbot/death-counter-game", () => ({
  getActiveDeathCounterGame: getActiveDeathCounterGameMock,
}));

import { demoBetRecords, demoQuotes } from "@/lib/demo-data";
import {
  betEntries,
  betOptions,
  bets,
  pointLedger,
  redemptions,
  streamerbotCounters,
  streamerbotEventLog,
  users,
  viewerBalances,
} from "@/lib/db/schema";
import { GAME_SUGGESTION_CREATION_COST } from "@/lib/game-suggestions/constants";
import { VIDEO_SUGGESTION_CREATION_COST } from "@/lib/video-suggestions/constants";
import {
  adminLinkGoogleViewerToYoutubeViewer,
  boostGameSuggestion,
  boostVideoSuggestion,
  cancelBet,
  createBet,
  createGameSuggestion,
  createVideoSuggestion,
  createProductRecommendationFromInput,
  deleteProductRecommendation,
  applyGoogleCrossAccountProtectionEvent,
  claimViewerLinkCodeFromStreamerbot,
  ensureViewerFromSession,
  getViewerDashboard,
  getActiveQuoteOverlay,
  getObsOverlayAdminStatus,
  getSessionViewerState,
  getViewerLinkCodeState,
  getViewerBalanceFromChatCommand,
  ingestStreamerbotEvent,
  issueViewerLinkCode,
  listAdminProductRecommendations,
  listAdminViewerDirectory,
  listBets,
  listGameSuggestions,
  listAdminGameSuggestions,
  listVideoSuggestions,
  listStreamerbotCounters,
  listViewerChannelsForGoogleAccount,
  lockBet,
  finalizeGoogleRiscDelivery,
  placeBet,
  placeBetFromChatCommand,
  listQuotes,
  registerGoogleRiscDelivery,
  runQuoteCommandFromChat,
  runDeathCounterCommand,
  runStreamerbotCounterCommand,
  resolveBet,
  setActiveViewerForGoogleAccount,
  setObsOverlayPaused,
  showQuoteOverlayForViewer,
  cancelQueuedQuoteOverlays,
  updateGameSuggestionStatus,
  updateVideoSuggestionStatus,
} from "@/lib/db/repository";
import { GOOGLE_RISC_EVENT_TYPES } from "@/lib/google/risc";

function createDb({
  usersRows = [],
  betRows = [],
  optionRows = [],
  entryRows = [],
  betsError,
  optionsError,
  entriesError,
}: {
  usersRows?: Array<{
    id: string;
    googleUserId: string | null;
    email: string | null;
    youtubeChannelId: string;
    youtubeDisplayName: string;
    youtubeHandle?: string | null;
    avatarUrl: string | null;
    isLinked: boolean;
    excludeFromRanking: boolean;
    createdAt: Date;
  }>;
  betRows?: unknown[];
  optionRows?: unknown[];
  entryRows?: unknown[];
  betsError?: Error;
  optionsError?: Error;
  entriesError?: Error;
}) {
  return {
    select() {
      return {
        from(table: unknown) {
          if (table === users) {
            return {
              where() {
                return {
                  limit: async () => usersRows,
                };
              },
            };
          }

          if (table === bets) {
            return {
              orderBy: async () => {
                if (betsError) {
                  throw betsError;
                }
                return betRows;
              },
            };
          }

          if (table === betOptions) {
            if (optionsError) {
              return Promise.reject(optionsError);
            }
            return Promise.resolve(optionRows);
          }

          if (table === betEntries) {
            return {
              where: async () => {
                if (entriesError) {
                  throw entriesError;
                }
                return entryRows;
              },
            };
          }

          throw new Error("Unexpected table in test db stub.");
        },
      };
    },
  };
}

function createPlaceBetDb(options?: {
  amount?: number;
  currentBalance?: number;
  insertConflict?: boolean;
  balanceDebitSucceeds?: boolean;
  existingEntry?: {
    id: string;
    optionId: string;
    amount: number;
    createdAt?: Date;
  };
}) {
  const amount = options?.amount ?? 50;
  const currentBalance = options?.currentBalance ?? 100;
  const insertConflict = options?.insertConflict ?? false;
  const balanceDebitSucceeds = options?.balanceDebitSucceeds ?? true;
  const existingEntryRow = options?.existingEntry
    ? {
        id: options.existingEntry.id,
        betId: "bet-db-1",
        optionId: options.existingEntry.optionId,
        viewerId: "viewer-db-1",
        amount: options.existingEntry.amount,
        payoutAmount: null,
        settledAt: null,
        refundedAt: null,
        createdAt: options.existingEntry.createdAt ?? new Date("2026-03-31T10:30:00.000Z"),
      }
    : null;

  const viewerRow = {
    id: "viewer-db-1",
    googleUserId: "google-db-1",
    email: "viewer@example.com",
    youtubeChannelId: "yt_db_1",
    youtubeDisplayName: "Viewer DB",
    youtubeHandle: "@viewerdb",
    avatarUrl: null,
    isLinked: true,
    excludeFromRanking: false,
    createdAt: new Date("2026-03-31T10:00:00.000Z"),
  };

  const balanceRow = {
    viewerId: viewerRow.id,
    currentBalance,
    lifetimeEarned: 200,
    lifetimeSpent: 30,
    lastSyncedAt: new Date("2026-03-31T10:00:00.000Z"),
  };
  const now = Date.now();

  const betRow = {
    id: "bet-db-1",
    question: "Vai passar sem hit?",
    status: "open",
    openedAt: new Date(now - 5 * 60 * 1000),
    closesAt: new Date(now + 60 * 60 * 1000),
    lockedAt: null,
    resolvedAt: null,
    cancelledAt: null,
    winningOptionId: null,
    createdAt: new Date(now - 10 * 60 * 1000),
  };

  const optionRows = [
    {
      id: "bet-opt-1",
      betId: betRow.id,
      label: "Sim",
      sortOrder: 0,
      poolAmount: 100,
    },
    {
      id: "bet-opt-2",
      betId: betRow.id,
      label: "Nao",
      sortOrder: 1,
      poolAmount: 200,
    },
  ];

  const insertedBetEntries: unknown[] = [];
  const insertedLedger: unknown[] = [];

  const tx = {
    select() {
      return {
        from(table: unknown) {
          if (table === bets) {
            return {
              where() {
                return {
                  limit: async () => [betRow],
                };
              },
            };
          }

          if (table === betOptions) {
            return {
              where() {
                return {
                  limit: async () => [optionRows[0]],
                };
              },
            };
          }

          if (table === betEntries) {
            return {
              where() {
                return {
                  limit: async () => (existingEntryRow ? [existingEntryRow] : []),
                };
              },
            };
          }

          throw new Error("Unexpected table in placeBet tx stub.");
        },
      };
    },
    insert(table: unknown) {
      if (table === betEntries) {
        return {
          values(value: unknown) {
            return {
              onConflictDoNothing() {
                return {
                  returning: async () => {
                    if (insertConflict) {
                      return [];
                    }
                    insertedBetEntries.push(value);
                    return [{ id: "inserted-bet-entry" }];
                  },
                };
              },
            };
          },
        };
      }

      if (table === pointLedger) {
        return {
          values: async (value: unknown) => {
            insertedLedger.push(value);
          },
        };
      }

      throw new Error("Unexpected insert table in placeBet tx stub.");
    },
    update(table: unknown) {
      if (table === viewerBalances) {
        return {
          set() {
            return {
              where() {
                return {
                  returning: async () => {
                    if (!balanceDebitSucceeds) {
                      return [];
                    }
                    balanceRow.currentBalance -= amount;
                    balanceRow.lifetimeSpent += amount;
                    balanceRow.lastSyncedAt = new Date();
                    return [{ viewerId: balanceRow.viewerId }];
                  },
                };
              },
            };
          },
        };
      }

      if (table === betEntries) {
        return {
          set() {
            return {
              where() {
                return {
                  returning: async () => {
                    if (!existingEntryRow) {
                      return [];
                    }

                    existingEntryRow.amount += amount;
                    return [existingEntryRow];
                  },
                };
              },
            };
          },
        };
      }

      if (table === betOptions) {
        return {
          set() {
            return {
              where: async () => {
                optionRows[0]!.poolAmount += amount;
              },
            };
          },
        };
      }

      throw new Error("Unexpected update table in placeBet tx stub.");
    },
  };

  return {
    insertedBetEntries,
    insertedLedger,
    balanceRow,
    optionRows,
    db: {
      select() {
        return {
          from(table: unknown) {
            if (table === users) {
              return {
                where() {
                  return {
                    limit: async () => [viewerRow],
                  };
                },
              };
            }

            if (table === viewerBalances) {
              return {
                where() {
                  return {
                    limit: async () => [balanceRow],
                  };
                },
              };
            }

            if (table === redemptions) {
              return {
                where() {
                  return {
                    orderBy: async () => [],
                  };
                },
              };
            }

            if (table === bets) {
              return {
                orderBy: async () => [betRow],
              };
            }

            if (table === betOptions) {
              return Promise.resolve(optionRows);
            }

            if (table === betEntries) {
              return {
                where: async () => (existingEntryRow ? [existingEntryRow] : []),
              };
            }

            throw new Error("Unexpected table in placeBet db stub.");
          },
        };
      },
      async transaction<T>(callback: (txArg: typeof tx) => Promise<T>) {
        return callback(tx);
      },
    },
  };
}

function createStreamerbotEventDb({
  usersRows,
  balanceRows,
  existingEvents = [],
}: {
  usersRows: Array<{
    id: string;
    googleUserId: string | null;
    email: string | null;
    youtubeChannelId: string;
    youtubeDisplayName: string;
    youtubeHandle?: string | null;
    avatarUrl: string | null;
    isLinked: boolean;
    excludeFromRanking: boolean;
    createdAt: Date;
  }>;
  balanceRows: Array<{
    viewerId: string;
    currentBalance: number;
    lifetimeEarned: number;
    lifetimeSpent: number;
    lastSyncedAt: Date;
  }>;
  existingEvents?: Array<{ eventId: string }>;
}) {
  const insertedEvents: unknown[] = [];
  const insertedLedger: unknown[] = [];

  return {
    insertedEvents,
    insertedLedger,
    db: {
      select() {
        return {
          from(table: unknown) {
            if (table === streamerbotEventLog) {
              return {
                where() {
                  return {
                    limit: async () => existingEvents,
                  };
                },
              };
            }

            if (table === users) {
              return {
                where() {
                  return {
                    limit: async () => usersRows,
                  };
                },
              };
            }

            if (table === viewerBalances) {
              return {
                where() {
                  return {
                    limit: async () => balanceRows,
                  };
                },
              };
            }

            throw new Error("Unexpected table in streamerbot event db stub.");
          },
        };
      },
      update(table: unknown) {
        if (table === users) {
          return {
            set(values: Partial<(typeof usersRows)[number]>) {
              return {
                where: async () => {
                  Object.assign(usersRows[0], values);
                },
              };
            },
          };
        }

        if (table === viewerBalances) {
          return {
            set(values: { currentBalance?: number; lifetimeEarned?: number; lifetimeSpent?: number; lastSyncedAt?: Date }) {
              return {
                where: async () => {
                  if (typeof values.currentBalance === "number") {
                    balanceRows[0]!.currentBalance = values.currentBalance;
                  }
                  if (typeof values.lifetimeEarned === "number") {
                    balanceRows[0]!.lifetimeEarned = values.lifetimeEarned;
                  }
                  if (typeof values.lifetimeSpent === "number") {
                    balanceRows[0]!.lifetimeSpent = values.lifetimeSpent;
                  }
                  if (values.lastSyncedAt) {
                    balanceRows[0]!.lastSyncedAt = values.lastSyncedAt;
                  }
                },
              };
            },
          };
        }

        throw new Error("Unexpected update table in streamerbot event db stub.");
      },
      insert(table: unknown) {
        if (table === streamerbotEventLog) {
          return {
            values: async (value: unknown) => {
              insertedEvents.push(value);
            },
          };
        }

        if (table === users) {
          return {
            values: async (
              value: Omit<(typeof usersRows)[number], "createdAt"> & { createdAt?: Date },
            ) => {
              usersRows.push({
                ...value,
                youtubeHandle: value.youtubeHandle ?? null,
                createdAt: value.createdAt ?? new Date(),
              });
            },
          };
        }

        if (table === viewerBalances) {
          return {
            values: async (
              value: Omit<(typeof balanceRows)[number], "lastSyncedAt"> & { lastSyncedAt?: Date },
            ) => {
              balanceRows.push({
                ...value,
                lastSyncedAt: value.lastSyncedAt ?? new Date(),
              });
            },
          };
        }

        if (table === pointLedger) {
          return {
            values: async (value: unknown) => {
              insertedLedger.push(value);
            },
          };
        }

        throw new Error("Unexpected insert table in streamerbot event db stub.");
      },
    },
  };
}

function createStreamerbotCounterDb({
  counterRows,
}: {
  counterRows?: Array<{
    key: string;
    value: number;
    lastResetAt: Date | null;
    updatedAt: Date;
    metadata: Record<string, unknown>;
  }>;
} = {}) {
  const rows = counterRows ? [...counterRows] : [];

  const tx = {
    select() {
      return {
        from(table: unknown) {
          if (table === streamerbotCounters) {
            return Object.assign(rows, {
              where() {
                return {
                  limit: async () => rows,
                };
              },
            });
          }

          throw new Error("Unexpected table in streamerbot counter tx stub.");
        },
      };
    },
    insert(table: unknown) {
      if (table === streamerbotCounters) {
        return {
          values(value: {
            key: string;
            value: number;
            lastResetAt: Date | null;
            updatedAt: Date;
            metadata: Record<string, unknown>;
          }) {
            return {
              onConflictDoNothing: async () => {
                if (rows.some((entry) => entry.key === value.key)) {
                  return;
                }

                rows.push(value);
              },
            };
          },
        };
      }

      throw new Error("Unexpected insert table in streamerbot counter tx stub.");
    },
    update(table: unknown) {
      if (table === streamerbotCounters) {
        return {
          set(values: Partial<(typeof rows)[number]>) {
            return {
              where: async () => {
                if (!rows[0]) {
                  throw new Error("Expected a counter row before update.");
                }

                Object.assign(rows[0], values);
              },
            };
          },
        };
      }

      throw new Error("Unexpected update table in streamerbot counter tx stub.");
    },
  };

  return {
    rows,
    db: {
      select: tx.select,
      insert: tx.insert,
      update: tx.update,
      async transaction<T>(callback: (txArg: typeof tx) => Promise<T>) {
        return callback(tx);
      },
    },
  };
}

describe("listBets", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    delete (globalThis as typeof globalThis & { __lojaDemoStore?: unknown }).__lojaDemoStore;
    getActiveDeathCounterGameMock.mockReset();
    getActiveDeathCounterGameMock.mockResolvedValue(null);
  });

  it("falls back to demo bets when the bets table query is unavailable", async () => {
    getDbMock.mockReturnValue(
      createDb({
        betsError: new Error('relation "bets" does not exist'),
      }),
    );

    const result = await listBets();

    expect(result).toHaveLength(demoBetRecords.length);
    expect(result.find((bet) => bet.id === "bet-1")).toMatchObject({
      question: "Ela vai zerar o boss sem morrer?",
      totalPool: 4650,
    });
  });

  it("falls back to demo bets for authenticated viewers when bet option queries fail", async () => {
    getDbMock.mockReturnValue(
      createDb({
        usersRows: [
          {
            id: "viewer_ana",
            googleUserId: "google_ana",
            email: "ana@example.com",
            youtubeChannelId: "yt_ana",
            youtubeDisplayName: "Ana Neon",
            avatarUrl: null,
            isLinked: true,
            excludeFromRanking: false,
            createdAt: new Date("2026-03-31T10:00:00.000Z"),
          },
        ],
        optionsError: new Error('Failed query: select * from "bet_options"'),
      }),
    );

    const result = await listBets("viewer_ana");

    expect(result.find((bet) => bet.id === "bet-2")?.viewerPosition).toMatchObject({
      optionId: "opt-2b",
      amount: 400,
      payoutAmount: 683,
      isWinner: true,
    });
  });

  it("rethrows unrelated database errors", async () => {
    getDbMock.mockReturnValue(
      createDb({
        betsError: new Error("database unavailable"),
      }),
    );

    await expect(listBets()).rejects.toThrow("database unavailable");
  });
});

describe("bet lifecycle transitions", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    getDbMock.mockReturnValue(null);
    delete (globalThis as typeof globalThis & { __lojaDemoStore?: unknown }).__lojaDemoStore;
  });

  it("rejects locking a resolved bet", async () => {
    await expect(lockBet("bet-2")).rejects.toThrow("bet_already_resolved");
  });

  it("rejects resolving an open bet", async () => {
    await expect(resolveBet({ betId: "bet-1", winningOptionId: "opt-1a" })).rejects.toThrow("bet_not_locked");
  });

  it("rejects cancelling a resolved bet", async () => {
    await expect(cancelBet("bet-2")).rejects.toThrow("bet_already_resolved");
  });

  it("allows the expected open -> lock -> resolve flow", async () => {
    const locked = await lockBet("bet-1");
    expect(locked.status).toBe("locked");

    const resolved = await resolveBet({ betId: "bet-1", winningOptionId: "opt-1a" });
    expect(resolved.status).toBe("resolved");
    expect(resolved.winningOptionId).toBe("opt-1a");
  });

  it("refunds every bettor when nobody picked the winning option", async () => {
    const beforeAna = await getViewerDashboard("viewer_ana");
    const beforeCaio = await getViewerDashboard("viewer_caio");
    expect(beforeAna).not.toBeNull();
    expect(beforeCaio).not.toBeNull();

    const bet = await createBet({
      question: "Ela acha o atalho secreto antes do boss final?",
      closesAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      options: ["Sim", "Nao"],
    });

    await placeBet({
      viewerId: "viewer_ana",
      betId: bet.id,
      optionId: bet.options[0].id,
      amount: 40,
      source: "web",
    });
    await placeBet({
      viewerId: "viewer_caio",
      betId: bet.id,
      optionId: bet.options[0].id,
      amount: 60,
      source: "web",
    });

    await lockBet(bet.id);

    const resolved = await resolveBet({ betId: bet.id, winningOptionId: bet.options[1].id });
    expect(resolved.status).toBe("resolved");
    expect(resolved.winningOptionId).toBe(bet.options[1].id);

    const anaBet = (await listBets("viewer_ana")).find((entry) => entry.id === bet.id);
    const caioBet = (await listBets("viewer_caio")).find((entry) => entry.id === bet.id);
    expect(anaBet?.viewerPosition).toMatchObject({
      optionId: bet.options[0].id,
      payoutAmount: null,
      refundedAt: expect.any(String),
        settledAt: null,
        isWinner: false,
    });
    expect(caioBet?.viewerPosition).toMatchObject({
      optionId: bet.options[0].id,
      payoutAmount: null,
      refundedAt: expect.any(String),
      settledAt: null,
      isWinner: false,
    });

    const afterAna = await getViewerDashboard("viewer_ana");
    const afterCaio = await getViewerDashboard("viewer_caio");
    expect(afterAna?.balance.currentBalance).toBe(beforeAna?.balance.currentBalance);
    expect(afterCaio?.balance.currentBalance).toBe(beforeCaio?.balance.currentBalance);
  });

  it("allows cancelling an open bet", async () => {
    const cancelled = await cancelBet("bet-3");
    expect(cancelled.status).toBe("cancelled");
  });
});

describe("placeBet demo top-ups", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    getDbMock.mockReturnValue(null);
    delete (globalThis as typeof globalThis & { __lojaDemoStore?: unknown }).__lojaDemoStore;
  });

  it("allows adding more to the same option in demo mode", async () => {
    const before = await getViewerDashboard("viewer_ana");
    const beforeBalance = before?.balance.currentBalance ?? 0;

    const firstEntry = await placeBet({
      viewerId: "viewer_ana",
      betId: "bet-1",
      optionId: "opt-1a",
      amount: 120,
      source: "web",
    });
    const updatedEntry = await placeBet({
      viewerId: "viewer_ana",
      betId: "bet-1",
      optionId: "opt-1a",
      amount: 30,
      source: "web",
    });

    expect(firstEntry.amount).toBe(120);
    expect(updatedEntry.amount).toBe(150);

    const bet = (await listBets("viewer_ana")).find((entry) => entry.id === "bet-1");
    expect(bet?.viewerPosition).toMatchObject({
      optionId: "opt-1a",
      amount: 150,
    });
    expect(bet?.options.find((option) => option.id === "opt-1a")?.poolAmount).toBe(1400);

    const after = await getViewerDashboard("viewer_ana");
    expect(after?.balance.currentBalance).toBe(beforeBalance - 150);
  });

  it("still blocks switching sides after a first bet", async () => {
    await placeBet({
      viewerId: "viewer_ana",
      betId: "bet-1",
      optionId: "opt-1a",
      amount: 120,
      source: "web",
    });

    await expect(
      placeBet({
        viewerId: "viewer_ana",
        betId: "bet-1",
        optionId: "opt-1b",
        amount: 30,
        source: "web",
      }),
    ).rejects.toThrow("aposta_ja_registrada");
  });
});

describe("placeBet database guards", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("updates the existing entry when the same option is topped up", async () => {
    const { db, balanceRow, optionRows } = createPlaceBetDb({
      existingEntry: {
        id: "bet-entry-db-1",
        optionId: "bet-opt-1",
        amount: 25,
      },
    });
    getDbMock.mockReturnValue(db);

    const entry = await placeBet({
      viewerId: "viewer-db-1",
      betId: "bet-db-1",
      optionId: "bet-opt-1",
      amount: 50,
      source: "web",
    });

    expect(entry).toMatchObject({
      id: "bet-entry-db-1",
      amount: 75,
      optionId: "bet-opt-1",
    });
    expect(balanceRow.currentBalance).toBe(50);
    expect(optionRows[0]?.poolAmount).toBe(150);
  });

  it("maps a concurrent insert conflict to duplicate bet", async () => {
    const { db } = createPlaceBetDb({ insertConflict: true });
    getDbMock.mockReturnValue(db);

    await expect(
      placeBet({
        viewerId: "viewer-db-1",
        betId: "bet-db-1",
        optionId: "bet-opt-1",
        amount: 50,
        source: "web",
      }),
    ).rejects.toThrow("aposta_ja_registrada");
  });

  it("maps a failed guarded debit to insufficient balance", async () => {
    const { db } = createPlaceBetDb({ balanceDebitSucceeds: false });
    getDbMock.mockReturnValue(db);

    await expect(
      placeBet({
        viewerId: "viewer-db-1",
        betId: "bet-db-1",
        optionId: "bet-opt-1",
        amount: 50,
        source: "web",
      }),
    ).rejects.toThrow("saldo_insuficiente");
  });
});

describe("placeBetFromChatCommand", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    getDbMock.mockReturnValue(null);
    delete (globalThis as typeof globalThis & { __lojaDemoStore?: unknown }).__lojaDemoStore;
  });

  it("allows an unlinked viewer to place a bet from chat by youtube channel id", async () => {
    const result = await placeBetFromChatCommand({
      viewerExternalId: "yt_lia",
      youtubeDisplayName: "Lia Pixel",
      betId: "bet-1",
      optionIndex: 2,
      amount: 75,
      source: "streamerbot_chat",
    });

    expect(result.viewer.id).toBe("viewer_lia");
    expect(result.option.id).toBe("opt-1b");
    expect(result.entry).toMatchObject({
      betId: "bet-1",
      optionId: "opt-1b",
      viewerId: "viewer_lia",
      amount: 75,
    });

    const bets = await listBets("viewer_lia");
    const bet = bets.find((entry) => entry.id === "bet-1");
    expect(bet?.viewerPosition).toMatchObject({
      optionId: "opt-1b",
      amount: 75,
    });

    const dashboard = await getViewerDashboard("viewer_lia");
    expect(dashboard?.balance.currentBalance).toBe(445);
  });

  it("allows topping up the same option from chat", async () => {
    await placeBetFromChatCommand({
      viewerExternalId: "yt_lia",
      youtubeDisplayName: "Lia Pixel",
      betId: "bet-1",
      optionIndex: 2,
      amount: 75,
      source: "streamerbot_chat",
    });

    const result = await placeBetFromChatCommand({
      viewerExternalId: "yt_lia",
      youtubeDisplayName: "Lia Pixel",
      betId: "bet-1",
      optionIndex: 2,
      amount: 25,
      source: "streamerbot_chat",
    });

    expect(result.entry).toMatchObject({
      betId: "bet-1",
      optionId: "opt-1b",
      viewerId: "viewer_lia",
      amount: 100,
    });

    const bet = (await listBets("viewer_lia")).find((entry) => entry.id === "bet-1");
    expect(bet?.viewerPosition).toMatchObject({
      optionId: "opt-1b",
      amount: 100,
    });

    const dashboard = await getViewerDashboard("viewer_lia");
    expect(dashboard?.balance.currentBalance).toBe(420);
  });

  it("requires betId when there is more than one open bet", async () => {
    await expect(
      placeBetFromChatCommand({
        viewerExternalId: "yt_lia",
        youtubeDisplayName: "Lia Pixel",
        optionIndex: 1,
        amount: 50,
        source: "streamerbot_chat",
      }),
    ).rejects.toThrow("multiple_open_bets");
  });
});

describe("getViewerBalanceFromChatCommand", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    getDbMock.mockReturnValue(null);
    delete (globalThis as typeof globalThis & { __lojaDemoStore?: unknown }).__lojaDemoStore;
  });

  it("returns the current balance for an existing chat viewer without mutating the store", async () => {
    const before = await getViewerDashboard("viewer_lia");
    const beforeStore = structuredClone(
      (globalThis as typeof globalThis & {
        __lojaDemoStore?: {
          viewers: Array<{
            id: string;
            youtubeChannelId: string | null;
            youtubeDisplayName: string;
          }>;
          balances: Array<{
            viewerId: string;
            currentBalance: number;
          }>;
        };
      }).__lojaDemoStore,
    );

    const result = await getViewerBalanceFromChatCommand({
      viewerExternalId: "yt_lia",
      youtubeDisplayName: "Lia Pixel Renomeada",
      source: "streamerbot_chat",
    });

    const after = await getViewerDashboard("viewer_lia");
    const afterStore = (globalThis as typeof globalThis & {
      __lojaDemoStore?: {
        viewers: Array<{
          id: string;
          youtubeChannelId: string | null;
          youtubeDisplayName: string;
        }>;
        balances: Array<{
          viewerId: string;
          currentBalance: number;
        }>;
      };
    }).__lojaDemoStore;

    expect(result.viewer.id).toBe("viewer_lia");
    expect(result.balance.currentBalance).toBe(520);
    expect(after?.balance.currentBalance).toBe(before?.balance.currentBalance);
    expect(afterStore).toEqual(beforeStore);
  });

  it("returns a clear error when the chat viewer does not exist yet", async () => {
    await expect(
      getViewerBalanceFromChatCommand({
        viewerExternalId: "yt_novo",
        youtubeDisplayName: "Viewer Novo",
        source: "streamerbot_chat",
      }),
    ).rejects.toThrow("viewer_not_ready");

    const store = (globalThis as typeof globalThis & {
      __lojaDemoStore?: {
        viewers: Array<{
          youtubeChannelId: string | null;
        }>;
      };
    }).__lojaDemoStore;

    expect(store?.viewers.some((entry) => entry.youtubeChannelId === "yt_novo")).toBe(false);
  });
});

describe("runQuoteCommandFromChat", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    getDbMock.mockReturnValue(null);
    isStreamerbotLivestreamActiveMock.mockReset();
    isStreamerbotLivestreamActiveMock.mockResolvedValue(true);
    delete (globalThis as typeof globalThis & { __lojaDemoStore?: unknown }).__lojaDemoStore;
  });

  it("creates quotes from chat without backend role checks", async () => {
    const result = await runQuoteCommandFromChat({
      action: "create",
      viewerExternalId: "yt_mod_1",
      youtubeDisplayName: "Mod Neon",
      youtubeHandle: "@modneon",
      quoteText: "essa run ta amaldiçoada",
      source: "streamerbot_chat",
    });

    expect(result.action).toBe("create");
    expect(result.viewer).toMatchObject({
      youtubeChannelId: "yt_mod_1",
      youtubeDisplayName: "Mod Neon",
    });
    expect(result.quote).toMatchObject({
      quoteNumber: demoQuotes.length + 1,
      body: "essa run ta amaldiçoada",
      createdByDisplayName: "Mod Neon",
      createdByYoutubeHandle: "@modneon",
      source: "streamerbot_chat",
    });
  });

  it("returns a quote by numeric id", async () => {
    const result = await runQuoteCommandFromChat({
      action: "get",
      quoteId: 2,
      source: "streamerbot_chat",
    });

    expect(result.action).toBe("get");
    expect(result.viewer).toBeNull();
    expect(result.quote).toMatchObject({
      quoteNumber: 2,
      body: "se eu morrer, foi estrategia",
    });
  });

  it("returns a random quote when no id is provided", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.75);

    try {
      const result = await runQuoteCommandFromChat({
        action: "get",
        source: "streamerbot_chat",
      });

      expect(result.quote).toMatchObject({
        quoteNumber: 2,
        body: "se eu morrer, foi estrategia",
      });
    } finally {
      randomSpy.mockRestore();
    }
  });

  it("reports quote not found for an unknown id", async () => {
    await expect(
      runQuoteCommandFromChat({
        action: "get",
        quoteId: 99,
        source: "streamerbot_chat",
      }),
    ).rejects.toThrow("quote_not_found");
  });

  it("lists quotes with the newest first", async () => {
    const quotes = await listQuotes();

    expect(quotes.map((entry) => entry.quoteNumber)).toEqual([2, 1]);
  });

  it("charges 50 pipetz and activates the OBS overlay for a quote", async () => {
    const result = await runQuoteCommandFromChat({
      action: "show",
      viewerExternalId: "yt_lia",
      youtubeDisplayName: "Lia Pixel",
      youtubeHandle: "@liapixel",
      quoteId: 2,
      source: "streamerbot_chat",
    });

    expect(result.action).toBe("show");
    expect(result.viewer).toMatchObject({
      youtubeChannelId: "yt_lia",
      youtubeDisplayName: "Lia Pixel",
    });
    expect(result.quote).toMatchObject({
      quoteNumber: 2,
      body: "se eu morrer, foi estrategia",
    });
    expect(result.overlay).toMatchObject({
      slot: "obs_main",
      quoteNumber: 2,
      quoteBody: "se eu morrer, foi estrategia",
      requestedByDisplayName: "Lia Pixel",
      requestedByYoutubeHandle: "@liapixel",
      cost: 50,
      source: "streamerbot_chat",
    });

    const dashboard = await getViewerDashboard("viewer_lia");
    expect(dashboard?.balance.currentBalance).toBe(470);

    const activeOverlay = await getActiveQuoteOverlay();
    expect(activeOverlay).toMatchObject({
      overlayId: result.overlay!.overlayId,
      quoteNumber: 2,
    });
  });

  it("queues quote overlay requests while OBS calls are paused and resumes FIFO", async () => {
    await setObsOverlayPaused({ paused: true, updatedBy: "admin@example.com" });

    const result = await runQuoteCommandFromChat({
      action: "show",
      viewerExternalId: "yt_lia",
      youtubeDisplayName: "Lia Pixel",
      youtubeHandle: "@liapixel",
      quoteId: 2,
      source: "streamerbot_chat",
    });

    expect(result.overlay).toBeNull();
    expect(result.queued).toMatchObject({
      quoteNumber: 2,
      requestedByDisplayName: "Lia Pixel",
      status: "queued",
      cost: 50,
    });
    expect(await getActiveQuoteOverlay()).toBeNull();

    let status = await getObsOverlayAdminStatus();
    expect(status.control.status).toBe("paused");
    expect(status.pendingCount).toBe(1);

    const dashboardAfterQueue = await getViewerDashboard("viewer_lia");
    expect(dashboardAfterQueue?.balance.currentBalance).toBe(470);

    status = await setObsOverlayPaused({ paused: false, updatedBy: "admin@example.com" });
    expect(status.control.status).toBe("active");
    expect(status.pendingCount).toBe(0);

    const activeOverlay = await getActiveQuoteOverlay();
    expect(activeOverlay).toMatchObject({
      quoteNumber: 2,
      requestedByDisplayName: "Lia Pixel",
    });
  });

  it("cancels queued quote overlays and refunds the viewer", async () => {
    await setObsOverlayPaused({ paused: true, updatedBy: "admin@example.com" });
    await runQuoteCommandFromChat({
      action: "show",
      viewerExternalId: "yt_lia",
      youtubeDisplayName: "Lia Pixel",
      quoteId: 1,
      source: "streamerbot_chat",
    });

    const dashboardAfterQueue = await getViewerDashboard("viewer_lia");
    expect(dashboardAfterQueue?.balance.currentBalance).toBe(470);

    const status = await cancelQueuedQuoteOverlays({ updatedBy: "admin@example.com" });
    expect(status.pendingCount).toBe(0);

    const dashboardAfterCancel = await getViewerDashboard("viewer_lia");
    expect(dashboardAfterCancel?.balance.currentBalance).toBe(520);
  });

  it("rejects quote overlay requests when the viewer lacks pipetz", async () => {
    await expect(
      runQuoteCommandFromChat({
        action: "show",
        viewerExternalId: "yt_low",
        youtubeDisplayName: "Viewer Sem Saldo",
        quoteId: 1,
        source: "streamerbot_chat",
      }),
    ).rejects.toThrow("saldo_insuficiente");
  });

  it("requires an existing quote number for the OBS overlay flow", async () => {
    await expect(
      runQuoteCommandFromChat({
        action: "show",
        viewerExternalId: "yt_lia",
        youtubeDisplayName: "Lia Pixel",
        source: "streamerbot_chat",
      }),
    ).rejects.toThrow("quote_id_required");
  });

  it("blocks a second quote overlay while one is still active", async () => {
    await runQuoteCommandFromChat({
      action: "show",
      viewerExternalId: "yt_lia",
      youtubeDisplayName: "Lia Pixel",
      quoteId: 1,
      source: "streamerbot_chat",
    });

    await expect(
      runQuoteCommandFromChat({
        action: "show",
        viewerExternalId: "yt_ana",
        youtubeDisplayName: "Ana Neon",
        quoteId: 2,
        source: "streamerbot_chat",
      }),
    ).rejects.toThrow("quote_overlay_busy");
  });

  it("blocks the OBS quote flow when no livestream is active", async () => {
    isStreamerbotLivestreamActiveMock.mockResolvedValue(false);

    await expect(
      runQuoteCommandFromChat({
        action: "show",
        viewerExternalId: "yt_lia",
        youtubeDisplayName: "Lia Pixel",
        quoteId: 1,
        source: "streamerbot_chat",
      }),
    ).rejects.toThrow("livestream_not_live");
  });
});

describe("showQuoteOverlayForViewer", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    getDbMock.mockReturnValue(null);
    isStreamerbotLivestreamActiveMock.mockReset();
    isStreamerbotLivestreamActiveMock.mockResolvedValue(true);
    delete (globalThis as typeof globalThis & { __lojaDemoStore?: unknown }).__lojaDemoStore;
  });

  it("allows calling an existing quote from the site and debits the viewer", async () => {
    const result = await showQuoteOverlayForViewer({
      viewerId: "viewer_ana",
      quoteId: 1,
      source: "web",
    });

    expect(result.quote).toMatchObject({
      quoteNumber: 1,
      body: "isso aqui vai dar muito certo, confia",
    });
    expect(result.viewer).toMatchObject({
      id: "viewer_ana",
      youtubeDisplayName: "Ana Neon",
    });
    expect(result.overlay).toMatchObject({
      quoteNumber: 1,
      requestedByDisplayName: "Ana Neon",
      cost: 50,
      source: "web",
    });

    const dashboard = await getViewerDashboard("viewer_ana");
    expect(dashboard?.balance.currentBalance).toBe(1370);
  });

  it("blocks the site quote overlay flow when the livestream is offline", async () => {
    isStreamerbotLivestreamActiveMock.mockResolvedValue(false);

    await expect(
      showQuoteOverlayForViewer({
        viewerId: "viewer_ana",
        quoteId: 1,
        source: "web",
      }),
    ).rejects.toThrow("livestream_not_live");
  });
});

describe("runStreamerbotCounterCommand", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    getActiveDeathCounterGameMock.mockReset();
    getActiveDeathCounterGameMock.mockResolvedValue(null);
    delete (globalThis as typeof globalThis & { __lojaDemoStore?: unknown }).__lojaDemoStore;
  });

  it("increments and reads the counter in demo mode", async () => {
    getDbMock.mockReturnValue(null);

    const incremented = await runStreamerbotCounterCommand({
      counterKey: "death_count",
      counterLabel: "mortes",
      action: "increment",
      requestedBy: "Ludy",
    });
    const current = await runStreamerbotCounterCommand({
      counterKey: "death_count",
      counterLabel: "mortes",
      action: "get",
    });

    expect(incremented).toMatchObject({
      mode: "demo",
      action: "increment",
      count: 1,
      replyMessage: "Ludy, contador de mortes: 1.",
    });
    expect(current).toMatchObject({
      mode: "demo",
      action: "get",
      count: 1,
      replyMessage: "contador de mortes atual: 1.",
    });
  });

  it("keeps multiple counter keys independent in demo mode", async () => {
    getDbMock.mockReturnValue(null);

    await runStreamerbotCounterCommand({
      counterKey: "death_count",
      counterLabel: "mortes",
      action: "increment",
      amount: 2,
    });
    await runStreamerbotCounterCommand({
      counterKey: "win_count",
      counterLabel: "vitorias",
      action: "increment",
      amount: 3,
    });

    const deaths = await runStreamerbotCounterCommand({
      counterKey: "death_count",
      counterLabel: "mortes",
      action: "get",
    });
    const wins = await runStreamerbotCounterCommand({
      counterKey: "win_count",
      counterLabel: "vitorias",
      action: "get",
    });

    expect(deaths.count).toBe(2);
    expect(deaths.replyMessage).toBe("contador de mortes atual: 2.");
    expect(wins.count).toBe(3);
    expect(wins.replyMessage).toBe("contador de vitorias atual: 3.");
  });

  it("keeps game-scoped counters independent in demo mode", async () => {
    getDbMock.mockReturnValue(null);

    await runStreamerbotCounterCommand({
      counterKey: "death_count",
      counterLabel: "mortes",
      action: "increment",
      scopeType: "game",
      scopeKey: "balatro",
      scopeLabel: "Balatro",
      amount: 2,
    });
    await runStreamerbotCounterCommand({
      counterKey: "death_count",
      counterLabel: "mortes",
      action: "increment",
      scopeType: "game",
      scopeKey: "hades_2",
      scopeLabel: "Hades 2",
      amount: 1,
    });

    const balatro = await runStreamerbotCounterCommand({
      counterKey: "death_count",
      counterLabel: "mortes",
      action: "get",
      scopeType: "game",
      scopeKey: "balatro",
      scopeLabel: "Balatro",
    });
    const hades = await runStreamerbotCounterCommand({
      counterKey: "death_count",
      counterLabel: "mortes",
      action: "get",
      scopeType: "game",
      scopeKey: "hades_2",
      scopeLabel: "Hades 2",
    });

    expect(balatro.count).toBe(2);
    expect(balatro.replyMessage).toBe("contador de mortes em Balatro atual: 2.");
    expect(hades.count).toBe(1);
    expect(hades.replyMessage).toBe("contador de mortes em Hades 2 atual: 1.");
  });

  it("lists public counters with global and game scopes in demo mode", async () => {
    getDbMock.mockReturnValue(null);

    await runStreamerbotCounterCommand({
      counterKey: "win_count",
      counterLabel: "vitorias",
      action: "increment",
      amount: 4,
    });
    await runStreamerbotCounterCommand({
      counterKey: "death_count",
      counterLabel: "mortes",
      action: "increment",
      scopeType: "game",
      scopeKey: "balatro",
      scopeLabel: "Balatro",
      amount: 2,
    });

    const counters = await listStreamerbotCounters();

    expect(counters.map((counter) => ({
      key: counter.key,
      label: counter.label,
      scopeType: counter.scopeType,
      scopeKey: counter.scopeKey,
      value: counter.value,
    }))).toEqual([
      {
        key: "win_count",
        label: "vitorias",
        scopeType: "global",
        scopeKey: "global",
        value: 4,
      },
      {
        key: "death_count",
        label: "mortes",
        scopeType: "game",
        scopeKey: "balatro",
        value: 2,
      },
    ]);
  });

  it("decrements the counter without going below zero in demo mode", async () => {
    getDbMock.mockReturnValue(null);

    await runStreamerbotCounterCommand({
      counterKey: "death_count",
      counterLabel: "mortes",
      action: "increment",
      scopeType: "game",
      scopeKey: "balatro",
      scopeLabel: "Balatro",
      amount: 3,
    });

    const decremented = await runStreamerbotCounterCommand({
      counterKey: "death_count",
      counterLabel: "mortes",
      action: "decrement",
      scopeType: "game",
      scopeKey: "balatro",
      scopeLabel: "Balatro",
      amount: 5,
      requestedBy: "Ludy",
    });

    expect(decremented).toMatchObject({
      mode: "demo",
      action: "decrement",
      count: 0,
      replyMessage: "Ludy, contador de mortes em Balatro: 0 (-3).",
    });
  });

  it("requires explicit confirmation before resetting in demo mode", async () => {
    getDbMock.mockReturnValue(null);

    await expect(
      runStreamerbotCounterCommand({
        counterKey: "death_count",
        counterLabel: "mortes",
        action: "reset",
      }),
    ).rejects.toThrow("reset_confirmation_required");
  });

  it("persists increments in database mode", async () => {
    const { db, rows } = createStreamerbotCounterDb();
    getDbMock.mockReturnValue(db);

    const result = await runStreamerbotCounterCommand({
      counterKey: "win_count",
      counterLabel: "vitorias",
      action: "increment",
      scopeType: "game",
      scopeKey: "mario_kart_world",
      scopeLabel: "Mario Kart World",
      amount: 2,
      requestedBy: "Mod",
      occurredAt: "2026-04-07T12:00:00.000Z",
    });

    expect(result).toMatchObject({
      mode: "database",
      action: "increment",
      count: 2,
      replyMessage: "Mod, contador de vitorias em Mario Kart World: 2 (+2).",
    });
    expect(rows[0]).toMatchObject({
      key: "game::mario_kart_world::win_count",
      value: 2,
      metadata: {
        counterKey: "win_count",
        scopeType: "game",
        scopeKey: "mario_kart_world",
        counterLabel: "vitorias",
        scopeLabel: "Mario Kart World",
      },
    });
    expect(result.counter).toMatchObject({
      key: "win_count",
      scopeType: "game",
      scopeKey: "mario_kart_world",
    });
  });

  it("reads game-scoped counters from the database using the physical storage key", async () => {
    const { db } = createStreamerbotCounterDb({
      counterRows: [
        {
          key: "game::mario_kart_world::win_count",
          value: 7,
          lastResetAt: null,
          updatedAt: new Date("2026-04-07T11:00:00.000Z"),
          metadata: {
            counterKey: "win_count",
            counterLabel: "vitorias",
            scopeType: "game",
            scopeKey: "mario_kart_world",
            scopeLabel: "Mario Kart World",
            lastAction: "increment",
            lastAmount: 2,
            source: "streamerbot_chat",
          },
        },
      ],
    });
    getDbMock.mockReturnValue(db);

    const counters = await listStreamerbotCounters();

    expect(counters).toEqual([
      {
        key: "win_count",
        label: "vitorias",
        scopeType: "game",
        scopeKey: "mario_kart_world",
        scopeLabel: "Mario Kart World",
        value: 7,
        lastResetAt: null,
        updatedAt: "2026-04-07T11:00:00.000Z",
        lastAction: "increment",
        lastAmount: 2,
        source: "streamerbot_chat",
      },
    ]);
  });

  it("hides technical counters from the public counter listing", async () => {
    const { db } = createStreamerbotCounterDb({
      counterRows: [
        {
          key: "livestream_override",
          value: 1,
          lastResetAt: null,
          updatedAt: new Date("2026-04-07T11:00:00.000Z"),
          metadata: {
            updatedBy: "admin",
          },
        },
        {
          key: "death_counter_active_game",
          value: 1,
          lastResetAt: null,
          updatedAt: new Date("2026-04-07T11:02:00.000Z"),
          metadata: {
            scopeType: "game",
            scopeKey: "silksong",
            scopeLabel: "Silksong",
            updatedBy: "admin@example.com",
          },
        },
        {
          key: "death_count",
          value: 154,
          lastResetAt: null,
          updatedAt: new Date("2026-04-07T11:05:00.000Z"),
          metadata: {
            counterKey: "death_count",
            counterLabel: "mortes",
            scopeType: "game",
            scopeKey: "silksong",
            scopeLabel: "Silksong",
            lastAction: "increment",
            lastAmount: 1,
            source: "streamerbot_chat",
          },
        },
      ],
    });
    getDbMock.mockReturnValue(db);

    const counters = await listStreamerbotCounters();

    expect(counters).toEqual([
      {
        key: "death_count",
        label: "mortes",
        scopeType: "game",
        scopeKey: "silksong",
        scopeLabel: "Silksong",
        value: 154,
        lastResetAt: null,
        updatedAt: "2026-04-07T11:05:00.000Z",
        lastAction: "increment",
        lastAmount: 1,
        source: "streamerbot_chat",
      },
    ]);
  });

  it("resets the counter in database mode when confirmed", async () => {
    const { db, rows } = createStreamerbotCounterDb({
      counterRows: [
        {
          key: "death_count",
          value: 5,
          lastResetAt: null,
          updatedAt: new Date("2026-04-07T11:00:00.000Z"),
          metadata: {},
        },
      ],
    });
    getDbMock.mockReturnValue(db);

    const result = await runStreamerbotCounterCommand({
      counterKey: "death_count",
      counterLabel: "mortes",
      action: "reset",
      confirmReset: true,
      requestedBy: "Admin",
      occurredAt: "2026-04-07T12:00:00.000Z",
      resetReason: "nova run",
    });

    expect(result).toMatchObject({
      mode: "database",
      action: "reset",
      count: 0,
      replyMessage: "Admin, contador de mortes resetado. Total atual: 0.",
    });
    expect(rows[0]).toMatchObject({
      key: "death_count",
      value: 0,
      metadata: {
        counterKey: "death_count",
        scopeType: "global",
        scopeKey: "global",
        lastAction: "reset",
        previousValue: 5,
        requestedBy: "Admin",
        source: "streamerbot_chat",
        resetReason: "nova run",
      },
    });
    expect(rows[0]?.lastResetAt?.toISOString()).toBe("2026-04-07T12:00:00.000Z");
  });

  it("routes death commands to the configured active game when no game scope is provided", async () => {
    const { db, rows } = createStreamerbotCounterDb();
    getDbMock.mockReturnValue(db);
    getActiveDeathCounterGameMock.mockResolvedValue({
      scopeType: "game",
      scopeKey: "silksong",
      scopeLabel: "Silksong",
      updatedAt: "2026-04-07T10:00:00.000Z",
      updatedBy: "admin@example.com",
    });

    const result = await runDeathCounterCommand({
      action: "increment",
      amount: 3,
      requestedBy: "Mod",
    });

    expect(result).toMatchObject({
      mode: "database",
      action: "increment",
      count: 3,
      replyMessage: "Mod, contador de mortes em Silksong: 3 (+3).",
    });
    expect(rows[0]).toMatchObject({
      key: "game::silksong::death_count",
      value: 3,
      metadata: {
        counterKey: "death_count",
        counterLabel: "mortes",
        scopeType: "game",
        scopeKey: "silksong",
        scopeLabel: "Silksong",
      },
    });
  });

  it("preserves an explicit game scope even when an active game is configured", async () => {
    const { db, rows } = createStreamerbotCounterDb();
    getDbMock.mockReturnValue(db);
    getActiveDeathCounterGameMock.mockResolvedValue({
      scopeType: "game",
      scopeKey: "silksong",
      scopeLabel: "Silksong",
      updatedAt: "2026-04-07T10:00:00.000Z",
      updatedBy: "admin@example.com",
    });

    const result = await runDeathCounterCommand({
      action: "increment",
      scopeType: "game",
      scopeKey: "hades_2",
      scopeLabel: "Hades 2",
      amount: 1,
    });

    expect(result.replyMessage).toBe("contador de mortes em Hades 2: 1.");
    expect(rows[0]?.key).toBe("game::hades_2::death_count");
  });
});

describe("game suggestions", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    getDbMock.mockReturnValue(null);
    delete (globalThis as typeof globalThis & { __lojaDemoStore?: unknown }).__lojaDemoStore;
  });

  it("creates a new game suggestion in demo mode", async () => {
    const before = await getViewerDashboard("viewer_ana");
    expect(before).not.toBeNull();
    const beforeBalance = before?.balance.currentBalance ?? 0;
    const beforeSpent = before?.balance.lifetimeSpent ?? 0;

    const created = await createGameSuggestion({
      viewerId: "viewer_ana",
      name: "Balatro",
      description: "Me deixa te ver quebrando a run.",
      source: "web",
    });

    expect(created).toMatchObject({
      name: "Balatro",
      status: "open",
      totalVotes: 0,
      suggestedBy: "Ana Neon",
    });

    const suggestions = await listGameSuggestions("viewer_ana");
    expect(suggestions.some((entry) => entry.name === "Balatro")).toBe(true);

    const after = await getViewerDashboard("viewer_ana");
    expect(after?.balance.currentBalance).toBe(beforeBalance - GAME_SUGGESTION_CREATION_COST);
    expect(after?.balance.lifetimeSpent).toBe(beforeSpent + GAME_SUGGESTION_CREATION_COST);

    const store = (globalThis as typeof globalThis & {
      __lojaDemoStore?: {
        ledger: Array<{
          viewerId: string;
          kind: string;
          amount: number;
          source: string;
          metadata: Record<string, unknown>;
        }>;
      };
    }).__lojaDemoStore;
    expect(store?.ledger[0]).toMatchObject({
      viewerId: "viewer_ana",
      kind: "game_suggestion_creation",
      amount: -GAME_SUGGESTION_CREATION_COST,
      source: "web",
      metadata: { suggestionId: created.id },
    });
  });

  it("rejects duplicate open suggestions by slug", async () => {
    await expect(
      createGameSuggestion({
        viewerId: "viewer_caio",
        name: "Hades II",
      }),
    ).rejects.toThrow("suggestion_already_exists");
  });

  it("blocks new suggestions when the viewer has insufficient balance", async () => {
    void (await getViewerDashboard("viewer_lia"));
    const store = (globalThis as typeof globalThis & {
      __lojaDemoStore?: {
        balances: Array<{
          viewerId: string;
          currentBalance: number;
        }>;
      };
    }).__lojaDemoStore;

    const balance = store?.balances.find((entry) => entry.viewerId === "viewer_lia");
    if (!balance) {
      throw new Error("Expected viewer_lia balance in the demo store.");
    }
    balance.currentBalance = GAME_SUGGESTION_CREATION_COST - 1;

    await expect(
      createGameSuggestion({
        viewerId: "viewer_lia",
        name: "Signalis",
      }),
    ).rejects.toThrow("saldo_insuficiente");
  });

  it("spends balance and increases votes when boosting", async () => {
    const before = await getViewerDashboard("viewer_ana");
    expect(before).not.toBeNull();
    const beforeBalance = before?.balance.currentBalance ?? 0;
    const beforeSpent = before?.balance.lifetimeSpent ?? 0;

    const updated = await boostGameSuggestion({
      suggestionId: "gs-4",
      viewerId: "viewer_ana",
      amount: 120,
      source: "web",
    });

    expect(updated.totalVotes).toBe(1320);
    expect(updated.viewerBoostTotal).toBe(120);

    const after = await getViewerDashboard("viewer_ana");
    expect(after?.balance.currentBalance).toBe(beforeBalance - 120);
    expect(after?.balance.lifetimeSpent).toBe(beforeSpent + 120);
  });

  it("blocks boost when the viewer has insufficient balance", async () => {
    await expect(
      boostGameSuggestion({
        suggestionId: "gs-1",
        viewerId: "viewer_lia",
        amount: 9999,
        source: "web",
      }),
    ).rejects.toThrow("saldo_insuficiente");
  });

  it("lets the admin update the suggestion status", async () => {
    const updated = await updateGameSuggestionStatus({
      suggestionId: "gs-4",
      status: "accepted",
    });

    expect(updated.status).toBe("accepted");

    const suggestions = await listAdminGameSuggestions();
    expect(suggestions.find((entry) => entry.id === "gs-4")?.status).toBe("accepted");
  });
});

describe("video suggestions", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    getDbMock.mockReturnValue(null);
    delete (globalThis as typeof globalThis & { __lojaDemoStore?: unknown }).__lojaDemoStore;
  });

  it("creates a new video suggestion in demo mode", async () => {
    const before = await getViewerDashboard("viewer_ana");
    expect(before).not.toBeNull();
    const beforeBalance = before?.balance.currentBalance ?? 0;
    const beforeSpent = before?.balance.lifetimeSpent ?? 0;

    const created = await createVideoSuggestion({
      viewerId: "viewer_ana",
      youtubeVideoId: "abc123DEF45",
      title: "Um video pra reagir",
      creatorName: "Canal Legal",
      thumbnailUrl: "https://i.ytimg.com/vi/abc123DEF45/hqdefault.jpg",
      videoUrl: "https://www.youtube.com/watch?v=abc123DEF45",
      reason: "Tem uma virada absurda no final.",
      source: "web",
    });

    expect(created).toMatchObject({
      youtubeVideoId: "abc123DEF45",
      title: "Um video pra reagir",
      creatorName: "Canal Legal",
      status: "open",
      totalVotes: 0,
      suggestedBy: "Ana Neon",
    });

    const suggestions = await listVideoSuggestions("viewer_ana");
    expect(suggestions.some((entry) => entry.youtubeVideoId === "abc123DEF45")).toBe(true);

    const after = await getViewerDashboard("viewer_ana");
    expect(after?.balance.currentBalance).toBe(beforeBalance - VIDEO_SUGGESTION_CREATION_COST);
    expect(after?.balance.lifetimeSpent).toBe(beforeSpent + VIDEO_SUGGESTION_CREATION_COST);
  });

  it("rejects duplicate open video suggestions", async () => {
    await expect(
      createVideoSuggestion({
        viewerId: "viewer_caio",
        youtubeVideoId: "dQw4w9WgXcQ",
        title: "Duplicado",
        creatorName: "Rick Astley",
        thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      }),
    ).rejects.toThrow("suggestion_already_exists");
  });

  it("spends balance and increases votes when boosting", async () => {
    const before = await getViewerDashboard("viewer_ana");
    expect(before).not.toBeNull();
    const beforeBalance = before?.balance.currentBalance ?? 0;
    const beforeSpent = before?.balance.lifetimeSpent ?? 0;

    const updated = await boostVideoSuggestion({
      suggestionId: "vs-1",
      viewerId: "viewer_ana",
      amount: 80,
      source: "web",
    });

    expect(updated.totalVotes).toBe(980);
    expect(updated.viewerBoostTotal).toBe(80);

    const after = await getViewerDashboard("viewer_ana");
    expect(after?.balance.currentBalance).toBe(beforeBalance - 80);
    expect(after?.balance.lifetimeSpent).toBe(beforeSpent + 80);
  });

  it("lets the admin update the video suggestion status", async () => {
    const updated = await updateVideoSuggestionStatus({
      suggestionId: "vs-1",
      status: "reacted",
    });

    expect(updated.status).toBe("reacted");
  });
});

describe("ensureViewerFromSession", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    delete (globalThis as typeof globalThis & { __lojaDemoStore?: unknown }).__lojaDemoStore;
  });

  it("creates a synthetic channel id and excludes admin users from ranking", async () => {
    getDbMock.mockReturnValue(null);

    const viewer = await ensureViewerFromSession({
      googleUserId: "google-admin",
      email: "admin@example.com",
      name: "Admin",
      image: null,
    });

    expect(viewer).toMatchObject({
      email: "admin@example.com",
      youtubeChannelId: "session:google-admin",
      isLinked: false,
      excludeFromRanking: true,
    });
  });

  it("hides the synthetic fallback channel after a real YouTube channel syncs", async () => {
    getDbMock.mockReturnValue(null);

    const fallbackViewer = await ensureViewerFromSession({
      googleUserId: "google_lud",
      email: "lud@example.com",
      name: "Lud",
      image: null,
    });

    expect(fallbackViewer?.youtubeChannelId).toBe("session:google_lud");

    const linkedViewer = await ensureViewerFromSession({
      googleUserId: "google_lud",
      email: "lud@example.com",
      name: "Lud",
      image: null,
      youtubeChannels: [
        {
          youtubeChannelId: "UC_LUD_REAL",
          youtubeDisplayName: "LudyLops",
        },
      ],
    });

    expect(linkedViewer?.id).toBe(fallbackViewer?.id);

    const state = await getSessionViewerState({
      googleUserId: "google_lud",
      email: "lud@example.com",
    });
    const channels = await listViewerChannelsForGoogleAccount(state!.googleAccount.id);

    expect(channels.map((entry) => entry.youtubeChannelId)).toEqual(["UC_LUD_REAL"]);
    expect(state?.activeViewer.youtubeChannelId).toBe("UC_LUD_REAL");
  });

  it("stores the channel handle when a Google-linked channel syncs", async () => {
    getDbMock.mockReturnValue(null);

    const linkedViewer = await ensureViewerFromSession({
      googleUserId: "google_handle",
      email: "handle@example.com",
      name: "Handle",
      image: null,
      youtubeChannels: [
        {
          youtubeChannelId: "UC_HANDLE_REAL",
          youtubeDisplayName: "Handle Hero",
          youtubeHandle: "@handlehero",
        },
      ],
    });

    expect(linkedViewer?.youtubeHandle).toBe("@handlehero");

    const state = await getSessionViewerState({
      googleUserId: "google_handle",
      email: "handle@example.com",
    });
    const channels = await listViewerChannelsForGoogleAccount(state!.googleAccount.id);

    expect(state?.activeViewer.youtubeHandle).toBe("@handlehero");
    expect(channels[0]?.youtubeHandle).toBe("@handlehero");
  });

  it("prunes stale synthetic fallback rows once a real channel is already linked", async () => {
    getDbMock.mockReturnValue(null);

    const fallbackViewer = await ensureViewerFromSession({
      googleUserId: "google_lud",
      email: "lud@example.com",
      name: "Lud",
      image: null,
    });

    const store = (globalThis as typeof globalThis & {
      __lojaDemoStore?: {
        googleAccounts: Array<{ id: string; email: string; activeViewerId: string | null }>;
        viewers: Array<{
          id: string;
          googleUserId: string | null;
          email: string | null;
          youtubeChannelId: string;
          youtubeDisplayName: string;
          avatarUrl: string | null;
          isLinked: boolean;
          excludeFromRanking: boolean;
          createdAt: string;
        }>;
        balances: Array<{
          viewerId: string;
          currentBalance: number;
          lifetimeEarned: number;
          lifetimeSpent: number;
          lastSyncedAt: string;
        }>;
        googleAccountViewers: Array<{
          id: string;
          googleAccountId: string;
          viewerId: string;
          createdAt: string;
        }>;
      };
    }).__lojaDemoStore;
    const account = store?.googleAccounts.find((entry: { email: string }) => entry.email === "lud@example.com");
    expect(account).toBeTruthy();
    if (!store || !account) {
      throw new Error("Expected a demo store and account for the seeded Google user.");
    }

    store.viewers.push({
      id: "viewer_lud_real",
      googleUserId: "google_lud",
      email: "lud@example.com",
      youtubeChannelId: "UC_LUD_REAL",
      youtubeDisplayName: "LudyLops",
      avatarUrl: null,
      isLinked: true,
      excludeFromRanking: false,
      createdAt: new Date("2026-04-01T00:00:00.000Z").toISOString(),
    });
    store.balances.push({
      viewerId: "viewer_lud_real",
      currentBalance: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
      lastSyncedAt: new Date("2026-04-01T00:00:00.000Z").toISOString(),
    });
    store.googleAccountViewers.push({
      id: "gav_lud_real",
      googleAccountId: account.id,
      viewerId: "viewer_lud_real",
      createdAt: new Date("2026-04-01T00:00:00.000Z").toISOString(),
    });
    account.activeViewerId = "viewer_lud_real";

    await ensureViewerFromSession({
      googleUserId: "google_lud",
      email: "lud@example.com",
      name: "Lud",
      image: null,
      youtubeChannels: [
        {
          youtubeChannelId: "UC_LUD_REAL",
          youtubeDisplayName: "LudyLops",
        },
      ],
    });

    const channels = await listViewerChannelsForGoogleAccount(account.id);

    expect(channels.map((entry) => entry.youtubeChannelId)).toEqual(["UC_LUD_REAL"]);
    expect(store.viewers.some((entry: { id: string }) => entry.id === fallbackViewer?.id)).toBe(false);
    expect(store.googleAccountViewers.some((entry: { viewerId: string }) => entry.viewerId === fallbackViewer?.id)).toBe(false);
  });

  it("reuses an orphan synthetic fallback viewer instead of creating a duplicate session channel", async () => {
    getDbMock.mockReturnValue(null);

    const fallbackViewer = await ensureViewerFromSession({
      googleUserId: "google_retry",
      email: "retry@example.com",
      name: "Retry",
      image: null,
    });

    const store = (globalThis as typeof globalThis & {
      __lojaDemoStore?: {
        googleAccounts: Array<{ id: string; email: string; activeViewerId: string | null }>;
        googleAccountViewers: Array<{ id: string; googleAccountId: string; viewerId: string; createdAt: string }>;
      };
    }).__lojaDemoStore;
    const account = store?.googleAccounts.find((entry) => entry.email === "retry@example.com");
    if (!store || !account || !fallbackViewer) {
      throw new Error("Expected demo account and fallback viewer for retry@example.com.");
    }

    store.googleAccountViewers = store.googleAccountViewers.filter((entry) => entry.viewerId !== fallbackViewer.id);
    account.activeViewerId = null;

    const retriedViewer = await ensureViewerFromSession({
      googleUserId: "google_retry",
      email: "retry@example.com",
      name: "Retry",
      image: null,
    });

    expect(retriedViewer?.id).toBe(fallbackViewer.id);

    const channels = await listViewerChannelsForGoogleAccount(account.id);
    expect(channels).toHaveLength(1);
    expect(channels[0]?.youtubeChannelId).toBe("session:google_retry");
  });

  it("attaches an orphan chat viewer when the same user later logs in with Google", async () => {
    getDbMock.mockReturnValue(null);

    const linkedViewer = await ensureViewerFromSession({
      googleUserId: "google_lia",
      email: "lia@example.com",
      name: "Lia",
      image: null,
      youtubeChannels: [
        {
          youtubeChannelId: "yt_lia",
          youtubeDisplayName: "Lia Pixel",
        },
      ],
    });

    expect(linkedViewer).toMatchObject({
      id: "viewer_lia",
      googleUserId: "google_lia",
      email: "lia@example.com",
      youtubeChannelId: "yt_lia",
      youtubeDisplayName: "Lia Pixel",
      isLinked: true,
    });

    const state = await getSessionViewerState({
      googleUserId: "google_lia",
      email: "lia@example.com",
    });
    expect(state?.activeViewer.id).toBe("viewer_lia");
    expect(state?.googleAccount.googleUserId).toBe("google_lia");

    const channels = await listViewerChannelsForGoogleAccount(state!.googleAccount.id);
    expect(channels.map((entry) => entry.id)).toContain("viewer_lia");
  });

  it("links all Google-owned channels and preserves the selected active viewer", async () => {
    getDbMock.mockReturnValue(null);

    const linkedViewer = await ensureViewerFromSession({
      googleUserId: "google_ana",
      email: "ana@example.com",
      name: "Ana",
      image: null,
      youtubeChannels: [
        {
          youtubeChannelId: "yt_ana",
          youtubeDisplayName: "Ana Neon",
        },
        {
          youtubeChannelId: "UC_ANA_ALT",
          youtubeDisplayName: "Ana Alt",
        },
      ],
    });

    expect(linkedViewer).toMatchObject({
      id: "viewer_ana",
      youtubeChannelId: "yt_ana",
      youtubeDisplayName: "Ana Neon",
      isLinked: true,
    });

    const state = await getSessionViewerState({
      googleUserId: "google_ana",
      email: "ana@example.com",
    });
    expect(state?.activeViewer.id).toBe(linkedViewer?.id);

    const channels = await listViewerChannelsForGoogleAccount(state!.googleAccount.id);
    expect(channels.map((entry) => entry.youtubeChannelId)).toEqual(
      expect.arrayContaining(["yt_ana", "UC_ANA_ALT"]),
    );

    const altViewer = channels.find((entry) => entry.youtubeChannelId === "UC_ANA_ALT");
    expect(altViewer).toBeTruthy();

    await setActiveViewerForGoogleAccount(state!.googleAccount.id, altViewer!.id);
    await ensureViewerFromSession({
      googleUserId: "google_ana",
      email: "ana@example.com",
      name: "Ana",
      image: null,
      youtubeChannels: [
        {
          youtubeChannelId: "UC_ANA_ALT",
          youtubeDisplayName: "Ana Alt",
        },
        {
          youtubeChannelId: "yt_ana",
          youtubeDisplayName: "Ana Neon",
        },
      ],
    });

    const switchedState = await getSessionViewerState({
      googleUserId: "google_ana",
      email: "ana@example.com",
    });
    expect(switchedState?.activeViewer.id).toBe(altViewer!.id);
  });

  it("keeps the same Google-linked viewer when that user later appears in chat", async () => {
    getDbMock.mockReturnValue(null);

    const linkedViewer = await ensureViewerFromSession({
      googleUserId: "google_ludy",
      email: "ludy@example.com",
      name: "Ludy",
      image: null,
      youtubeChannels: [
        {
          youtubeChannelId: "UC_LUDY_REAL",
          youtubeDisplayName: "LudyLops",
        },
      ],
    });

    const result = await ingestStreamerbotEvent({
      eventId: "evt-google-then-chat",
      eventType: "presence_tick",
      viewerExternalId: "UC_LUDY_REAL",
      youtubeDisplayName: "LudyLops",
      amount: 5,
      occurredAt: "2026-04-01T12:00:00.000Z",
      payload: {},
    });

    expect(result).toMatchObject({
      mode: "demo",
      viewerCreated: false,
      balanceUpdated: true,
      ledgerInserted: true,
      viewerId: linkedViewer?.id,
    });

    const state = await getSessionViewerState({
      googleUserId: "google_ludy",
      email: "ludy@example.com",
    });
    const channels = await listViewerChannelsForGoogleAccount(state!.googleAccount.id);
    const activeChannel = channels.find((entry) => entry.id === linkedViewer?.id);

    expect(activeChannel).toMatchObject({
      youtubeChannelId: "UC_LUDY_REAL",
      currentBalance: 5,
      lifetimeEarned: 5,
    });
  });
});

describe("adminLinkGoogleViewerToYoutubeViewer", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    delete (globalThis as typeof globalThis & { __lojaDemoStore?: unknown }).__lojaDemoStore;
  });

  it("lists admin viewers with Google account metadata", async () => {
    getDbMock.mockReturnValue(null);

    await ensureViewerFromSession({
      googleUserId: "google_admin_link",
      email: "link@example.com",
      name: "Link",
      image: null,
    });

    const directory = await listAdminViewerDirectory();
    const googleEntry = directory.find((entry) => entry.googleAccountEmail === "link@example.com");

    expect(googleEntry).toMatchObject({
      googleAccountEmail: "link@example.com",
      isSyntheticYoutubeChannel: true,
      isLinked: false,
    });
  });

  it("links a Google fallback viewer to a real YouTube viewer in demo mode", async () => {
    getDbMock.mockReturnValue(null);

    const fallbackViewer = await ensureViewerFromSession({
      googleUserId: "google_link_demo",
      email: "link-demo@example.com",
      name: "Link Demo",
      image: null,
    });
    if (!fallbackViewer) {
      throw new Error("Expected a synthetic Google viewer for link-demo@example.com.");
    }

    const result = await adminLinkGoogleViewerToYoutubeViewer({
      sourceViewerId: fallbackViewer.id,
      targetViewerId: "viewer_lia",
    });

    expect(result.viewer).toMatchObject({
      id: "viewer_lia",
      email: "link-demo@example.com",
      googleUserId: "google_link_demo",
      youtubeDisplayName: "Lia Pixel",
      googleAccountEmail: "link-demo@example.com",
      isLinked: true,
      isSyntheticYoutubeChannel: false,
    });

    const state = await getSessionViewerState({
      googleUserId: "google_link_demo",
      email: "link-demo@example.com",
    });

    expect(state?.activeViewer.id).toBe("viewer_lia");
    expect(state?.activeViewer.youtubeDisplayName).toBe("Lia Pixel");

    const directory = await listAdminViewerDirectory();
    expect(directory.some((entry) => entry.id === fallbackViewer.id)).toBe(false);
  });
});

describe("viewer link codes", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    delete (globalThis as typeof globalThis & { __lojaDemoStore?: unknown }).__lojaDemoStore;
  });

  it("issues a short-lived link code for the current signed-in account", async () => {
    getDbMock.mockReturnValue(null);

    const fallbackViewer = await ensureViewerFromSession({
      googleUserId: "google_link_code",
      email: "link-code@example.com",
      name: "Link Code",
      image: null,
    });
    const state = await getSessionViewerState({
      googleUserId: "google_link_code",
      email: "link-code@example.com",
    });

    expect(fallbackViewer?.isLinked).toBe(false);

    const issued = await issueViewerLinkCode(state!.googleAccount.id);
    const stored = await getViewerLinkCodeState(state!.googleAccount.id);

    expect(issued.linkCode).toHaveLength(6);
    expect(stored).toMatchObject({
      googleAccountId: state!.googleAccount.id,
      linkCode: issued.linkCode,
      claimedAt: null,
    });
  });

  it("claims a chat code and merges the synthetic viewer into the real chat viewer", async () => {
    getDbMock.mockReturnValue(null);

    const fallbackViewer = await ensureViewerFromSession({
      googleUserId: "google_claim_link",
      email: "claim-link@example.com",
      name: "Claim Link",
      image: null,
    });
    if (!fallbackViewer) {
      throw new Error("Expected a fallback viewer before claiming the chat link.");
    }

    const store = (globalThis as typeof globalThis & {
      __lojaDemoStore?: {
        balances: Array<{
          viewerId: string;
          currentBalance: number;
          lifetimeEarned: number;
          lifetimeSpent: number;
          lastSyncedAt: string;
        }>;
      };
    }).__lojaDemoStore;
    const fallbackBalance = store?.balances.find((entry) => entry.viewerId === fallbackViewer.id);
    if (!fallbackBalance) {
      throw new Error("Expected balance row for fallback viewer.");
    }
    fallbackBalance.currentBalance = 25;
    fallbackBalance.lifetimeEarned = 25;

    const stateBefore = await getSessionViewerState({
      googleUserId: "google_claim_link",
      email: "claim-link@example.com",
    });
    const link = await issueViewerLinkCode(stateBefore!.googleAccount.id);

    const result = await claimViewerLinkCodeFromStreamerbot({
      linkCode: link.linkCode,
      viewerExternalId: "yt_lia",
      youtubeDisplayName: "Lia Pixel",
      youtubeHandle: "@liapixel",
    });

    expect(result).toMatchObject({
      googleAccountId: stateBefore!.googleAccount.id,
      mergedSyntheticViewer: true,
    });
    expect(result.viewer).toMatchObject({
      id: "viewer_lia",
      email: "claim-link@example.com",
      googleUserId: "google_claim_link",
      isLinked: true,
      youtubeDisplayName: "Lia Pixel",
      youtubeHandle: "@liapixel",
    });

    const stateAfter = await getSessionViewerState({
      googleUserId: "google_claim_link",
      email: "claim-link@example.com",
    });
    expect(stateAfter?.activeViewer.id).toBe("viewer_lia");

    const channels = await listViewerChannelsForGoogleAccount(stateAfter!.googleAccount.id);
    expect(channels.map((entry) => entry.youtubeChannelId)).toEqual(["yt_lia"]);

    const linkedBalance = store?.balances.find((entry) => entry.viewerId === "viewer_lia");
    expect(linkedBalance?.currentBalance).toBe(545);
    expect(linkedBalance?.lifetimeEarned).toBe(645);
    expect(store?.balances.some((entry) => entry.viewerId === fallbackViewer.id)).toBe(false);

    const consumed = await getViewerLinkCodeState(stateAfter!.googleAccount.id);
    expect(consumed).toBeNull();
  });
});

describe("applyGoogleCrossAccountProtectionEvent", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    delete (globalThis as typeof globalThis & { __lojaDemoStore?: unknown }).__lojaDemoStore;
  });

  it("blocks new Google sign-ins and revokes local sessions on hijacking events", async () => {
    getDbMock.mockReturnValue(null);

    const before = await getSessionViewerState({
      googleUserId: "google_ana",
      email: "ana@example.com",
    });
    expect(before?.googleAccount.crossAccountProtectionState).toBe("ok");

    const result = await applyGoogleCrossAccountProtectionEvent({
      eventId: "evt-risc-hijack",
      eventType: GOOGLE_RISC_EVENT_TYPES.accountDisabled,
      googleUserId: "google_ana",
      occurredAt: "2026-04-14T14:00:00.000Z",
      reason: "hijacking",
    });

    expect(result).toMatchObject({
      matchedAccountId: before?.googleAccount.id,
      crossAccountProtectionState: "google_signin_blocked",
      sessionsRevokedAt: "2026-04-14T14:00:00.000Z",
    });

    const after = await getSessionViewerState({
      googleUserId: "google_ana",
      email: "ana@example.com",
    });
    expect(after?.googleAccount.crossAccountProtectionState).toBe("google_signin_blocked");
    expect(after?.googleAccount.crossAccountProtectionReason).toBe("hijacking");
    expect(after?.googleAccount.sessionsRevokedAt).toBe("2026-04-14T14:00:00.000Z");
  });

  it("keeps Google login enabled when only sessions must be revoked", async () => {
    getDbMock.mockReturnValue(null);

    const result = await applyGoogleCrossAccountProtectionEvent({
      eventId: "evt-risc-sessions",
      eventType: GOOGLE_RISC_EVENT_TYPES.sessionsRevoked,
      googleUserId: "google_caio",
      occurredAt: "2026-04-14T15:00:00.000Z",
    });

    expect(result).toMatchObject({
      crossAccountProtectionState: "ok",
      sessionsRevokedAt: "2026-04-14T15:00:00.000Z",
    });

    const after = await getSessionViewerState({
      googleUserId: "google_caio",
      email: "caio@example.com",
    });
    expect(after?.googleAccount.crossAccountProtectionState).toBe("ok");
    expect(after?.googleAccount.sessionsRevokedAt).toBe("2026-04-14T15:00:00.000Z");
  });
});

describe("google RISC delivery receipts", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    delete (globalThis as typeof globalThis & { __lojaDemoStore?: unknown }).__lojaDemoStore;
  });

  it("deduplicates deliveries by jti", async () => {
    getDbMock.mockReturnValue(null);

    const first = await registerGoogleRiscDelivery({
      jti: "evt-risc-1",
      eventTypes: [GOOGLE_RISC_EVENT_TYPES.sessionsRevoked],
      issuedAt: "2026-04-14T12:00:00.000Z",
    });
    const second = await registerGoogleRiscDelivery({
      jti: "evt-risc-1",
      eventTypes: [GOOGLE_RISC_EVENT_TYPES.sessionsRevoked],
      issuedAt: "2026-04-14T12:00:00.000Z",
    });

    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(false);
    expect(second.delivery?.jti).toBe("evt-risc-1");
  });

  it("marks a reserved delivery as processed", async () => {
    getDbMock.mockReturnValue(null);

    await registerGoogleRiscDelivery({
      jti: "evt-risc-2",
      eventTypes: [GOOGLE_RISC_EVENT_TYPES.accountDisabled],
      issuedAt: "2026-04-14T13:00:00.000Z",
    });

    const finalized = await finalizeGoogleRiscDelivery({
      jti: "evt-risc-2",
      matchedAccountCount: 1,
    });

    expect(finalized?.processedAt).toBeTruthy();
    expect(finalized?.matchedAccountCount).toBe(1);
    expect(finalized?.lastError).toBeNull();
  });
});

describe("ingestStreamerbotEvent", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    isStreamerbotLivestreamActiveMock.mockReset();
    isStreamerbotLivestreamActiveMock.mockResolvedValue(true);
    delete (globalThis as typeof globalThis & { __lojaDemoStore?: unknown }).__lojaDemoStore;
  });

  it("updates an existing viewer display name and handle from live events", async () => {
    const usersRows = [
      {
        id: "viewer-1",
        googleUserId: null,
        email: null,
        youtubeChannelId: "UC123",
        youtubeDisplayName: "UC123",
        youtubeHandle: null,
        avatarUrl: null,
        isLinked: false,
        excludeFromRanking: false,
        createdAt: new Date("2026-03-31T10:00:00.000Z"),
      },
    ];
    const balanceRows = [
      {
        viewerId: "viewer-1",
        currentBalance: 10,
        lifetimeEarned: 10,
        lifetimeSpent: 0,
        lastSyncedAt: new Date("2026-03-31T10:00:00.000Z"),
      },
    ];
    const { db, insertedEvents, insertedLedger } = createStreamerbotEventDb({ usersRows, balanceRows });
    getDbMock.mockReturnValue(db);

    const result = await ingestStreamerbotEvent({
      eventId: "evt-1",
      eventType: "presence_tick",
      viewerExternalId: "UC123",
      youtubeDisplayName: "Viewer Name",
      youtubeHandle: "viewername",
      amount: 5,
      occurredAt: "2026-03-31T12:00:00.000Z",
      payload: {},
    });

    expect(result).toMatchObject({
      mode: "database",
      deduped: false,
      viewerCreated: false,
      balanceUpdated: true,
      ledgerInserted: true,
      viewerId: "viewer-1",
    });
    expect(usersRows[0]?.youtubeDisplayName).toBe("Viewer Name");
    expect(usersRows[0]?.youtubeHandle).toBe("@viewername");
    expect(insertedEvents).toHaveLength(1);
    expect(insertedLedger).toHaveLength(1);
  });

  it("ignores an invalid live-event handle that looks like a display name", async () => {
    const usersRows = [
      {
        id: "viewer-1",
        googleUserId: null,
        email: null,
        youtubeChannelId: "UC123",
        youtubeDisplayName: "UC123",
        youtubeHandle: null,
        avatarUrl: null,
        isLinked: false,
        excludeFromRanking: false,
        createdAt: new Date("2026-03-31T10:00:00.000Z"),
      },
    ];
    const balanceRows = [
      {
        viewerId: "viewer-1",
        currentBalance: 10,
        lifetimeEarned: 10,
        lifetimeSpent: 0,
        lastSyncedAt: new Date("2026-03-31T10:00:00.000Z"),
      },
    ];
    const { db } = createStreamerbotEventDb({ usersRows, balanceRows });
    getDbMock.mockReturnValue(db);

    await ingestStreamerbotEvent({
      eventId: "evt-display-handle",
      eventType: "presence_tick",
      viewerExternalId: "UC123",
      youtubeDisplayName: "Viewer Name",
      youtubeHandle: "Viewer Name",
      amount: 5,
      occurredAt: "2026-03-31T12:00:00.000Z",
      payload: {},
    });

    expect(usersRows[0]?.youtubeDisplayName).toBe("Viewer Name");
    expect(usersRows[0]?.youtubeHandle).toBeNull();
  });

  it("stores the viewer handle when a live event creates a new viewer", async () => {
    const usersRows: Parameters<typeof createStreamerbotEventDb>[0]["usersRows"] = [];
    const balanceRows: Parameters<typeof createStreamerbotEventDb>[0]["balanceRows"] = [];
    const { db, insertedEvents, insertedLedger } = createStreamerbotEventDb({ usersRows, balanceRows });
    getDbMock.mockReturnValue(db);

    const result = await ingestStreamerbotEvent({
      eventId: "evt-new-viewer",
      eventType: "presence_tick",
      viewerExternalId: "UC999",
      youtubeDisplayName: "Fresh Viewer",
      youtubeHandle: "@freshviewer",
      amount: 5,
      occurredAt: "2026-03-31T12:00:00.000Z",
      payload: {},
    });

    expect(result).toMatchObject({
      mode: "database",
      deduped: false,
      viewerCreated: true,
      balanceUpdated: true,
      ledgerInserted: true,
    });
    expect(usersRows[0]).toMatchObject({
      youtubeChannelId: "UC999",
      youtubeDisplayName: "Fresh Viewer",
      youtubeHandle: "@freshviewer",
    });
    expect(insertedEvents).toHaveLength(1);
    expect(insertedLedger).toHaveLength(1);
  });

  it("ignores live-gated events when no livestream is active", async () => {
    isStreamerbotLivestreamActiveMock.mockResolvedValue(false);

    const usersRows = [
      {
        id: "viewer-1",
        googleUserId: null,
        email: null,
        youtubeChannelId: "UC123",
        youtubeDisplayName: "Viewer Name",
        avatarUrl: null,
        isLinked: false,
        excludeFromRanking: false,
        createdAt: new Date("2026-03-31T10:00:00.000Z"),
      },
    ];
    const balanceRows = [
      {
        viewerId: "viewer-1",
        currentBalance: 10,
        lifetimeEarned: 10,
        lifetimeSpent: 0,
        lastSyncedAt: new Date("2026-03-31T10:00:00.000Z"),
      },
    ];
    const { db, insertedEvents, insertedLedger } = createStreamerbotEventDb({ usersRows, balanceRows });
    getDbMock.mockReturnValue(db);

    const result = await ingestStreamerbotEvent({
      eventId: "evt-offline",
      eventType: "presence_tick",
      viewerExternalId: "UC123",
      youtubeDisplayName: "Viewer Name",
      amount: 5,
      occurredAt: "2026-03-31T12:00:00.000Z",
      payload: {},
    });

    expect(result).toMatchObject({
      mode: "database",
      eventLogInserted: false,
      balanceUpdated: false,
      ledgerInserted: false,
      ignoredReason: "livestream_not_live",
    });
    expect(insertedEvents).toHaveLength(0);
    expect(insertedLedger).toHaveLength(0);
    expect(balanceRows[0]?.currentBalance).toBe(10);
  });

  it("trusts an explicit payload isLive flag for unlisted live events", async () => {
    isStreamerbotLivestreamActiveMock.mockResolvedValue(false);

    const usersRows = [
      {
        id: "viewer-1",
        googleUserId: null,
        email: null,
        youtubeChannelId: "UC123",
        youtubeDisplayName: "Viewer Name",
        avatarUrl: null,
        isLinked: false,
        excludeFromRanking: false,
        createdAt: new Date("2026-03-31T10:00:00.000Z"),
      },
    ];
    const balanceRows = [
      {
        viewerId: "viewer-1",
        currentBalance: 10,
        lifetimeEarned: 10,
        lifetimeSpent: 0,
        lastSyncedAt: new Date("2026-03-31T10:00:00.000Z"),
      },
    ];
    const { db, insertedEvents, insertedLedger } = createStreamerbotEventDb({ usersRows, balanceRows });
    getDbMock.mockReturnValue(db);

    const result = await ingestStreamerbotEvent({
      eventId: "evt-unlisted-live",
      eventType: "presence_tick",
      viewerExternalId: "UC123",
      youtubeDisplayName: "Viewer Name",
      amount: 5,
      occurredAt: "2026-03-31T12:00:00.000Z",
      payload: {
        isLive: true,
        reason: "present_viewers",
        source: "streamerbot",
      },
    });

    expect(result).toMatchObject({
      mode: "database",
      deduped: false,
      eventLogInserted: true,
      balanceUpdated: true,
      ledgerInserted: true,
      viewerId: "viewer-1",
    });
    expect(insertedEvents).toHaveLength(1);
    expect(insertedLedger).toHaveLength(1);
    expect(insertedLedger[0]).toMatchObject({
      externalEventId: "evt-unlisted-live",
      amount: 5,
      metadata: {
        isLive: true,
        reason: "present_viewers",
        source: "streamerbot",
      },
    });
  });

});

describe("product recommendations", () => {
  beforeEach(() => {
    getDbMock.mockReturnValue(null);
    delete (globalThis as typeof globalThis & { __lojaDemoStore?: unknown }).__lojaDemoStore;
  });

  it("deletes a saved recommendation in demo mode", async () => {
    const created = await createProductRecommendationFromInput({
      name: "Controle Pro",
      category: "perifericos",
      context: "Para jogar no setup da live.",
      imageUrl: "/uploads/pro-controller.jpg",
      href: "https://example.com/pro-controller",
      storeLabel: "Loja Teste",
      linkKind: "external",
      sortOrder: 9,
      isActive: true,
    });

    const deleted = await deleteProductRecommendation(created.id);
    const recommendations = await listAdminProductRecommendations();

    expect(deleted.id).toBe(created.id);
    expect(recommendations.some((entry) => entry.id === created.id)).toBe(false);
  });

  it("rejects deleting an unknown recommendation", async () => {
    await expect(deleteProductRecommendation("missing-recommendation")).rejects.toThrow(
      "recommendation_not_found",
    );
  });
});
