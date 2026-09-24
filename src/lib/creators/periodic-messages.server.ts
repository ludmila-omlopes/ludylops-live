import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { creators, creatorModules } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { listDemoCreatorTenants } from "./demo-store";
import { defaultCreatorTenant } from "./tenant";
import { requireCreatorContext, type CreatorContext } from "./context";
import { PeriodicAccessError, readPeriodicState, periodicView, editPeriodicState, dispatchPeriodicState,
  periodicEditSchema, periodicDispatchSchema, type PeriodicState } from "./periodic-messages";

export type PeriodicActor = { kind: "owner"; ownerId: string } | { kind: "admin" } | { kind: "integration" };
function assertAccess(creator: { id: string; ownerUserId: string | null; status: string } | undefined, actor: PeriodicActor, status?: string) {
  if (!creator || creator.status !== "active" || !status || !["installed", "disabled"].includes(status) ||
    (actor.kind === "integration" && status !== "installed") ||
    (actor.kind === "admin" && creator.id !== DEFAULT_CREATOR_ID) ||
    (actor.kind === "owner" && (creator.id === DEFAULT_CREATOR_ID || !actor.ownerId || creator.ownerUserId !== actor.ownerId))) throw new PeriodicAccessError();
}
/** All callers provide a server-authorized actor. Lock the creator before its module, like lifecycle transitions. */
async function withState<T>(context: CreatorContext, actor: PeriodicActor, mutate: boolean, fn: (state: PeriodicState) => T): Promise<T> {
  const creatorId = requireCreatorContext(context);
  if (isDemoMode) {
    const tenant = listDemoCreatorTenants().find((entry) => entry.creator.id === creatorId) ?? (creatorId === DEFAULT_CREATOR_ID ? defaultCreatorTenant : undefined);
    const settings = tenant?.modules.find((entry) => entry.moduleKey === "streamerbot");
    assertAccess(tenant?.creator, actor, settings?.status);
    const state = readPeriodicState(settings!.configJson);
    const result = fn(state);
    if (mutate) settings!.configJson = { ...settings!.configJson, periodicMessages: state };
    return result;
  }
  const db = getDb(); if (!db) throw Error("periodic_storage_unavailable");
  return db.transaction(async (tx) => {
    const [creator] = await tx.select().from(creators).where(eq(creators.id, creatorId)).for("update");
    const [settings] = await tx.select().from(creatorModules).where(and(eq(creatorModules.creatorId, creatorId), eq(creatorModules.moduleKey, "streamerbot"))).for("update");
    assertAccess(creator, actor, settings?.status);
    const config = settings.configJson as Record<string, unknown>;
    const state = readPeriodicState(config); const result = fn(state);
    if (mutate) await tx.update(creatorModules).set({ configJson: { ...config, periodicMessages: state }, updatedAt: new Date() }).where(eq(creatorModules.id, settings.id));
    return result;
  });
}
export const getPeriodicMessages = (context: CreatorContext, actor: PeriodicActor) => withState(context, actor, false, periodicView);
export function editPeriodicMessages(context: CreatorContext, actor: PeriodicActor, input: unknown) {
  if (actor.kind === "integration") throw new PeriodicAccessError();
  const edit = periodicEditSchema.parse(input);
  return withState(context, actor, true, (state) => editPeriodicState(state, edit, randomUUID(), Date.now()));
}
export function dispatchPeriodicMessages(context: CreatorContext, input: unknown) {
  const dispatch = periodicDispatchSchema.parse(input);
  return withState(context, { kind: "integration" }, true, (state) => dispatchPeriodicState(state, dispatch, randomUUID(), Date.now()));
}
