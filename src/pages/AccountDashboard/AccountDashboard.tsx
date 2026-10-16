import { Trans, t } from "@lingui/macro";
import { useHistory } from "react-router-dom";
import Jazzicon, { jsNumberForAddress } from "react-jazzicon";
import { isAddress } from "viem";

import { SyntheticsStateContextProvider } from "context/SyntheticsStateContext/SyntheticsStateContextProvider";
import { useChainId } from "lib/chains";
import { shortenAddress } from "lib/legacy";
import { useAccountTradeStats } from "lib/hooks/useAccountTradeStats";

import AppPageLayout from "components/AppPageLayout/AppPageLayout";
import { ChainContentHeader } from "components/ChainContentHeader/ChainContentHeader";
import PageTitle from "components/PageTitle/PageTitle";

import ArrowLeftIcon from "img/ic_arrow_left.svg?react";

import { DailyAndCumulativePnL } from "./DailyAndCumulativePnL";
import { GeneralPerformanceDetails } from "./GeneralPerformanceDetails";
import { HistoricalLists } from "./HistoricalLists";
import { usePageParams } from "./usePageParams";
import { VersionNetworkSwitcherRow } from "./VersionNetworkSwitcherRow";
import { TradeActivityGraph } from "pages/LeaderboardPage/components/TradeActivityGraph";

export function AccountDashboard() {
  const { chainId: initialChainId } = useChainId();
  const { chainId, version, account } = usePageParams(initialChainId);
  const tradeStats = useAccountTradeStats(account);

  const header = <ChainContentHeader chainId={chainId} />;

  if (!isAddress(account!)) {
    return (
      <AppPageLayout header={header}>
        <div className="default-container page-layout">
          <PageTitle title={t`GMX  Account`} className="p-12" />
          <div className="text-center text-red-500">
            <Trans>Invalid address. Please make sure you have entered a valid Ethereum address</Trans>
          </div>
        </div>
      </AppPageLayout>
    );
  }

  const history = useHistory();
  const shortAddress = account ? "0x" + shortenAddress(account.replace(/^0x/, ""), 9, 0) : "";

  return (
    <AppPageLayout header={header}>
      <div className="default-container page-layout mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-[145px]">
        <div className="Page-title-wrapper gapTop">
          <div className="Page-title-group flex flex-wrap items-center gap-12">
            <button
              type="button"
              onClick={() => history.goBack()}
              className="flex items-center gap-4 rounded p-4 text-typography-secondary transition-colors hover:bg-fill-surfaceHover hover:text-typography-primary"
              aria-label="Back"
            >
              <ArrowLeftIcon className="size-20" />
              <span className="text-body-medium font-medium"><Trans>Back</Trans></span>
            </button>
            <h2 className="Page-title__text text-h1 flex items-center gap-8">
              {account && <Jazzicon diameter={20} seed={jsNumberForAddress(account)} />}
              {shortAddress && (
                <span className="text-body-medium font-medium text-typography-secondary">{shortAddress}</span>
              )}
            </h2>
          </div>
        </div>

        {version === 2 && (
          <SyntheticsStateContextProvider overrideChainId={chainId} pageType="accounts" skipLocalReferralCode={false}>
            <div className="flex flex-col gap-8">
              <div className="flex flex-row flex-wrap gap-8">
                <div className="max-w-full grow-[2] *:size-full">
                  <GeneralPerformanceDetails stats={tradeStats} />
                </div>
                <div className="grow *:size-full">
                  <DailyAndCumulativePnL stats={tradeStats} />
                </div>
              </div>
              <TradeActivityGraph account={account} chainId={chainId} dailyCounts={tradeStats.dailyCounts} />
              <HistoricalLists chainId={chainId} account={account} />
            </div>
          </SyntheticsStateContextProvider>
        )}
      </div>
    </AppPageLayout>
  );
}
