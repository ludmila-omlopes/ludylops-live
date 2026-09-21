import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";

/** Required storage scope, supplied only after the caller's authority checks. */
export type CreatorContext = { creatorId: string };
export const defaultCreatorContext: CreatorContext = { creatorId: DEFAULT_CREATOR_ID };

export function requireCreatorContext(context: CreatorContext) {
  if (!context?.creatorId || !context.creatorId.trim()) throw new Error("creator_context_required");
  return context.creatorId;
}

export function requireDefaultCreatorCapability(context: CreatorContext) {
  if (requireCreatorContext(context) !== DEFAULT_CREATOR_ID) throw new Error("operation_not_isolated");
}
