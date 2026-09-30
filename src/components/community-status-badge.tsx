import { creatorStatusLabels } from "@/lib/creators/owner-dashboard";
import type { CreatorStatus } from "@/lib/types";

const tones: Record<CreatorStatus, string> = {
  active: "hub-chip-success",
  disabled: "hub-chip-warning",
  archived: "",
};

export function CommunityStatusBadge({ status }: { status: CreatorStatus }) {
  return <span className={`hub-chip shrink-0 ${tones[status]}`}>{creatorStatusLabels[status]}</span>;
}
