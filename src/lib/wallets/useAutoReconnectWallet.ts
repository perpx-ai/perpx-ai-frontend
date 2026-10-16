import { useEffect, useRef } from "react";
import { useAccount, useReconnect } from "wagmi";

interface UseAutoReconnectWalletOptions {
  /**
   * Whether auto-reconnect should be enabled
   * @default true
   */
  enabled?: boolean;
  /**
   * Callback fired when auto-reconnect is triggered
   */
  onReconnecting?: () => void;
  /**
   * Callback fired when reconnection succeeds
   */
  onReconnected?: (address: string) => void;
  /**
   * Callback fired when reconnection fails
   */
  onReconnectFailed?: (error: Error) => void;
}

/**
 * Hook that automatically attempts to reconnect to a previously connected wallet
 * when the application loads/renders.
 *
 * This uses Wagmi's built-in reconnect functionality which:
 * - Checks for previously connected wallets in localStorage
 * - Automatically attempts to reconnect to the last connected wallet
 * - Handles MetaMask, WalletConnect, and other wallet providers
 *
 * @example
 * ```tsx
 * function App() {
 *   useAutoReconnectWallet({
 *     onReconnected: (address) => console.log("Reconnected to:", address),
 *     onReconnectFailed: (error) => console.error("Reconnect failed:", error),
 *   });
 *
 *   return <YourApp />;
 * }
 * ```
 */
export function useAutoReconnectWallet(options: UseAutoReconnectWalletOptions = {}) {
  const { enabled = true, onReconnecting, onReconnected, onReconnectFailed } = options;

  const { address, isConnected, isReconnecting } = useAccount();
  const { reconnect, connectors } = useReconnect();
  const hasAttemptedReconnect = useRef(false);
  const previousAddress = useRef<string | undefined>(undefined);

  // Attempt to reconnect on mount
  useEffect(() => {
    if (!enabled || hasAttemptedReconnect.current) {
      return;
    }

    // Get the last connected connector from storage
    const attemptReconnect = async () => {
      try {
        // Check if there are any connectors available
        if (connectors.length === 0) {
          return;
        }

        // Wagmi automatically attempts to reconnect on mount using its internal storage.
        // We still guard MetaMask connector checks to avoid noisy failures when extension is not installed.
        if (!isConnected && !isReconnecting) {
          onReconnecting?.();

          // Get all connectors and try to reconnect
          for (const connector of connectors) {
            try {
              const connectorName = connector.name?.toLowerCase?.() ?? "";
              const isMetaMaskConnector = connectorName.includes("metamask");
              const hasMetaMaskExtension = Boolean((window as any)?.ethereum?.isMetaMask);

              // Prevent MetaMask SDK reconnection attempts in browsers without extension.
              if (isMetaMaskConnector && !hasMetaMaskExtension) {
                continue;
              }

              // Only reconnect if the connector was previously authorized
              const isAuthorized = await connector.isAuthorized?.();
              if (isAuthorized) {
                reconnect({ connectors: [connector] });
                hasAttemptedReconnect.current = true;
                break;
              }
            } catch (error) {
              // Continue to next connector if this one fails
              console.debug(`Connector ${connector.name} not authorized:`, error);
            }
          }
        }
      } catch (error) {
        console.error("Auto-reconnect failed:", error);
        onReconnectFailed?.(error as Error);
      }
    };

    // Small delay to ensure providers are ready
    const timeoutId = setTimeout(attemptReconnect, 100);

    return () => clearTimeout(timeoutId);
  }, [enabled, isConnected, isReconnecting, connectors, reconnect, onReconnecting, onReconnectFailed]);

  // Track when connection is successfully established
  useEffect(() => {
    if (isConnected && address && address !== previousAddress.current) {
      previousAddress.current = address;

      // Only fire callback if this was an auto-reconnect (not a manual connection)
      if (hasAttemptedReconnect.current) {
        onReconnected?.(address);
      }
    }
  }, [isConnected, address, onReconnected]);

  return {
    /**
     * Whether wallet is currently connected
     */
    isConnected,
    /**
     * Whether wallet is currently attempting to reconnect
     */
    isReconnecting,
    /**
     * The connected wallet address (undefined if not connected)
     */
    address,
  };
}
