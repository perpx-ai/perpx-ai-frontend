import { BACKEND_URL } from "config/perpx";

/**
 * User Contact API Client
 *
 * Wraps the wallet-authenticated `/api/user-contact` endpoints. The wallet
 * address is taken from the JWT server-side, so it is never sent in the body.
 */

const USER_CONTACT_URL = `${BACKEND_URL}/api/user-contact`;

export interface UserContact {
  address: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

/** Matches `makeAuthenticatedRequest` from the auth context. */
export type AuthenticatedFetch = (url: string, options?: RequestInit) => Promise<Response | undefined>;

async function readMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  return body?.message || fallback;
}

/**
 * Whether `address` has already registered.
 *
 * Public on purpose: it answers as soon as a wallet connects, so the gate never
 * asks for a signature just to find out the visitor registered weeks ago. It
 * carries the flag alone — name and email need `fetchMyUserContact`.
 *
 * Replies `{ data: { address, registered } }`; the flag is named `registered`,
 * not `isRegistered`.
 */
export async function checkUserContactRegistration(address: string): Promise<boolean> {
  const response = await fetch(`${USER_CONTACT_URL}/check/${address}`);

  if (!response.ok) {
    throw new Error(await readMessage(response, "Failed to check your registration"));
  }

  const body = await response.json();
  return Boolean(body?.data?.registered);
}

/**
 * The caller's saved contact row, or null when they have not registered yet.
 */
export async function fetchMyUserContact(authenticatedFetch: AuthenticatedFetch): Promise<UserContact | null> {
  const response = await authenticatedFetch(`${USER_CONTACT_URL}/me`);

  if (!response) {
    throw new Error("Could not reach the server");
  }
  if (!response.ok) {
    throw new Error(await readMessage(response, "Failed to load your registration"));
  }

  const body = await response.json();
  return (body?.data as UserContact | null) ?? null;
}

/**
 * Saves the caller's name and email. Submitting again from the same wallet
 * updates the existing row rather than adding another.
 */
export async function submitUserContact(
  authenticatedFetch: AuthenticatedFetch,
  { name, email }: { name: string; email: string }
): Promise<UserContact> {
  const response = await authenticatedFetch(USER_CONTACT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email }),
  });

  if (!response) {
    throw new Error("Could not reach the server");
  }
  if (!response.ok) {
    throw new Error(await readMessage(response, "Registration failed"));
  }

  const body = await response.json();
  return body.data as UserContact;
}

/** Trading stats joined onto a registration. Zeroed for a wallet that never traded. */
export interface CompetitionLeaderboardStats {
  /** Lifetime traded volume in USD. A string because the backend stores it as one. */
  totalVolume: string;
  /** Volume traded in the current UTC day, in USD. */
  todayVolume: number;
  pnl: string;
  noOfTrades: number;
}

export interface CompetitionLeaderboardItem {
  name: string;
  /**
   * Present in the payload, but deliberately not carried into the UI — the
   * standings are a public-facing page and an email is the one field on a
   * registration that must not be rendered on one.
   */
  email?: string;
  address: string;
  registeredAt: string;
  stats: CompetitionLeaderboardStats;
}

export interface CompetitionLeaderboardPage {
  items: CompetitionLeaderboardItem[];
  /**
   * The window the stats were computed over, echoed back by the endpoint. Both
   * ends are null when no range was asked for, which means lifetime totals.
   */
  period: { fromDate: string | null; toDate: string | null };
  pagination: { total: number; page: number; pages: number };
}

/**
 * One page of `GET /api/user-contact/leaderboard`: registered users joined with
 * their trading stats, newest registration first.
 *
 * The endpoint returns registration order, not a ranking, and no totals — so
 * whoever needs a leaderboard reads every page and ranks them; see
 * `useCompetitionLeaderboard`.
 *
 * A plain `fetch`, deliberately. The route is public, and going through the
 * auth context would prompt a visitor with no stored token to sign a message
 * just to read the standings.
 */
export async function fetchCompetitionLeaderboardPage({
  page = 1,
  limit = 100,
  search,
  fromDate,
  toDate,
  signal,
}: {
  page?: number;
  limit?: number;
  search?: string;
  /**
   * ISO 8601 with an offset, e.g. `2026-09-18T18:00:00+05:30`. Given either
   * bound, the endpoint recomputes volume, pnl and trade count from the fills
   * in that window instead of returning lifetime totals. `URLSearchParams`
   * percent-encodes the `+`, which a raw string in a URL would otherwise
   * deliver as a space.
   */
  fromDate?: string;
  toDate?: string;
  signal?: AbortSignal;
} = {}): Promise<CompetitionLeaderboardPage> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search?.trim()) {
    params.set("search", search.trim());
  }
  if (fromDate) {
    params.set("fromDate", fromDate);
  }
  if (toDate) {
    params.set("toDate", toDate);
  }

  const response = await fetch(`${USER_CONTACT_URL}/leaderboard?${params}`, { signal });

  if (!response.ok) {
    throw new Error(await readMessage(response, "Failed to load the standings"));
  }

  const body = await response.json();

  return {
    items: body?.data?.items ?? [],
    period: body?.data?.period ?? { fromDate: null, toDate: null },
    pagination: body?.data?.pagination ?? { total: 0, page: 1, pages: 1 },
  };
}
