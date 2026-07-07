// Nome provisório da plataforma white label. O nome definitivo ainda não foi
// decidido: quando for, trocar apenas esta constante.
export const PLATFORM_NAME = "[nome da plataforma]";

export type CreatorLandingState = "visitor" | "closed_beta" | "approved";

export function resolveCreatorLandingState(input: {
  hasUsableSession: boolean;
  canCreateArea: boolean;
}): CreatorLandingState {
  if (!input.hasUsableSession) {
    return "visitor";
  }
  return input.canCreateArea ? "approved" : "closed_beta";
}
