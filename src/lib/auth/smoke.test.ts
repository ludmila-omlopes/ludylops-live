import { describe, expect, it } from "vitest";

import {
  pickAuthSmokeProvider,
  runAuthSmokeTest,
  signInStartProblem,
} from "@/lib/auth/smoke";

function createResponse(input: {
  status: number;
  body?: unknown;
  headers?: HeadersInit;
}) {
  return new Response(
    input.body === undefined ? null : JSON.stringify(input.body),
    {
      status: input.status,
      headers: input.headers,
    },
  );
}

const baseUrl = "https://ludylops.live";
const googleAuthorize =
  "https://accounts.google.com/o/oauth2/v2/auth?client_id=abc&redirect_uri=https%3A%2F%2Fludylops.live%2Fapi%2Fauth%2Fcallback%2Fgoogle&state=xyz";
const redirectTo = (location: string, status = 302) => createResponse({ status, headers: { location } });

type Call = { url: string; method: string; cookie: string | null; body: string | null };

/** Answers like Auth.js: providers, the CSRF token with its cookies, then the sign-in start. */
function authServer(input: {
  providers?: Record<string, { id: string; name: string }>;
  csrf?: Response;
  signIn?: Response;
}) {
  const calls: Call[] = [];
  const fetchFn = async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({ url, method: init?.method ?? "GET", cookie: headers.get("cookie"), body: typeof init?.body === "string" ? init.body : null });
    if (url.endsWith("/api/auth/providers")) {
      return createResponse({
        status: 200,
        body: input.providers ?? { google: { id: "google", name: "Google" }, credentials: { id: "credentials", name: "Demo" } },
      });
    }
    if (url.endsWith("/api/auth/csrf")) {
      return input.csrf ?? createResponse({
        status: 200,
        body: { csrfToken: "token-123" },
        headers: [
          ["set-cookie", "__Host-authjs.csrf-token=token-123%7Chash; Path=/; HttpOnly; Secure; SameSite=Lax"],
          ["set-cookie", "__Secure-authjs.callback-url=https%3A%2F%2Fludylops.live; Path=/; HttpOnly; Secure; SameSite=Lax"],
        ],
      });
    }
    return input.signIn ?? redirectTo(googleAuthorize);
  };
  return { calls, fetchFn };
}

describe("pickAuthSmokeProvider", () => {
  it("prefers google when it is available", () => {
    expect(pickAuthSmokeProvider(["credentials", "google"])).toBe("google");
  });

  it("falls back to credentials when google is absent", () => {
    expect(pickAuthSmokeProvider(["credentials"])).toBe("credentials");
  });
});

describe("signInStartProblem", () => {
  it("accepts a redirect to the provider", () => {
    expect(signInStartProblem(redirectTo(googleAuthorize), baseUrl)).toBeNull();
    expect(signInStartProblem(redirectTo(googleAuthorize, 303), baseUrl)).toBeNull();
  });

  it("rejects the redirect Auth.js sends when the configuration is broken", () => {
    expect(signInStartProblem(redirectTo(`${baseUrl}/api/auth/error?error=Configuration`), baseUrl))
      .toBe("redirected to an error page (error=Configuration) at https://ludylops.live/api/auth/error");
    expect(signInStartProblem(redirectTo("/api/auth/error?error=AccessDenied"), baseUrl))
      .toBe("redirected to an error page (error=AccessDenied) at https://ludylops.live/api/auth/error");
  });

  it("rejects a redirect back to the app and a response without a redirect", () => {
    expect(signInStartProblem(redirectTo(`${baseUrl}/?callbackUrl=%2F`), baseUrl))
      .toBe("redirected back to the app (/) instead of the provider");
    expect(signInStartProblem(createResponse({ status: 200 }), baseUrl))
      .toBe("expected a redirect to the provider, got status 200");
    expect(signInStartProblem(createResponse({ status: 302 }), baseUrl))
      .toBe("expected a redirect to the provider, got status 302");
  });
});

describe("runAuthSmokeTest", () => {
  it("starts the sign-in like the browser does: CSRF token, then a POST with its cookie", async () => {
    const { calls, fetchFn } = authServer({});

    const result = await runAuthSmokeTest({ baseUrl: `${baseUrl}/`, fetchFn });

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "GET https://ludylops.live/api/auth/providers",
      "GET https://ludylops.live/api/auth/csrf",
      "POST https://ludylops.live/api/auth/signin/google",
    ]);
    expect(calls[2]!.cookie).toBe("__Host-authjs.csrf-token=token-123%7Chash; __Secure-authjs.callback-url=https%3A%2F%2Fludylops.live");
    expect(Object.fromEntries(new URLSearchParams(calls[2]!.body!))).toEqual({ csrfToken: "token-123", callbackUrl: "https://ludylops.live/" });
    expect(result).toMatchObject({
      selectedProviderId: "google",
      csrfUrl: "https://ludylops.live/api/auth/csrf",
      signInUrl: "https://ludylops.live/api/auth/signin/google",
      signInStatus: 302,
      providerRedirectUri: "https://ludylops.live/api/auth/callback/google",
    });
  });

  it("fails when the sign-in start lands on the configuration error page", async () => {
    const { fetchFn } = authServer({ signIn: redirectTo(`${baseUrl}/api/auth/error?error=Configuration`) });

    await expect(runAuthSmokeTest({ baseUrl, fetchFn })).rejects.toThrow(
      "Sign-in start for google failed: redirected to an error page (error=Configuration) at https://ludylops.live/api/auth/error.",
    );
  });

  it("fails without a CSRF token or its cookie", async () => {
    for (const csrf of [
      createResponse({ status: 500 }),
      createResponse({ status: 200, body: { csrfToken: "token-123" } }),
      createResponse({ status: 200, body: {}, headers: { "set-cookie": "__Host-authjs.csrf-token=x; Path=/" } }),
    ]) {
      await expect(runAuthSmokeTest({ baseUrl, fetchFn: authServer({ csrf }).fetchFn })).rejects.toThrow(/CSRF endpoint/);
    }
  });

  it("checks only the CSRF step for credentials, without trying to sign in", async () => {
    const { calls, fetchFn } = authServer({ providers: { credentials: { id: "credentials", name: "Demo" } } });

    const result = await runAuthSmokeTest({ baseUrl, fetchFn });

    expect(calls.map((call) => call.method)).toEqual(["GET", "GET"]);
    expect(result).toMatchObject({ selectedProviderId: "credentials", signInUrl: null, signInStatus: null, providerRedirectUri: null });
  });

  it("fails when no providers are configured", async () => {
    const { fetchFn } = authServer({ providers: {} });

    await expect(runAuthSmokeTest({ baseUrl, fetchFn })).rejects.toThrow("no configured providers");
  });
});
