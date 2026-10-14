export type AuthSmokeResult = {
  providerIds: string[];
  selectedProviderId: string;
  providersUrl: string;
  csrfUrl: string;
  /** Null for credentials: posting would try to sign in, so only the CSRF step is checked. */
  signInUrl: string | null;
  signInStatus: number | null;
  signInRedirectLocation: string | null;
  /** Where the provider will send the user back; it must be registered with the provider. */
  providerRedirectUri: string | null;
};

type ProviderMap = Record<string, { id?: string; name?: string }>;
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const userAgent = "lojinha-auth-smoke/1.0";
const redirectStatuses = [302, 303, 307, 308];

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function assertProviderMap(value: unknown): ProviderMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Auth providers endpoint did not return an object.");
  }

  return value as ProviderMap;
}

/** Turns the Set-Cookie headers of a response into a Cookie header for the next request. */
function cookieHeader(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

export function pickAuthSmokeProvider(providerIds: string[]) {
  if (providerIds.includes("google")) {
    return "google";
  }

  if (providerIds.includes("credentials")) {
    return "credentials";
  }

  const firstProvider = providerIds[0];
  if (!firstProvider) {
    throw new Error("Auth providers endpoint returned no configured providers.");
  }

  return firstProvider;
}

/**
 * Returns why the sign-in start response is unhealthy, or null when it sends
 * the user to the provider. Auth.js answers a broken configuration with a
 * redirect too, to its error page, so a redirect alone proves nothing.
 */
export function signInStartProblem(response: Response, baseUrl: string): string | null {
  const location = response.headers.get("location");
  if (!redirectStatuses.includes(response.status) || !location) {
    return `expected a redirect to the provider, got status ${response.status}`;
  }

  let target: URL;
  try {
    target = new URL(location, baseUrl);
  } catch {
    return `redirect location is not a URL: ${location}`;
  }

  const error = target.searchParams.get("error");
  if (error) {
    return `redirected to an error page (error=${error}) at ${target.origin}${target.pathname}`;
  }

  if (target.origin === new URL(baseUrl).origin) {
    return `redirected back to the app (${target.pathname}) instead of the provider`;
  }

  return null;
}

export async function runAuthSmokeTest(input: {
  baseUrl: string;
  fetchFn?: FetchLike;
}): Promise<AuthSmokeResult> {
  const fetchFn = input.fetchFn ?? fetch;
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const providersUrl = `${baseUrl}/api/auth/providers`;
  const providersResponse = await fetchFn(providersUrl, {
    headers: {
      accept: "application/json",
      "user-agent": userAgent,
    },
    redirect: "manual",
  });

  if (!providersResponse.ok) {
    throw new Error(`Auth providers endpoint failed with status ${providersResponse.status}.`);
  }

  const providers = assertProviderMap(await providersResponse.json());
  const providerIds = Object.keys(providers);
  const selectedProviderId = pickAuthSmokeProvider(providerIds);

  // Auth.js starts a sign-in only on POST, with the CSRF token and its cookie.
  const csrfUrl = `${baseUrl}/api/auth/csrf`;
  const csrfResponse = await fetchFn(csrfUrl, {
    headers: {
      accept: "application/json",
      "user-agent": userAgent,
    },
    redirect: "manual",
  });

  if (!csrfResponse.ok) {
    throw new Error(`Auth CSRF endpoint failed with status ${csrfResponse.status}.`);
  }

  const csrfToken = ((await csrfResponse.json()) as { csrfToken?: unknown } | null)?.csrfToken;
  const cookie = cookieHeader(csrfResponse);
  if (typeof csrfToken !== "string" || !csrfToken || !cookie) {
    throw new Error("Auth CSRF endpoint did not return a token and its cookie.");
  }

  const result: AuthSmokeResult = {
    providerIds,
    selectedProviderId,
    providersUrl,
    csrfUrl,
    signInUrl: null,
    signInStatus: null,
    signInRedirectLocation: null,
    providerRedirectUri: null,
  };

  if (selectedProviderId === "credentials") {
    return result;
  }

  const signInUrl = `${baseUrl}/api/auth/signin/${encodeURIComponent(selectedProviderId)}`;
  const signInResponse = await fetchFn(signInUrl, {
    method: "POST",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "content-type": "application/x-www-form-urlencoded",
      cookie,
      "user-agent": userAgent,
    },
    body: new URLSearchParams({ csrfToken, callbackUrl: `${baseUrl}/` }).toString(),
    redirect: "manual",
  });

  const problem = signInStartProblem(signInResponse, baseUrl);
  if (problem) {
    throw new Error(`Sign-in start for ${selectedProviderId} failed: ${problem}.`);
  }

  const location = signInResponse.headers.get("location")!;
  return {
    ...result,
    signInUrl,
    signInStatus: signInResponse.status,
    signInRedirectLocation: location,
    providerRedirectUri: new URL(location).searchParams.get("redirect_uri"),
  };
}
