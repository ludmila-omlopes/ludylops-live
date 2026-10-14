import { runAuthSmokeTest } from "../src/lib/auth/smoke";

function resolveBaseUrl() {
  const [, , cliBaseUrl] = process.argv;
  const baseUrl =
    cliBaseUrl ??
    process.env.AUTH_SMOKE_BASE_URL ??
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL;

  if (!baseUrl) {
    throw new Error(
      "Provide the deployed base URL as the first argument or set AUTH_SMOKE_BASE_URL, APP_URL, or NEXT_PUBLIC_APP_URL.",
    );
  }

  return baseUrl;
}

async function main() {
  const result = await runAuthSmokeTest({
    baseUrl: resolveBaseUrl(),
  });

  console.log(`[auth-smoke] Providers OK: ${result.providerIds.join(", ")}`);
  console.log(`[auth-smoke] Selected provider: ${result.selectedProviderId}`);
  console.log(`[auth-smoke] Providers URL: ${result.providersUrl}`);
  console.log(`[auth-smoke] CSRF OK: ${result.csrfUrl}`);

  if (!result.signInUrl || !result.signInRedirectLocation) {
    console.log("[auth-smoke] Sign-in start skipped for credentials: posting would try to sign in.");
    return;
  }

  // The full location carries state and PKCE values; the provider endpoint is enough.
  const provider = new URL(result.signInRedirectLocation);
  console.log(`[auth-smoke] Sign-in URL: ${result.signInUrl}`);
  console.log(`[auth-smoke] Sign-in status: ${result.signInStatus}`);
  console.log(`[auth-smoke] Provider: ${provider.origin}${provider.pathname}`);

  if (result.providerRedirectUri) {
    console.log(`[auth-smoke] Provider redirect URI: ${result.providerRedirectUri}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[auth-smoke] FAILED: ${message}`);
  process.exitCode = 1;
});
