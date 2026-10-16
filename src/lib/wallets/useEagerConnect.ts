import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";

interface UseEagerConnectOptions {
  /**
   * Whether eager connect should be enabled
   * @default true
   */
  enabled?: boolean;
  /**
   * Delay in milliseconds before attempting eager connect
   * @default 500
   */
  delay?: number;
  /**
   * Whether to auto-open connect modal if no wallet is connected
   * @default false
   */
  autoOpenModal?: boolean;
  /**
   * Callback fired when eager connect is triggered
   */
  onEagerConnect?: () => void;
}

/**
 * Hook that eagerly attempts to connect to MetaMask on first render
 * if it's available in the browser and user hasn't connected before.
 *
 * This provides a seamless experience by:
 * 1. Checking if MetaMask is installed
 * 2. Optionally auto-opening the wallet connect modal
 * 3. Allowing users to connect immediately when they visit the site
 *
 * NOTE: This is different from useAutoReconnectWallet which reconnects
 * to previously connected wallets. This hook can optionally prompt for
 * initial connection.
 *
 * @example
 * ```tsx
 * function App() {
 *   // Automatically open wallet connect modal on first visit
 *   useEagerConnect({
 *     autoOpenModal: true,
 *     delay: 1000, // Wait 1 second before opening modal
 *   });
 *
 *   return <YourApp />;
 * }
 * ```
 */
export function useEagerConnect(options: UseEagerConnectOptions = {}) {
  const { enabled = true, delay = 500, autoOpenModal = false, onEagerConnect } = options;

  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const hasAttemptedEagerConnect = useRef(false);

  useEffect(() => {
    console.log("useEagerConnect - State:", {
      enabled,
      hasAttempted: hasAttemptedEagerConnect.current,
      isConnected,
      autoOpenModal,
      hasOpenModal: !!openConnectModal,
    });

    if (!enabled || hasAttemptedEagerConnect.current || isConnected || !autoOpenModal) {
      console.log("useEagerConnect - Skipping auto-open");
      return;
    }

    const attemptEagerConnect = () => {
      console.log("useEagerConnect - Attempting to open modal...");
      // Always open the modal if not connected, regardless of wallet installation
      // The modal will show WalletConnect and other options even without browser extension
      if (openConnectModal) {
        console.log("useEagerConnect - Opening connect modal NOW!");
        onEagerConnect?.();
        // Auto-open the connect modal
        openConnectModal();
        hasAttemptedEagerConnect.current = true;
      } else {
        console.error("useEagerConnect - openConnectModal is not available!");
      }
    };

    console.log(`useEagerConnect - Scheduling modal open in ${delay}ms`);
    const timeoutId = setTimeout(attemptEagerConnect, delay);

    return () => clearTimeout(timeoutId);
  }, [enabled, isConnected, autoOpenModal, delay, openConnectModal, onEagerConnect]);

  return {
    /**
     * Whether wallet is currently connected
     */
    isConnected,
    /**
     * Whether eager connect has been attempted
     */
    hasAttemptedEagerConnect: hasAttemptedEagerConnect.current,
  };
}

// Note: Window.ethereum type is already declared globally by MetaMask types
// This hook uses the existing window.ethereum interface
