import { creatorStatusLabels } from "@/lib/creators/owner-dashboard";
import type { CreatorStatus } from "@/lib/types";

const tones: Record<CreatorStatus, string> = {
  active: "bg-[var(--color-mint)]",
  disabled: "bg-[var(--color-yellow)]",
  archived: "bg-[var(--color-paper)]",
};

export function CommunityStatusBadge({ status }: { status: CreatorStatus }) {
  return (
    <span className={`badge-brutal shrink-0 px-2 py-1 text-[10px] text-[var(--color-ink)] ${tones[status]}`}>
      {creatorStatusLabels[status]}
    </span>
  );
}
