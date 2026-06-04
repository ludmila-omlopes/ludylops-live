import { env, isDemoAuthEnabled, isProduction } from "@/lib/env";

export type PublicAuthHealth = {
  ready: boolean;
  status: "ready" | "degraded";
  availableProviders: string[];
  googleOAuthConfigured: boolean;
  googleOAuthCallbackUrls: string[];
  demoAuthEnabled: boolean;
  nextAuthSecretConfigured: boolean;
  usesFallbackSecret: boolean;
  failures: string[];
  warnings: string[];
};

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function getGoogleOAuthCallbackUrls(baseUrls: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      baseUrls
        .filter((value): value is string => Boolean(value))
        .map(normalizeBaseUrl)
        .filter(Boolean)
        .map((baseUrl) => `${baseUrl}/api/auth/callback/google`),
    ),
  );
}

export function getPublicAuthHealth(): PublicAuthHealth {
  const googleOAuthConfigured = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
  const googleOAuthPartialConfig = Boolean(env.AUTH_GOOGLE_ID || env.AUTH_GOOGLE_SECRET) && !googleOAuthConfigured;
  const nextAuthSecretConfigured = Boolean(env.NEXTAUTH_SECRET);
  const googleOAuthCallbackUrls = getGoogleOAuthCallbackUrls([env.APP_URL, env.NEXT_PUBLIC_APP_URL]);
  const availableProviders = [
    ...(googleOAuthConfigured ? ["google"] : []),
    ...(isDemoAuthEnabled ? ["credentials"] : []),
  ];

  const failures = [
    ...(googleOAuthPartialConfig ? ["google_oauth_partial_config"] : []),
    ...(availableProviders.length === 0 ? ["no_auth_provider_configured"] : []),
  ];
  const warnings = [
    ...(isProduction && !nextAuthSecretConfigured ? ["nextauth_secret_missing_using_fallback"] : []),
  ];

  return {
    ready: failures.length === 0,
    status: failures.length === 0 ? "ready" : "degraded",
    availableProviders,
    googleOAuthConfigured,
    googleOAuthCallbackUrls,
    demoAuthEnabled: isDemoAuthEnabled,
    nextAuthSecretConfigured,
    usesFallbackSecret: !nextAuthSecretConfigured,
    failures,
    warnings,
  };
}
