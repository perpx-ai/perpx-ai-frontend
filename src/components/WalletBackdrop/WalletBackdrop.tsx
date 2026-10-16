import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Trans } from "@lingui/macro";
import Button from "components/Button/Button";
import "./WalletBackdrop.scss";

/**
 * Public pages that have to stay readable without a connected wallet — they exist to be
 * shared and read by visitors who have not connected (and may not have) a wallet yet.
 */
const PUBLIC_ROUTES = ["/trading-competition"];

export function WalletBackdrop() {
  const { pathname } = useLocation();
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Listen for when RainbowKit modal opens/closes
    const checkModalState = () => {
      const rainbowKitModal = document.querySelector('[role="dialog"][aria-labelledby*="rk"]');
      setIsModalOpen(!!rainbowKitModal);
    };

    // Check immediately
    checkModalState();

    // Set up a mutation observer to watch for modal changes
    const observer = new MutationObserver(checkModalState);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Don't show backdrop on public pages, or if the wallet is connected, or the modal is open
  if (isPublicRoute || isConnected || isModalOpen) {
    return null;
  }

  const handleButtonClick = () => {
    if (openConnectModal) {
      openConnectModal();
    }
  };

  return (
    <div className="wallet-backdrop">
      <div className="wallet-backdrop-content">
        <div className="wallet-backdrop-message">
          <h2 className="text-typography-primary">Connect Your Wallet</h2>
          <p className="text-typography-secondary">Please connect your wallet to continue trading</p>
          <Button variant="primary-action" className="w-full" onClick={handleButtonClick}>
            Connect Wallet
          </Button>
        </div>
      </div>
    </div>
  );
}
