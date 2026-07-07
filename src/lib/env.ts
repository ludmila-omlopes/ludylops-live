import { z } from "zod";

const placeholderDatabaseUrl = "sua-url-do-neon-ou-postgres";

function normalizeDatabaseUrl(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  if (trimmedValue === placeholderDatabaseUrl) {
    throw new Error(
      "[env] DATABASE_URL is still the migration placeholder. " +
        "Clear it from the current terminal session and restart the dev server so Next.js can load the real value from .env.",
    );
  }

  return trimmedValue;
}

const envSchema = z.object({
  DATABASE_URL: z.preprocess(normalizeDatabaseUrl, z.string().url().optional()),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  STREAMERBOT_SHARED_SECRET: z.string().optional(),
  BRIDGE_SHARED_SECRET: z.string().optional(),
  PS_PLUS_SYNC_SECRET: z.string().optional(),
  STEAM_SYNC_SECRET: z.string().optional(),
  STEAM_STORE_COUNTRY_CODE: z.string().optional(),
  STEAM_STORE_LANGUAGE: z.string().optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  STREAM_YOUTUBE_CHANNEL_ID: z.string().optional(),
  IGDB_CLIENT_ID: z.string().optional(),
  IGDB_CLIENT_SECRET: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  PLATFORM_OWNER_EMAILS: z.string().optional(),
  APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_GITHUB_ISSUES_URL: z.string().url().optional(),
  GOOGLE_RISC_ALLOWED_AUDIENCES: z.string().optional(),
  GOOGLE_RISC_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_RISC_SERVICE_ACCOUNT_FILE: z.string().optional(),
  GOOGLE_RISC_RECEIVER_URL: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);
export const isProduction = process.env.NODE_ENV === "production";

function parseEmailSet(value?: string) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const adminEmails = parseEmailSet(env.ADMIN_EMAILS);
export const platformOwnerEmails = parseEmailSet(env.PLATFORM_OWNER_EMAILS ?? env.ADMIN_EMAILS);

export const isDemoMode = !env.DATABASE_URL;
export const isDemoAuthEnabled = isDemoMode;

// Guard against evaluating server-only env validation in the browser: this
// module must never be part of a client bundle, but if it accidentally is
// (e.g. a "use client" component transitively imports it), NEXTAUTH_SECRET is
// absent client-side and this throw would crash the page during hydration.
// The server-side check is the one that matters; keep it scoped to the server.
if (typeof window === "undefined" && isProduction && !env.NEXTAUTH_SECRET) {
  throw new Error(
    "[env] NEXTAUTH_SECRET is required in production. " +
      "Set it in the deployment environment before starting the app.",
  );
}

export const authSecret = env.NEXTAUTH_SECRET ?? "dev-secret";

const missingProductionEnv = [!env.DATABASE_URL ? "DATABASE_URL" : null].filter(
  (entry): entry is string => Boolean(entry),
);

if (isProduction && missingProductionEnv.length > 0) {
  console.warn(
    `[env] Missing production env vars: ${missingProductionEnv.join(", ")}. ` +
      "Falling back to demo-safe behavior so the app can still build and boot.",
  );
}
