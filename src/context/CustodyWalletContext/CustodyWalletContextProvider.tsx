import React, { createContext, useContext, useEffect, useState } from "react";
import { getCustodyWallet } from "lib/api";
import useWallet from "lib/wallets/useWallet";
import { useAuth } from "context/AuthContext/AuthContextProvider";

export type CustodyWalletState = {
  custodyWalletAddress: string | null;
  userAddress: string | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

const CustodyWalletContext = createContext<CustodyWalletState | undefined>(undefined);

export function useCustodyWallet() {
  const context = useContext(CustodyWalletContext);
  if (!context) {
    throw new Error("useCustodyWallet must be used within CustodyWalletContextProvider");
  }
  return context;
}

export function CustodyWalletContextProvider({ children }: { children: React.ReactNode }) {
  const { account } = useWallet();
  const { isAuthenticated } = useAuth();
  const [custodyWalletAddress, setCustodyWalletAddress] = useState<string | null>(null);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCustodyWallet = async () => {
    if (!account) {
      // No wallet: drop the cached custody wallet too. Trade submission reads these keys
      // directly, so a leftover value would route orders through a wallet that no longer
      // belongs to the current session.
      setCustodyWalletAddress(null);
      setUserAddress(null);
      localStorage.removeItem("custodyWallet");
      localStorage.removeItem("userAddress");
      return;
    }

    if (!isAuthenticated) {
      // Session not established yet (or lapsed while idle). Keep whatever we already have
      // for this address and wait — the auth layer re-establishes it on the next action.
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getCustodyWallet(account);

      if (data?.custodyWalletAddress) {
        setCustodyWalletAddress(data.custodyWalletAddress);
        setUserAddress(data.userAddress);

        // Store in localStorage for backward compatibility
        localStorage.setItem("custodyWallet", data.custodyWalletAddress);
        localStorage.setItem("userAddress", data.userAddress);
      } else {
        // No custody wallet found - clear state and localStorage
        // This allows the app to fall back to using the connected wallet address
        setCustodyWalletAddress(null);
        setUserAddress(null);

        localStorage.removeItem("custodyWallet");
        localStorage.removeItem("userAddress");
      }
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error("Failed to fetch custody wallet");
      setError(errorObj);
      console.error("Error fetching custody wallet:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustodyWallet();
  }, [account, isAuthenticated]);

  const value: CustodyWalletState = {
    custodyWalletAddress,
    userAddress,
    isLoading,
    error,
    refetch: fetchCustodyWallet,
  };

  return <CustodyWalletContext.Provider value={value}>{children}</CustodyWalletContext.Provider>;
}
