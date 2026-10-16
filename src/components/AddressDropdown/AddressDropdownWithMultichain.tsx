import cx from "classnames";
import { useCallback, useMemo } from "react";
import Skeleton from "react-loading-skeleton";
import { useAccount } from "wagmi";

import { useGmxAccountModalOpen } from "context/GmxAccountContext/hooks";
import { useChainId } from "lib/chains";
import { useENS } from "lib/legacy";
import { formatUsd } from "lib/numbers";
import { useBreakpoints } from "lib/useBreakpoints";
import { shortenAddressOrEns } from "lib/wallets";
import { convertToUsd, getMidPrice, useTokenBalances, useTokenRecentPricesRequest } from "domain/synthetics/tokens";
import { getTokensMap } from "sdk/configs/tokens";

import { Avatar } from "components/Avatar/Avatar";
import Button from "components/Button/Button";
import TooltipWithPortal from "components/Tooltip/TooltipWithPortal";

type Props = {
  account: string;
};

function useConnectedWalletUsd() {
  const { chainId } = useChainId();
  const { address: injectedAccount } = useAccount();
  const { balancesData } = useTokenBalances(chainId, { overrideAccount: injectedAccount, useCustodyWallet: false });
  const { pricesData } = useTokenRecentPricesRequest(chainId);

  return useMemo(() => {
    if (!balancesData || !pricesData) return { usd: undefined, isLoading: true };
    const tokenConfigs = getTokensMap(chainId);
    let total = 0n;
    for (const [addr, balance] of Object.entries(balancesData)) {
      const prices = pricesData[addr];
      const token = tokenConfigs[addr];
      if (!prices || !token || balance === undefined) continue;
      const usd = convertToUsd(balance, token.decimals, getMidPrice(prices));
      if (usd) total += usd;
    }
    return { usd: total, isLoading: false };
  }, [balancesData, pricesData, chainId]);
}

export function AddressDropdownWithMultichain({ account }: Props) {
  const { ensName } = useENS(account);
  const [, setGmxAccountModalOpen] = useGmxAccountModalOpen();
  const { usd: connectedWalletUsd, isLoading: isWalletLoading } = useConnectedWalletUsd();

  const { isMobile, isSmallMobile } = useBreakpoints();
  const displayAddressLength = isMobile ? 9 : 13;

  const handleOpenGmxAccountModal = useCallback(() => {
    setGmxAccountModalOpen(true);
  }, [setGmxAccountModalOpen]);

  return (
    <div className="text-body-medium flex font-medium text-typography-primary">
      <Button
        variant="secondary"
        type="button"
        size="controlled"
        className="h-32 md:h-40"
        onClick={handleOpenGmxAccountModal}
      >
        <div
          className={cx(
            "text-body-medium flex items-center font-medium text-typography-primary",
            !isMobile && "gap-8",
            isMobile && "gap-8"
          )}
        >
          <Avatar size={isMobile ? 16 : 24} ensName={ensName} address={account} />

          {!isSmallMobile && shortenAddressOrEns(ensName || account, displayAddressLength)}

          {!isSmallMobile && (
            <>
              <div className="h-20 w-1 shrink-0 bg-slate-600" />
              <span className="numbers">
                {isWalletLoading ? (
                  <Skeleton baseColor="#B4BBFF1A" highlightColor="#B4BBFF1A" width={45} height={14} inline />
                ) : (
                  formatUsd(connectedWalletUsd, { displayDecimals: 2 })
                )}
              </span>
            </>
          )}

          <TooltipWithPortal
            content="Your personal wallet. Use it to fund your PerpX Wallet with the tokens you want to trade."
            variant="icon"
            position="bottom"
            tooltipClassName="!min-w-[200px]"
          />
        </div>
      </Button>
    </div>
  );
}
