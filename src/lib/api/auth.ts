/**
 * Authentication API Client
 *
 * Client functions for the backend JWT authentication system (wallet signature based).
 * Token storage, de-duplicated re-authentication and the authenticated `fetch` all live
 * in `authSession` so that this module and AuthContextProvider share one session and one
 * signature prompt.
 */

import {
  AUTH_API_BASE_URL,
  authenticatedFetch,
  clearAuthToken,
  getStoredAuthToken,
  verifyAuthToken,
} from "./authSession";

/**
 * Login request parameters
 */
export interface LoginParams {
  address: string;
  signature: string;
}

/**
 * Login response
 */
export interface LoginResponse {
  status: true;
  message: string;
  data: {
    token: string;
    user: {
      address: string;
      hasWallet: boolean;
    };
  };
}

/**
 * Token verification response
 */
export interface VerifyResponse {
  status: true;
  message: string;
  data: {
    user: {
      address: string;
    };
  };
}

/**
 * Error response
 */
export interface AuthErrorResponse {
  status: false;
  message: string;
}

/**
 * Fetch a server-issued, single-use signing message for the given address.
 * The nonce is valid for 5 minutes. Always call this immediately before signing.
 */
export async function fetchLoginMessage(address: string): Promise<string> {
  const res = await fetch(`${AUTH_API_BASE_URL}/nonce?address=${encodeURIComponent(address.toLowerCase())}`);
  if (!res.ok) throw new Error("Failed to fetch login nonce");
  const data = await res.json();
  if (!data.status || !data.data?.message) throw new Error("Invalid nonce response");
  return data.data.message as string;
}

/**
 * Authenticated request utility
 *
 * Attaches the session token and, when the backend rejects it, re-authenticates through
 * the *connected* wallet (MetaMask, Trust Wallet, WalletConnect — not just
 * `window.ethereum`) and retries the request once.
 *
 * Network failures are thrown rather than swallowed: returning undefined made every
 * caller report a generic "Failed to withdraw ETH"-style message and hid the real cause
 * (blocked request, dropped connection, proxy timeout).
 */
export const makeAuthenticatedRequest = async (
  url: string,
  options: RequestInit = {}
): Promise<Response | undefined> => {
  return authenticatedFetch(url, options);
};

/**
 * Check authentication status.
 *
 * Only an explicit rejection from the backend clears the stored session — a network or
 * server hiccup leaves it intact so the user is not signed out by a blip.
 */
export const checkAuthStatus = async (): Promise<{ user: any; isAuthenticated: boolean } | null> => {
  const token = getStoredAuthToken();
  if (!token) return null;

  const result = await verifyAuthToken(token);

  if (result.state === "valid") {
    return { user: result.user, isAuthenticated: true };
  }

  if (result.state === "invalid") {
    clearAuthToken();
  }

  return null;
};
