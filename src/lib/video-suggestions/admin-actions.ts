import type { VideoSuggestionStatus } from "@/lib/types";

export type AdminVideoSuggestionStatus = "open" | "reacted" | "rejected";

export type VideoSuggestionAdminActionId =
  | "mark_reacted"
  | "reject"
  | "reopen";

export type VideoSuggestionAdminAction = {
  id: VideoSuggestionAdminActionId;
  label: string;
  targetStatus: AdminVideoSuggestionStatus;
  variant: "danger" | "info" | "neutral";
};

export function normalizeVideoSuggestionStatus(
  status: VideoSuggestionStatus,
): AdminVideoSuggestionStatus {
  return status === "accepted" ? "reacted" : status;
}

export function getVideoSuggestionAdminActions(
  status: VideoSuggestionStatus,
): VideoSuggestionAdminAction[] {
  const normalizedStatus = normalizeVideoSuggestionStatus(status);

  if (normalizedStatus === "open") {
    return [
      {
        id: "mark_reacted",
        label: "Marcar assistido",
        targetStatus: "reacted",
        variant: "neutral",
      },
      {
        id: "reject",
        label: "Rejeitar",
        targetStatus: "rejected",
        variant: "danger",
      },
    ];
  }

  if (normalizedStatus === "reacted") {
    return [
      {
        id: "reopen",
        label: "Desfazer assistido",
        targetStatus: "open",
        variant: "info",
      },
      {
        id: "reject",
        label: "Rejeitar",
        targetStatus: "rejected",
        variant: "danger",
      },
    ];
  }

  return [
    {
      id: "mark_reacted",
      label: "Marcar assistido",
      targetStatus: "reacted",
      variant: "neutral",
    },
    {
      id: "reopen",
      label: "Reabrir",
      targetStatus: "open",
      variant: "info",
    },
  ];
}
