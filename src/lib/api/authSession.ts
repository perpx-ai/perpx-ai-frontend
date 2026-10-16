import { BACKEND_URL } from "config/perpx";

/**
 * Auth session store
 *
 * Single source of truth for the backend JWT: cookie persistence, expiry awareness,
 * de-duplicated re-authentication and an authenticated `fetch`.
 *
 * The React layer (AuthContextProvider) registers the actual authenticator — nonce →
 * wallet signature → POST /login — so that plain modules (api clients) can recover an
 * expired session through the *connected* wallet instead of poking `window.ethereum`,
 * and so that concurrent callers can never trigger more than one signature prompt.
 */

export const AUTH_COOKIE_NAME = "authToken";

const COOKIE_TTL_DAYS = 7;
/** Treat a token as expired slightly early so it is never sent right as it lapses. */
const EXPIRY_SKEW_MS = 30 * 1000;


/** Backend messages that mean "this token is no good, sign in again". */
const REAUTH_MESSAGES = ["invalid or expired token", "access token required"];

// ── Cookie helpers ─────────────────────────────────────────────────────────────

const getCookie = (name: string): string | null => {
  const nameEQ = `${name}=`;
  const parts = document.cookie.split(";");
  for (let part of parts) {
    while (part.charAt(0) === " ") part = part.substring(1);
    if (part.indexOf(nameEQ) === 0) return part.substring(nameEQ.length) || null;
  }
  return null;
};

const writeCookie = (name: string, value: string, expiresAt: number) => {
  const isProduction = window.location.protocol === "https:";
  const sameSite = isProduction ? "Strict" : "Lax";
  const secure = isProduction ? ";Secure" : "";

  document.cookie = `${name}=${value};expires=${new Date(expiresAt).toUTCString()};path=/;SameSite=${sameSite}${secure}`;
};

const removeCookie = (name: string) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
};

// ── JWT introspection ──────────────────────────────────────────────────────────

type JwtPayload = { address?: string; exp?: number; role?: string };

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized)) as JwtPayload;
  } catch (error) {
    return null;
  }
}

/** Expiry in ms, or `undefined` when the token carries no readable `exp`. */
export function getTokenExpiry(token: string): number | undefined {
  const exp = decodeJwtPayload(token)?.exp;
  return typeof exp === "number" ? exp * 1000 : undefined;
}

/** Lowercased address the token was issued for, when readable. */
export function getTokenAddress(token: string): string | undefined {
  const address = decodeJwtPayload(token)?.address;
  return typeof address === "string" ? address.toLowerCase() : undefined;
}

export function isTokenExpired(token: string | null | undefined): boolean {
  if (!token) return true;
  const expiry = getTokenExpiry(token);
  // No readable expiry — let the backend be the judge rather than dropping a usable token.
  if (expiry === undefined) return false;
  return expiry - EXPIRY_SKEW_MS <= Date.now();
}

/** True when the token was issued for `address` (unknown claims count as a match). */
export function isTokenForAddress(token: string | null | undefined, address: string | undefined): boolean {
  if (!token || !address) return false;
  const tokenAddress = getTokenAddress(token);
  return tokenAddress === undefined || tokenAddress === address.toLowerCase();
}

// ── Token store ────────────────────────────────────────────────────────────────

type Listener = (token: string | null) => void;

const listeners = new Set<Listener>();

const emit = (token: string | null) => {
  for (const listener of listeners) {
    try {
      listener(token);
    } catch (error) {
      console.error("authSession: listener failed", error);
    }
  }
};

/** Subscribe to token changes made anywhere in the app. Returns an unsubscribe fn. */
export function subscribeAuthToken(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The stored token, or null when absent or expired (expired tokens are purged). */
export function getStoredAuthToken(): string | null {
  const token = getCookie(AUTH_COOKIE_NAME);
  if (!token) return null;

  if (isTokenExpired(token)) {
    removeCookie(AUTH_COOKIE_NAME);
    emit(null);
    return null;
  }

  return token;
}

export function storeAuthToken(token: string): void {
  const expiry = getTokenExpiry(token) ?? Date.now() + COOKIE_TTL_DAYS * 24 * 60 * 60 * 1000;
  writeCookie(AUTH_COOKIE_NAME, token, expiry);
  emit(token);
}

export function clearAuthToken(): void {
  removeCookie(AUTH_COOKIE_NAME);
  emit(null);
}

// ── De-duplicated re-authentication ────────────────────────────────────────────

type Authenticator = () => Promise<string | null>;

let authenticator: Authenticator | null = null;
let inFlight: Promise<string | null> | null = null;

/** Registered by AuthContextProvider; runs nonce → signature → login. */
export function setAuthenticator(fn: Authenticator | null): void {
  authenticator = fn;
}

/** True while a signature/login round-trip is already running. */
export function isAuthenticationInFlight(): boolean {
  return inFlight !== null;
}

/**
 * Resolve a usable token, authenticating through the connected wallet if needed.
 * Concurrent calls share one attempt, so the user sees at most one signature prompt.
 * Resolves to null when no wallet is available to sign.
 */
export function ensureAuthToken(options: { forceReauth?: boolean } = {}): Promise<string | null> {
  if (!options.forceReauth) {
    const existing = getStoredAuthToken();
    if (existing) return Promise.resolve(existing);
  }

  if (inFlight) return inFlight;

  const fn = authenticator;
  if (!fn) return Promise.resolve(null);

  const settle = () => {
    if (inFlight === promise) inFlight = null;
  };

  const promise: Promise<string | null> = fn().then(
    (token) => {
      settle();
      return token;
    },
    (error) => {
      settle();
      throw error;
    }
  );

  inFlight = promise;

  return promise;
}

// ── Authenticated fetch ────────────────────────────────────────────────────────

const withAuth = (options: RequestInit, token: string | null): RequestInit => ({
  ...options,
  headers: token ? { ...options.headers, Authorization: `Bearer ${token}` } : { ...options.headers },
});

const isReauthRejection = async (response: Response): Promise<boolean> => {
  if (response.status !== 401 && response.status !== 403) return false;

  // Read a clone so the caller still gets an unconsumed body.
  const data = await response
    .clone()
    .json()
    .catch(() => null);
  const message = typeof data?.message === "string" ? data.message.toLowerCase() : "";

  // Unreadable body: assume the token was the problem. A known message decides the rest,
  // so genuine authorization errors ("Admin privileges required") never prompt a signature.
  if (!message) return true;
  return REAUTH_MESSAGES.some((known) => message.includes(known));
};

/** Network failures surface a cause the caller can show, instead of a bare undefined. */
const asRequestError = (error: unknown): Error =>
  error instanceof TypeError
    ? new Error("Could not reach the PerpX server. Check your connection and try again.")
    : error instanceof Error
      ? error
      : new Error(String(error));

/**
 * `fetch` with the session token attached, recovering once from a rejected token.
 * Throws when the request itself cannot be made.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
  { allowReauth = true }: { allowReauth?: boolean } = {}
): Promise<Response> {
  let token = getStoredAuthToken();

  if (!token && allowReauth) {
    token = await ensureAuthToken().catch((error) => {
      console.error("authSession: authentication failed", error);
      return null;
    });
  }

  let response: Response;
  try {
    response = await fetch(url, withAuth(options, token));
  } catch (error) {
    console.error("authSession: request failed", error);
    throw asRequestError(error);
  }

  if (!allowReauth || !(await isReauthRejection(response))) {
    return response;
  }

  // The token is dead — drop it so `ensureAuthToken` cannot hand it back, then retry once.
  clearAuthToken();

  const freshToken = await ensureAuthToken({ forceReauth: true }).catch((error) => {
    console.error("authSession: re-authentication failed", error);
    return null;
  });

  if (!freshToken) return response;

  try {
    return await fetch(url, withAuth(options, freshToken));
  } catch (error) {
    console.error("authSession: retry failed", error);
    throw asRequestError(error);
  }
}

// ── Backend endpoints ──────────────────────────────────────────────────────────

export const AUTH_API_BASE_URL = `${BACKEND_URL}/api/admin/auth`;

export type VerifyResult =
  | { state: "valid"; user: { address: string; hasWallet?: boolean } }
  | { state: "invalid" }
  /** Server or network hiccup — the session must be left alone. */
  | { state: "unknown" };

/**
 * Ask the backend whether a token is still good.
 * Only an explicit 401/403 invalidates a session; everything else is inconclusive.
 */
export async function verifyAuthToken(token: string): Promise<VerifyResult> {
  try {
    const response = await fetch(`${AUTH_API_BASE_URL}/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = await response.json().catch(() => null);
      const user = data?.data?.user;
      if (user?.address) return { state: "valid", user };
      return { state: "unknown" };
    }

    if (response.status === 401 || response.status === 403) {
      return { state: "invalid" };
    }

    return { state: "unknown" };
  } catch (error) {
    console.debug("authSession: verify unreachable", error);
    return { state: "unknown" };
  }
}
