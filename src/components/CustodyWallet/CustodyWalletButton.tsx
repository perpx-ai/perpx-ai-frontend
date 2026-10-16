import { useState } from "react";
import { FaWallet } from "react-icons/fa";

import { CustodyWalletModal } from "./CustodyWalletModal";
import TooltipWithPortal from "components/Tooltip/TooltipWithPortal";

import "./CustodyWalletButton.scss";

type Props = {
  small?: boolean;
};

export function CustodyWalletButton({ small }: Props) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const custodyWallet = localStorage.getItem("custodyWallet");

  if (!custodyWallet) {
    return null;
  }

  return (
    <>
      <button
        className="custody-wallet-btn"
        onClick={() => setIsModalVisible(true)}
        data-qa="custody-wallet-button"
      >
        <FaWallet className="custody-wallet-icon" />
        {!small && <span className="custody-wallet-text">PerpX Wallet</span>}
        {!small && (
          <TooltipWithPortal
            content="Your in-app trading wallet. It holds your funds and signs/places your trades automatically — so you don't confirm every order manually."
            variant="icon"
            position="bottom"
            tooltipClassName="!min-w-[200px]"
          />
        )}
      </button>

      <CustodyWalletModal
        isVisible={isModalVisible}
        setIsVisible={setIsModalVisible}
        custodyWalletAddress={custodyWallet}
      />
    </>
  );
}