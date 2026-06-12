import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { adminEmails, isDemoMode, isProduction } from "@/lib/env";
export { isTrustedAppMutationRequest } from "@/lib/request-origin";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function requireApiSession() {
  const session = await auth();
  if (!session?.user?.email) {
    return null;
  }
  return session;
}

export async function requireLinkedApiSession() {
  const session = await requireApiSession();
  if (!session?.user?.activeViewerId || !session.user.isLinked) {
    return null;
  }
  return session;
}

export async function requireAdminApiSession() {
  const session = await requireApiSession();
  if (!session?.user?.email) {
    return null;
  }
  if (isDemoMode && !isProduction) {
    return session;
  }

  if (!adminEmails.has(session.user.email.toLowerCase())) {
    return null;
  }
  return session;
}
