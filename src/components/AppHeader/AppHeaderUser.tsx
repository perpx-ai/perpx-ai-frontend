import { Trans } from "@lingui/macro";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import { NETWORK_OPTIONS } from "config/networkOptions";
import { useChainId } from "lib/chains";
import { sendUserAnalyticsConnectWalletClickEvent } from "lib/userAnalytics";
import useWallet from "lib/wallets/useWallet";

import { OneClickButton } from "components/OneClickButton/OneClickButton";

import { AddressDropdown } from "../AddressDropdown/AddressDropdown";
import ConnectWalletButton from "../ConnectWalletButton/ConnectWalletButton";
import NetworkDropdown from "../NetworkDropdown/NetworkDropdown";
import { getAccountUrl, isHomeSite } from "lib/legacy";
import { CustodyWalletButton } from "components/CustodyWallet";
import LanguagePopupHome from "components/NetworkDropdown/LanguagePopupHome";
import { useCallback, useEffect } from "react";
import { useAccount } from "wagmi";
import { ARBITRUM } from "config/chains";
import { switchNetwork } from "lib/wallets";
import Button from "components/Button/Button";

type Props = {
  openSettings: () => void;
  menuToggle?: React.ReactNode;
};

export function AppHeaderUser({ openSettings, menuToggle }: Props) {
  const { chainId: settlementChainId, srcChainId } = useChainId();
    const { isConnected, chainId: walletChainId } = useAccount();

  const { active, account } = useWallet();
  const { openConnectModal } = useConnectModal();
  const showConnectionOptions = !isHomeSite();
  const visualChainId = srcChainId ?? settlementChainId;
  const { chainId } = useChainId();
  const isArbitrum = walletChainId === ARBITRUM;

  const handleSwitchToArbitrum = useCallback(() => {
    switchNetwork(ARBITRUM, true);
  }, []);
useEffect(() => {
  if (!account && openConnectModal && !isConnected) {
    sendUserAnalyticsConnectWalletClickEvent("Header");
    openConnectModal();
  }
}, [account, openConnectModal,isConnected]);
//       const modalExists = document.querySelector('[data-rk] [role="dialog"]') !== null;

// useEffect(() => {
//   if (!isConnected) {
//     openConnectModal?.();
//   }
// }, [isConnected, openConnectModal,modalExists]);
  if (!active || !account) {
    return (
      <div className="flex items-center gap-8">
        {openConnectModal ? (
          <>
            <ConnectWalletButton
              onClick={() => {
                sendUserAnalyticsConnectWalletClickEvent("Header");
                openConnectModal();
              }}
            >
              <Trans>Connect wallet</Trans>
            </ConnectWalletButton>
            {menuToggle ? menuToggle : null}
          </>
        ) : null}
      </div>
    );
  }
  const accountUrl = getAccountUrl(chainId, account);

  return (
    <div className="flex items-center gap-8">
      {/* <div data-qa="user-address">
        <AddressDropdown account={account} />
      </div> */}
       {showConnectionOptions ? (
        <>
          {!isArbitrum && (
            <Button
              variant="primary-action"
              size="controlled"
              className="h-32 md:h-40"
              onClick={handleSwitchToArbitrum}
            >
              <Trans>Switch to Arbitrum</Trans>
            </Button>
          )}
          <CustodyWalletButton small={false} />
          <div data-qa="user-address" className="App-header-user-address">
            <AddressDropdown
              account={account}
              // accountUrl={accountUrl}
              // disconnectAccountAndCloseSettings={disconnectAccountAndCloseSettings}
            />
          </div>
          {/* {!small && <OneClickButton openSettings={openSettings} />} */}
          {/* <NetworkDropdown
            small={small}
            networkOptions={NETWORK_OPTIONS}
            selectorLabel={selectorLabel}
            openSettings={openSettings}
          /> */}
        </>
      ) : (
        <LanguagePopupHome />
      )}
      {menuToggle ? menuToggle : null}
    </div>
  );
}
