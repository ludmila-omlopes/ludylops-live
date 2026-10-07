import { z } from "zod";

export const ownedGameMultiplierSchema = z.number().min(0).max(10)
  .transform((value) => Math.round(value * 100) / 100);

export function readOwnedGameMultiplier(config: unknown): number {
  const value = config && typeof config === "object" && "ownedGameMultiplier" in config
    ? config.ownedGameMultiplier : undefined;
  const parsed = ownedGameMultiplierSchema.safeParse(value);
  return parsed.success ? parsed.data : 1;
}

export function ownedGameScore(votes: number, isOwned: boolean, multiplier: number) {
  return Math.round(votes * (isOwned ? multiplier : 1));
}
