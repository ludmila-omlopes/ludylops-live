import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { creatorBranding, creators } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import { DEFAULT_CREATOR_BRANDING, DEFAULT_CREATOR_ID } from "./defaults";
import { listDemoCreatorTenants } from "./demo-store";
import { creatorProfileUpdateSchema, profileMatches, type CreatorProfile } from "./profile";

export class CreatorProfileAccessError extends Error {}
export class CreatorProfileConflictError extends Error {}
type Tx = Parameters<Parameters<NonNullable<ReturnType<typeof getDb>>["transaction"]>[0]>[0];
function identity(ownerId: string, creatorId: string) {
  if (!ownerId || !creatorId || creatorId === DEFAULT_CREATOR_ID) throw new CreatorProfileAccessError();
}
function demoTenant(ownerId: string, creatorId: string) {
  const tenant = listDemoCreatorTenants().find((t) => t.creator.id === creatorId && t.creator.ownerUserId === ownerId && t.creator.status === "active");
  if (!tenant) throw new CreatorProfileAccessError();
  return tenant;
}
function project(displayName: string, branding: { primaryColor: string; accentColor: string } = DEFAULT_CREATOR_BRANDING): CreatorProfile {
  return { displayName, primaryColor: branding.primaryColor, accentColor: branding.accentColor };
}
function database() {
  const db = getDb();
  if (!db) throw new Error("profile_storage_unavailable");
  return db;
}
async function lockedProfile(tx: Tx, ownerId: string, creatorId: string, writing: boolean) {
  const [creator] = await tx.select({ displayName: creators.displayName }).from(creators)
    .where(and(eq(creators.id, creatorId), eq(creators.ownerUserId, ownerId), eq(creators.status, "active")))
    .for(writing ? "update" : "share");
  if (!creator) throw new CreatorProfileAccessError();
  const [branding] = await tx.select({ primaryColor: creatorBranding.primaryColor, accentColor: creatorBranding.accentColor })
    .from(creatorBranding).where(eq(creatorBranding.creatorId, creatorId)).for(writing ? "update" : "share");
  return project(creator.displayName, branding);
}
export async function getOwnedCreatorProfile(ownerId: string, creatorId: string) {
  identity(ownerId, creatorId);
  if (isDemoMode) { const t = demoTenant(ownerId, creatorId); return project(t.creator.displayName, t.branding); }
  return database().transaction((tx) => lockedProfile(tx, ownerId, creatorId, false));
}
/** Owner identity comes from the session. Only presentation fields may change. */
export async function updateOwnedCreatorProfile(ownerId: string, creatorId: string, input: unknown) {
  identity(ownerId, creatorId);
  const { profile, expected } = creatorProfileUpdateSchema.parse(input);
  if (isDemoMode) {
    const t = demoTenant(ownerId, creatorId);
    const current = project(t.creator.displayName, t.branding);
    if (!profileMatches(current, expected) && !profileMatches(current, profile)) throw new CreatorProfileConflictError();
    const updatedAt = new Date().toISOString();
    t.creator = { ...t.creator, displayName: profile.displayName, updatedAt };
    t.branding = { ...t.branding, primaryColor: profile.primaryColor, accentColor: profile.accentColor, updatedAt };
    return profile;
  }
  return database().transaction(async (tx) => {
    const current = await lockedProfile(tx, ownerId, creatorId, true);
    if (!profileMatches(current, expected) && !profileMatches(current, profile)) throw new CreatorProfileConflictError();
    const updatedAt = new Date();
    await tx.update(creators).set({ displayName: profile.displayName, updatedAt }).where(eq(creators.id, creatorId));
    await tx.insert(creatorBranding).values({ creatorId, primaryColor: profile.primaryColor, accentColor: profile.accentColor, updatedAt })
      .onConflictDoUpdate({ target: creatorBranding.creatorId, set: { primaryColor: profile.primaryColor, accentColor: profile.accentColor, updatedAt } });
    return profile;
  });
}
