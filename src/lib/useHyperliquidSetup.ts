import { useCallback, useEffect, useState } from "react";
import { useAuth } from "context/AuthContext/AuthContextProvider";
import { checkHlApiKey, setupHlAgent } from "./api/hyperliquid";
import useWallet from "./wallets/useWallet";

export type HlSetupStatus = "idle" | "checking" | "setting-up" | "ready" | "error";

export function useHyperliquidSetup() {
  const { account } = useWallet();
  const { token, ensureAuthenticated } = useAuth();
  const [status, setStatus] = useState<HlSetupStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [agentAddress, setAgentAddress] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!account) return;
    setStatus("checking");
    setError(null);
    try {
      const hasKey = await checkHlApiKey(account);
      setStatus(hasKey ? "ready" : "idle");
    } catch (err: any) {
      setStatus("error");
      setError(err.message ?? "Failed to check Hyperliquid setup");
    }
  }, [account]);

  /**
   * Create (or confirm) the Hyperliquid agent wallet.
   *
   * Throws on failure — callers act on the result immediately, and a silently-set error
   * state used to let a trade proceed as if setup had succeeded.
   * `sessionToken` lets a caller pass a token it just obtained, since this hook's `token`
   * is only refreshed on the next render.
   */
  const setup = useCallback(
    async (sessionToken?: string) => {
      if (!account) {
        setStatus("error");
        setError("Connect your wallet to continue");
        throw new Error("Connect your wallet to continue");
      }

      const authToken = sessionToken ?? token ?? (await ensureAuthenticated());

      if (!authToken) {
        setStatus("error");
        setError("Sign in with your wallet to continue");
        throw new Error("Sign in with your wallet to continue");
      }

      setStatus("setting-up");
      setError(null);
      try {
        const result = await setupHlAgent(authToken);
        setAgentAddress(result.agentWalletAddress);
        setStatus("ready");
        return result;
      } catch (err: any) {
        setStatus("error");
        setError(err.message ?? "Hyperliquid setup failed");
        throw err;
      }
    },
    [account, token, ensureAuthenticated]
  );

  /**
   * Re-check as soon as a wallet is present. The check only needs the address, so a
   * lapsed session no longer wipes a known-good "ready" state (which would have made the
   * next trade run agent setup all over again).
   */
  useEffect(() => {
    if (account) {
      check();
    } else {
      setStatus("idle");
      setAgentAddress(null);
    }
  }, [account, check]);

  return {
    status,
    isReady: status === "ready",
    isLoading: status === "checking" || status === "setting-up",
    error,
    agentAddress,
    setup,
    refetch: check,
  };
}
