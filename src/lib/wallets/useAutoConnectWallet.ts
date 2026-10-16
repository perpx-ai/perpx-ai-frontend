import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useEffect, useRef } from "react";

import useWallet from "./useWallet";

interface UseAutoConnectWalletOptions {
  /**
   * Whether auto-connect should be enabled
   * @default true
   */
  enabled?: boolean;
  /**
   * Callback fired when auto-connect is triggered
   */
  onAutoConnect?: () => void;
  /**
   * Delay in milliseconds before auto-connecting
   * @default 0
   */
  delay?: number;
}

/**
 * Hook that automatically opens the wallet connection modal when the wallet is not connected
 * and an action requiring wallet connection is attempted.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { ensureWalletConnected } = useAutoConnectWallet({
 *     onAutoConnect: () => console.log("Auto-connecting wallet..."),
 *   });
 *
 *   const handleAction = async () => {
 *     const isConnected = await ensureWalletConnected();
 *     if (!isConnected) return;
 *
 *     // Proceed with action that requires wallet
 *     await performTransaction();
 *   };
 *
 *   return <button onClick={handleAction}>Execute Action</button>;
 * }
 * ```
 */
export function useAutoConnectWallet(options: UseAutoConnectWalletOptions = {}) {
  const { enabled = true, onAutoConnect, delay = 0 } = options;
  const { active, account } = useWallet();
  const { openConnectModal } = useConnectModal();
  const autoConnectAttempted = useRef(false);

  /**
   * Ensures the wallet is connected before proceeding.
   * If not connected, automatically opens the wallet connection modal.
   *
   * @returns Promise that resolves to true if wallet is connected, false otherwise
   */
  const ensureWalletConnected = async (): Promise<boolean> => {
    if (active && account) {
      return true;
    }

    if (!enabled || !openConnectModal) {
      return false;
    }

    // Trigger the auto-connect callback
    onAutoConnect?.();

    // Open the wallet connection modal after delay
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    openConnectModal();
    autoConnectAttempted.current = true;

    return false;
  };

  /**
   * Synchronous check if wallet is connected.
   * Use this for rendering logic, not for async operations.
   */
  const isWalletConnected = active && !!account;

  // Reset auto-connect flag when wallet connects
  useEffect(() => {
    if (active && account && autoConnectAttempted.current) {
      autoConnectAttempted.current = false;
    }
  }, [active, account]);

  return {
    /**
     * Ensures wallet is connected, opening connection modal if needed
     */
    ensureWalletConnected,
    /**
     * Whether wallet is currently connected
     */
    isWalletConnected,
    /**
     * The connected wallet address (undefined if not connected)
     */
    account,
    /**
     * Whether wallet is connected
     */
    active,
    /**
     * Function to manually open the connect modal
     */
    openConnectModal,
  };
}
