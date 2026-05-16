import { describe, expect, it } from "vitest";

import {
  getVideoSuggestionAdminActions,
  normalizeVideoSuggestionStatus,
  type VideoSuggestionAdminActionId,
} from "@/lib/video-suggestions/admin-actions";
import { updateVideoSuggestionStatusSchema } from "@/lib/video-suggestions/service";
import type { VideoSuggestionStatus } from "@/lib/types";

function actionSummary(status: VideoSuggestionStatus) {
  return getVideoSuggestionAdminActions(status).map((action) => ({
    id: action.id,
    label: action.label,
    targetStatus: action.targetStatus,
  }));
}

describe("video suggestion admin actions", () => {
  it.each([
    ["open", "open"],
    ["reacted", "reacted"],
    ["rejected", "rejected"],
    ["accepted", "reacted"],
  ] satisfies Array<[VideoSuggestionStatus, ReturnType<typeof normalizeVideoSuggestionStatus>]>)(
    "normalizes %s to %s",
    (status, expected) => {
      expect(normalizeVideoSuggestionStatus(status)).toBe(expected);
    },
  );

  it("shows only mark-as-watched and reject actions for open suggestions", () => {
    expect(actionSummary("open")).toEqual([
      {
        id: "mark_reacted",
        label: "Marcar assistido",
        targetStatus: "reacted",
      },
      {
        id: "reject",
        label: "Rejeitar",
        targetStatus: "rejected",
      },
    ]);
  });

  it("shows undo-watched and reject actions for watched suggestions", () => {
    expect(actionSummary("reacted")).toEqual([
      {
        id: "reopen",
        label: "Desfazer assistido",
        targetStatus: "open",
      },
      {
        id: "reject",
        label: "Rejeitar",
        targetStatus: "rejected",
      },
    ]);
  });

  it("treats legacy accepted suggestions like watched suggestions", () => {
    expect(actionSummary("accepted")).toEqual(actionSummary("reacted"));
  });

  it("shows mark-as-watched and reopen actions for rejected suggestions", () => {
    expect(actionSummary("rejected")).toEqual([
      {
        id: "mark_reacted",
        label: "Marcar assistido",
        targetStatus: "reacted",
      },
      {
        id: "reopen",
        label: "Reabrir",
        targetStatus: "open",
      },
    ]);
  });

  it("covers every available one-click transition from every visible state", () => {
    const expectedTransitions: Record<
      VideoSuggestionStatus,
      Partial<Record<VideoSuggestionAdminActionId, VideoSuggestionStatus>>
    > = {
      open: {
        mark_reacted: "reacted",
        reject: "rejected",
      },
      reacted: {
        reopen: "open",
        reject: "rejected",
      },
      rejected: {
        mark_reacted: "reacted",
        reopen: "open",
      },
      accepted: {
        reopen: "open",
        reject: "rejected",
      },
    };

    for (const [status, transitions] of Object.entries(expectedTransitions) as Array<
      [VideoSuggestionStatus, Partial<Record<VideoSuggestionAdminActionId, VideoSuggestionStatus>>]
    >) {
      const actions = getVideoSuggestionAdminActions(status);
      expect(
        Object.fromEntries(
          actions.map((action) => [action.id, action.targetStatus]),
        ),
      ).toEqual(transitions);
    }
  });

  it("keeps the admin mutation schema limited to visible button targets", () => {
    expect(updateVideoSuggestionStatusSchema.safeParse({ status: "open" }).success).toBe(true);
    expect(updateVideoSuggestionStatusSchema.safeParse({ status: "reacted" }).success).toBe(true);
    expect(updateVideoSuggestionStatusSchema.safeParse({ status: "rejected" }).success).toBe(true);
    expect(updateVideoSuggestionStatusSchema.safeParse({ status: "accepted" }).success).toBe(false);
  });
});
