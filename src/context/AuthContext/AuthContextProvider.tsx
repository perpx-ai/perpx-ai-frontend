import { ethers } from "ethers";
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";

import { fetchLoginMessage } from "lib/api/auth";
import {
  AUTH_API_BASE_URL,
  authenticatedFetch,
  clearAuthToken,
  ensureAuthToken,
  getStoredAuthToken,
  isTokenForAddress,
  setAuthenticator,
  storeAuthToken,
  subscribeAuthToken,
  verifyAuthToken,
} from "lib/api/authSession";

export interface AuthUser {
  address: string;
  hasWallet: boolean;
}

export interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  token: string | null;
  login: (address: string, signature: string) => Promise<void>;
  logout: () => void;
  checkAuthStatus: () => Promise<void>;
  /**
   * Resolve a usable session token, prompting for a signature when the session is
   * missing or expired. Concurrent callers share a single prompt. Returns null when
   * no wallet is connected or the user declines.
   */
  ensureAuthenticated: () => Promise<string | null>;
  makeAuthenticatedRequest: (url: string, options?: RequestInit) => Promise<Response | undefined>;
}

const context = createContext<AuthContextType | null>(null);

/** Backend replies that mean the nonce we signed is no longer usable. */
const STALE_NONCE_MESSAGES = ["no active login request", "login request expired"];

/** Automatic prompts are bounded so a declined signature cannot become a prompt loop. */
const MAX_AUTO_AUTH_FAILURES = 3;
const AUTO_AUTH_COOLDOWN_MS = 30 * 1000;
/** Small delay so the wallet provider is ready before we ask it to sign. */
const AUTO_AUTH_DELAY_MS = 800;
/** Focus fires often; don't re-verify the session on every alt-tab. */
const VERIFY_THROTTLE_MS = 60 * 1000;

const isStaleNonceError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return STALE_NONCE_MESSAGES.some((known) => message.includes(known));
};

const isUserRejection = (error: any): boolean => {
  if (!error) return false;
  if (error.code === 4001 || error.code === "ACTION_REJECTED") return true;
  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
  return message.includes("user rejected") || message.includes("user denied");
};

export function AuthContextProvider({ children }: PropsWithChildren) {
  const { address: walletAddress, status: accountStatus, connector } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [token, setToken] = useState<string | null>(() => getStoredAuthToken());

  const isWalletConnected = accountStatus === "connected" && Boolean(walletAddress);

  /** Tracks automatic prompts per address so failures retry without spamming. */
  const autoAuthRef = useRef<{ address: string; failures: number; lastAttemptAt: number } | null>(null);
  const lastVerifyAtRef = useRef(0);

  // Mirror token changes made outside React (api clients recovering an expired session).
  useEffect(() => subscribeAuthToken((next) => setToken(next)), []);

  const signMessage = useCallback(
    async (message: string, address: string): Promise<string> => {
      // wagmi's walletClient always points at the active wallet; the fallbacks cover
      // connectors whose client has not resolved yet (Trust Wallet, WalletConnect).
      if (walletClient) {
        return walletClient.signMessage({ message, account: address as `0x${string}` });
      }

      if (connector) {
        const connectorProvider = await connector.getProvider();
        if (connectorProvider) {
          const provider = new ethers.BrowserProvider(connectorProvider as any);
          const signer = await provider.getSigner();
          return signer.signMessage(message);
        }
      }

      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        return signer.signMessage(message);
      }

      throw new Error("No wallet provider found");
    },
    [walletClient, connector]
  );

  const clearSession = useCallback(() => {
    clearAuthToken();
    setToken(null);
    setUser(null);
  }, []);

  /** POST /login — returns the issued token. */
  const submitLogin = useCallback(async (address: string, signature: string): Promise<string> => {
    const response = await fetch(`${AUTH_API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, signature }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.status || !data?.data?.token) {
      throw new Error(data?.message || "Login failed");
    }

    storeAuthToken(data.data.token);
    setToken(data.data.token);
    setUser({
      address: data.data.user?.address ?? address,
      hasWallet: Boolean(data.data.user?.hasWallet),
    });

    return data.data.token as string;
  }, []);

  const login = useCallback(
    async (address: string, signature: string) => {
      setIsAuthenticating(true);
      try {
        await submitLogin(address, signature);
      } finally {
        setIsAuthenticating(false);
      }
    },
    [submitLogin]
  );

  /**
   * Full sign-in round trip. The nonce is single-use and lapses after five minutes, so a
   * signature approved late is worthless — fetch a fresh nonce and sign again once.
   */
  const runAuthentication = useCallback(
    async (address: string): Promise<string> => {
      const attempt = async () => {
        const message = await fetchLoginMessage(address);
        const signature = await signMessage(message, address);
        return submitLogin(address, signature);
      };

      try {
        return await attempt();
      } catch (error) {
        if (isStaleNonceError(error)) {
          console.debug("AuthContext: login nonce lapsed, retrying with a fresh one");
          return attempt();
        }
        throw error;
      }
    },
    [signMessage, submitLogin]
  );

  // Register the authenticator so non-React api clients recover the session through the
  // connected wallet, sharing this provider's single-flight prompt.
  const runAuthenticationRef = useRef(runAuthentication);
  runAuthenticationRef.current = runAuthentication;

  const walletAddressRef = useRef(walletAddress);
  walletAddressRef.current = walletAddress;

  useEffect(() => {
    setAuthenticator(async () => {
      const address = walletAddressRef.current;
      if (!address) return null;

      setIsAuthenticating(true);
      try {
        return await runAuthenticationRef.current(address);
      } finally {
        setIsAuthenticating(false);
      }
    });

    return () => setAuthenticator(null);
  }, []);

  const ensureAuthenticated = useCallback(async (): Promise<string | null> => {
    const existing = getStoredAuthToken();
    if (existing && isTokenForAddress(existing, walletAddress)) return existing;
    if (existing) clearSession();
    if (!walletAddress) return null;

    return ensureAuthToken({ forceReauth: true });
  }, [walletAddress, clearSession]);

  /** Validate the stored session against the backend without discarding it on a hiccup. */
  const checkAuthStatus = useCallback(async () => {
    const storedToken = getStoredAuthToken();
    if (!storedToken) {
      setUser(null);
      setToken(null);
      return;
    }

    const result = await verifyAuthToken(storedToken);

    if (result.state === "valid") {
      setUser({ address: result.user.address, hasWallet: Boolean(result.user.hasWallet) });
      setToken(storedToken);
    } else if (result.state === "invalid") {
      console.log("AuthContext: stored session rejected by backend, clearing it");
      clearSession();
    }
    // "unknown" (offline, 5xx): keep the session — a network blip must not sign the user out.
  }, [clearSession]);

  const logout = useCallback(() => {
    clearSession();
    autoAuthRef.current = null;
  }, [clearSession]);

  const makeAuthenticatedRequest = useCallback(
    (url: string, options: RequestInit = {}) => authenticatedFetch(url, options),
    []
  );

  // ── Automatic sign-in ────────────────────────────────────────────────────────
  const attemptAutoAuth = useCallback(
    async (address: string) => {
      const state = autoAuthRef.current;

      if (state?.address === address) {
        if (state.failures >= MAX_AUTO_AUTH_FAILURES) return;
        if (Date.now() - state.lastAttemptAt < AUTO_AUTH_COOLDOWN_MS) return;
      }

      autoAuthRef.current = {
        address,
        failures: state?.address === address ? state.failures : 0,
        lastAttemptAt: Date.now(),
      };

      try {
        await ensureAuthToken();
        autoAuthRef.current = { address, failures: 0, lastAttemptAt: Date.now() };
      } catch (error) {
        const failures = (autoAuthRef.current?.failures ?? 0) + 1;
        autoAuthRef.current = { address, failures, lastAttemptAt: Date.now() };
        if (isUserRejection(error)) {
          console.log("AuthContext: sign-in declined; will prompt again on the next action");
        } else {
          console.error("AuthContext: automatic sign-in failed", error);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!isWalletConnected || !walletAddress) return;
    if (!walletClient && !connector) return; // wait for a provider that can sign
    if (getStoredAuthToken()) return;

    const timeoutId = setTimeout(() => attemptAutoAuth(walletAddress), AUTO_AUTH_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, [isWalletConnected, walletAddress, walletClient, connector, token, attemptAutoAuth]);

  // ── Keep session and wallet in agreement ─────────────────────────────────────
  useEffect(() => {
    if (accountStatus === "disconnected") {
      // The wallet is gone (locked, revoked, disconnected). Keep the token — it is still
      // valid for this address — but let a reconnect prompt again if it turns out stale.
      autoAuthRef.current = null;
      return;
    }

    if (!walletAddress) return;

    const storedToken = getStoredAuthToken();
    const isForeignToken = storedToken && !isTokenForAddress(storedToken, walletAddress);
    const isForeignUser = user && user.address.toLowerCase() !== walletAddress.toLowerCase();

    if (isForeignToken || isForeignUser) {
      console.log("AuthContext: wallet address changed, clearing the previous session");
      clearSession();
      autoAuthRef.current = null;
    }
  }, [accountStatus, walletAddress, user, clearSession]);

  // Validate the session on load.
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  /**
   * Re-validate whenever the tab comes back into focus. Idling is exactly when a session
   * goes stale (wallet auto-lock, an unsigned prompt left open, a token revoked
   * server-side); catching it here stops the UI from claiming to be signed in.
   */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!isWalletConnected || !walletAddress) return;

      const storedToken = getStoredAuthToken();

      if (!storedToken) {
        setToken(null);
        attemptAutoAuth(walletAddress);
        return;
      }

      if (Date.now() - lastVerifyAtRef.current < VERIFY_THROTTLE_MS) return;
      lastVerifyAtRef.current = Date.now();

      verifyAuthToken(storedToken).then((result) => {
        if (result.state !== "invalid") return;
        clearSession();
        autoAuthRef.current = null;
        attemptAutoAuth(walletAddress);
      });
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [isWalletConnected, walletAddress, clearSession, attemptAutoAuth]);

  /**
   * Authenticated only when a live wallet backs the token — otherwise the UI would show a
   * signed-in account the app cannot actually trade with.
   */
  const isAuthenticated = Boolean(token) && isWalletConnected && isTokenForAddress(token, walletAddress);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      isAuthenticating,
      token,
      login,
      logout,
      checkAuthStatus,
      ensureAuthenticated,
      makeAuthenticatedRequest,
    }),
    [
      user,
      isAuthenticated,
      isAuthenticating,
      token,
      login,
      logout,
      checkAuthStatus,
      ensureAuthenticated,
      makeAuthenticatedRequest,
    ]
  );

  return <context.Provider value={value}>{children}</context.Provider>;
}

export const useAuth = () => {
  const authContext = useContext(context);
  if (!authContext) {
    throw new Error("useAuth must be used within an AuthContextProvider");
  }
  return authContext;
};
