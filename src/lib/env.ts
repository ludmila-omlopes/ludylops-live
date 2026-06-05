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

export const adminEmails = new Set(
  (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export const isDemoMode = !env.DATABASE_URL;
export const isDemoAuthEnabled = isDemoMode;
export const authSecret =
  env.NEXTAUTH_SECRET ?? (isProduction ? "pipetz-production-demo-secret" : "dev-secret");

const missingProductionEnv = [
  !env.DATABASE_URL ? "DATABASE_URL" : null,
  !env.NEXTAUTH_SECRET ? "NEXTAUTH_SECRET" : null,
].filter((entry): entry is string => Boolean(entry));

if (isProduction && missingProductionEnv.length > 0) {
  console.warn(
    `[env] Missing production env vars: ${missingProductionEnv.join(", ")}. ` +
      "Falling back to demo-safe behavior so the app can still build and boot.",
  );
}
