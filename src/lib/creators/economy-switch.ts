import { env, isDemoMode } from "@/lib/env";

/** The environment switch every community-currency operation honors. */
export const communityEconomyEnabled = () => isDemoMode || env.CREATOR_ECONOMY_ENABLED === "true";
