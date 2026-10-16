import { Trans, t } from "@lingui/macro";
import cx from "classnames";
import { useEffect, useMemo, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { useHistory } from "react-router-dom";
import { useCopyToClipboard } from "react-use";
import { useAccount } from "wagmi";

import { ARBITRUM, BOTANIX, getExplorerUrl } from "config/chains";
import { isSettlementChain } from "config/multichain";
import { useGmxAccountModalOpen, useGmxAccountSelectedTransferGuid } from "context/GmxAccountContext/hooks";
import { useSettings } from "context/SettingsContext/SettingsContextProvider";
import { isMultichainFundingItemLoading } from "domain/multichain/isMultichainFundingItemLoading";
import type { MultichainFundingHistoryItem } from "domain/multichain/types";
import { useDisconnectAndClose } from "domain/multichain/useDisconnectAndClose";
import { useGmxAccountFundingHistory } from "domain/multichain/useGmxAccountFundingHistory";
import { useChainId } from "lib/chains";
import { buildHyperliquidTxUrl, CHAIN_ID_TO_TX_URL_BUILDER } from "lib/chains/blockExplorers";
import { formatRelativeDateWithComma } from "lib/dates";
import { helperToast } from "lib/helperToast";
import { useLocalizedMap } from "lib/i18n";
import { useENS } from "lib/legacy";
import { formatUsd } from "lib/numbers";
import { useBreakpoints } from "lib/useBreakpoints";
import { useNotifyModalState } from "lib/useNotifyModalState";
import { shortenAddressOrEns } from "lib/wallets";
import { buildAccountDashboardUrl } from "pages/AccountDashboard/buildAccountDashboardUrl";
import { getToken, getTokensMap } from "sdk/configs/tokens";
import { Token } from "sdk/types/tokens";

import { Amount } from "components/Amount/Amount";
import { Avatar } from "components/Avatar/Avatar";
import Button from "components/Button/Button";
import ExternalLink from "components/ExternalLink/ExternalLink";
import SearchInput from "components/SearchInput/SearchInput";
import { VerticalScrollFadeContainer } from "components/TableScrollFade/VerticalScrollFade";
import TokenIcon from "components/TokenIcon/TokenIcon";
import TooltipWithPortal from "components/Tooltip/TooltipWithPortal";

import BellIcon from "img/ic_bell.svg?react";
import ChevronLeftIcon from "img/ic_chevron_left.svg?react";
import CopyIcon from "img/ic_copy.svg?react";
import ExplorerIcon from "img/ic_explorer.svg?react";
import PnlAnalysisIcon from "img/ic_pnl_analysis.svg?react";
import SettingsIcon from "img/ic_settings.svg?react";
import DisconnectIcon from "img/ic_sign_out_20.svg?react";
import SpinnerIcon from "img/ic_spinner.svg?react";
import SwapVerticalIcon from "img/ic_swap_vertical.svg?react";

import { SyntheticsInfoRow } from "../SyntheticsInfoRow";
import { useCustodyWallet } from "context/CustodyWalletContext/CustodyWalletContextProvider";
import { convertToUsd, getMidPrice, useTokenBalances, useTokenRecentPricesRequest } from "domain/synthetics/tokens";
import { getHlBalances, getActivity } from "lib/api/hyperliquid";
import { useAuth } from "context/AuthContext/AuthContextProvider";

import {
  useAvailableToTradeAssetMultichain,
  useAvailableToTradeAssetSettlementChain,
  useAvailableToTradeAssetSymbolsMultichain,
  useAvailableToTradeAssetSymbolsSettlementChain,
} from "./hooks";
import { FUNDING_OPERATIONS_LABELS } from "./keys";

function UsdValueWithSkeleton({ usd }: { usd: bigint | undefined }) {
  return (
    <span className="numbers">
      {usd !== undefined ? (
        formatUsd(usd)
      ) : (
        <Skeleton baseColor="#B4BBFF1A" highlightColor="#B4BBFF1A" width={54} className="leading-base" inline={true} />
      )}
    </span>
  );
}

const TokenIcons = ({ tokens }: { tokens: string[] }) => {
  const displayTokens = tokens.slice(0, 3);

  return (
    <div className="flex items-center">
      {displayTokens.map((token, index) => (
        <div
          key={token}
          className={cx(
            "-ml-6 flex size-14 items-center justify-center rounded-full border border-slate-600 first-of-type:-ml-0"
          )}
          // Safety: its small
          // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop
          style={{
            zIndex: tokens.length - index,
          }}
        >
          <TokenIcon symbol={token} displaySize={18} />
        </div>
      ))}
    </div>
  );
};

function FundingHistoryItemLabel({
  step,
  operation,
  isExecutionError,
}: Pick<MultichainFundingHistoryItem, "step" | "operation" | "isExecutionError">) {
  const labels = useLocalizedMap(FUNDING_OPERATIONS_LABELS);

  const isLoading = isMultichainFundingItemLoading({ operation, step, isExecutionError });

  const key = `${operation}${isExecutionError ? "-failed" : ""}`;
  let text = labels[key] ?? `${operation} ${isExecutionError ? " failed" : ""}`;

  if (isLoading) {
    return (
      <div className="text-body-small flex items-center gap-4 text-slate-100">
        <SpinnerIcon className="size-16 animate-spin" />
        {text}
      </div>
    );
  } else if (isExecutionError) {
    return <div className="text-body-small text-red-500">{text}</div>;
  }

  return <div className="text-body-small text-slate-100">{text}</div>;
}

const Toolbar = ({ account }: { account: string }) => {
  const [, setIsVisible] = useGmxAccountModalOpen();
  const { chainId: settlementChainId, srcChainId } = useChainId();
  const history = useHistory();

  const { isSmallMobile } = useBreakpoints();
  const chainId = srcChainId ?? settlementChainId;

  const { openNotifyModal } = useNotifyModalState();
  const { setIsSettingsVisible } = useSettings();
  const { ensName } = useENS(account);
  const [, copyToClipboard] = useCopyToClipboard();
  const handleDisconnect = useDisconnectAndClose();

  const handleCopyAddress = () => {
    if (account) {
      copyToClipboard(account);
      helperToast.success(t`Address copied to your clipboard`);
    }
  };

  const accountUrl = useMemo(() => {
    if (!account || !chainId) return "";
    return `${getExplorerUrl(chainId)}address/${account}`;
  }, [account, chainId]);

  const handleNotificationsClick = () => {
    openNotifyModal();
    setTimeout(() => {
      setIsVisible(false);
    }, 200);
  };

  const handlePnlAnalysisClick = () => {
    if (!account || !chainId) return;
    history.push(buildAccountDashboardUrl(account, chainId, 2));
    setIsVisible(false);
  };

  const handleSettingsClick = () => {
    setIsSettingsVisible(true);
    setTimeout(() => {
      setIsVisible(false);
    }, 200);
  };

  const showNotify = settlementChainId !== BOTANIX;
  const buttonClassName = isSmallMobile ? cx("size-32 !p-0") : cx("size-40 !p-0");

  return (
    <div className="flex items-stretch justify-between gap-12 max-smallMobile:flex-wrap">
      <Button variant="secondary" size="small" className="flex items-center gap-8" onClick={handleCopyAddress}>
        <div className="max-[500px]:hidden">
          <Avatar size={24} ensName={ensName} address={account} />
        </div>
        <div className="text-body-medium font-medium text-typography-primary">
          {shortenAddressOrEns(ensName || account, 13)}
        </div>
        <CopyIcon className="size-20 max-[500px]:hidden" />
      </Button>
      <div className="flex items-center gap-8">
        <TooltipWithPortal
          shouldPreventDefault={false}
          content={t`View in Explorer`}
          position="bottom"
          tooltipClassName="!min-w-max"
          variant="none"
        >
          <Button
            to={accountUrl}
            newTab
            variant="secondary"
            size="small"
            className={buttonClassName}
            showExternalLinkArrow={false}
          >
            <ExplorerIcon />
          </Button>
        </TooltipWithPortal>

        <TooltipWithPortal content={t`Disconnect`} position="bottom" tooltipClassName="!min-w-max" variant="none">
          <Button variant="secondary" size="small" className={buttonClassName} onClick={handleDisconnect}>
            <DisconnectIcon />
          </Button>
        </TooltipWithPortal>
      </div>
    </div>
  );
};

function useInjectedWalletUsd() {
  const { chainId } = useChainId();
  const { address: injectedAccount } = useAccount();
  const { balancesData } = useTokenBalances(chainId, { overrideAccount: injectedAccount, useCustodyWallet: false });
  const { pricesData } = useTokenRecentPricesRequest(chainId);

  return useMemo(() => {
    if (!balancesData || !pricesData) return undefined;
    const tokenConfigs = getTokensMap(chainId);
    let total = 0n;
    for (const [addr, balance] of Object.entries(balancesData)) {
      const prices = pricesData[addr];
      const token = tokenConfigs[addr];
      if (!prices || !token || balance === undefined) continue;
      const usd = convertToUsd(balance, token.decimals, getMidPrice(prices));
      if (usd) total += usd;
    }
    return total;
  }, [balancesData, pricesData, chainId]);
}

function usePerpxAccountBalance() {
  const { chainId } = useChainId();
  const { custodyWalletAddress } = useCustodyWallet();
  const { pricesData } = useTokenRecentPricesRequest(chainId);

  // On-chain balance of the custody (backend) wallet
  const { balancesData: custodyBalancesData } = useTokenBalances(chainId, {
    overrideAccount: custodyWalletAddress ?? undefined,
    useCustodyWallet: false,
    enabled: Boolean(custodyWalletAddress),
  });

  const beUsd = useMemo(() => {
    if (!custodyBalancesData || !pricesData) return null;
    const tokenConfigs = getTokensMap(chainId);
    let total = 0n;
    for (const [addr, balance] of Object.entries(custodyBalancesData)) {
      const prices = pricesData[addr];
      const token = tokenConfigs[addr];
      if (!prices || !token || balance === undefined) continue;
      const usd = convertToUsd(balance, token.decimals, getMidPrice(prices));
      if (usd) total += usd;
    }
    // Convert from 1e30 to dollar float
    return Number(total) / 1e30;
  }, [custodyBalancesData, pricesData, chainId]);

  // HL account value via API
  const [hlUsd, setHlUsd] = useState<number | null>(null);
  useEffect(() => {
    if (!custodyWalletAddress) return;
    getHlBalances(custodyWalletAddress)
      .then((bals: any[]) => {
        const usdc = bals.find((b) => b.asset === "USDC" || b.asset === "usdc");
        setHlUsd(parseFloat(usdc?.total ?? "0"));
      })
      .catch(() => setHlUsd(0));
  }, [custodyWalletAddress]);

  const totalUsd = beUsd !== null && hlUsd !== null ? beUsd + hlUsd : null;

  return { beUsd, hlUsd, totalUsd };
}

function GmxAccountBalanceTooltipContent() {
  return `Your PerpX Wallet balance, usable for trading from any supported chain.`;
}

function PerpxBalanceTooltip({ beUsd, hlUsd }: { beUsd: number | null; hlUsd: number | null }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-16">
        <span className="text-typography-secondary">Backend (custody)</span>
        <span className="numbers">{beUsd !== null ? `$${beUsd.toFixed(2)}` : "—"}</span>
      </div>
      <div className="flex items-center justify-between gap-16">
        <span className="text-typography-secondary">Hyperliquid</span>
        <span className="numbers">{hlUsd !== null ? `$${hlUsd.toFixed(2)}` : "—"}</span>
      </div>
    </div>
  );
}

function SettlementChainBalance() {
  useAvailableToTradeAssetSettlementChain();
  const availableToTradeAssetSymbols = useAvailableToTradeAssetSymbolsSettlementChain();
  const injectedWalletUsd = useInjectedWalletUsd();
  const { beUsd, hlUsd, totalUsd: perpxTotalUsd } = usePerpxAccountBalance();

  const combinedTotalUsd = useMemo(() => {
    if (injectedWalletUsd === undefined || perpxTotalUsd === null) return undefined;
    // injectedWalletUsd is in 1e30 scale; perpxTotalUsd is a dollar float
    return injectedWalletUsd + BigInt(Math.round(perpxTotalUsd * 1e30));
  }, [injectedWalletUsd, perpxTotalUsd]);

  const [, setIsVisibleOrView] = useGmxAccountModalOpen();
  const [isPerpxWalletExpanded, setIsPerpxWalletExpanded] = useState(true);

  return (
    <div className="flex flex-col gap-12 rounded-8 bg-fill-surfaceElevated50 p-12">
      <div className="flex flex-col gap-8">
        <TooltipWithPortal
          handleClassName="text-body-small text-typography-secondary"
          content="Ready to open positions right now"
          variant="iconStroke"
        >
          <Trans>Available to Trade</Trans>
        </TooltipWithPortal>
        <Balance usd={combinedTotalUsd} availableToTradeAssetSymbols={availableToTradeAssetSymbols} />
      </div>
      <div className="h-[0.5px] bg-slate-600" />
      <div>
        <SyntheticsInfoRow
          label={
            <TooltipWithPortal
              content="Not deposited yet — add it to start trading"
              variant="iconStroke"
            >
              {t`In Your Connected Wallet`}
            </TooltipWithPortal>
          }
          className="py-4"
          value={
            <div className="flex items-center gap-8">
              <UsdValueWithSkeleton usd={injectedWalletUsd} />
              {(injectedWalletUsd === undefined || injectedWalletUsd === 0n) && (
                <button
                  className="rounded-4 bg-blue-500 px-8 py-2 text-[11px] font-medium text-white gmx-hover:bg-blue-400"
                  onClick={() => {
                    setIsVisibleOrView(false);
                    setTimeout(() => {
                      const custodyBtn = document.querySelector<HTMLButtonElement>('[data-qa="custody-wallet-button"]');
                      custodyBtn?.click();
                    }, 100);
                  }}
                >
                  Deposit
                </button>
              )}
            </div>
          }
        />
        <SyntheticsInfoRow
          label={
            <TooltipWithPortal
              content="Held by PerpX for trading"
              variant="iconStroke"
            >
              <span
                className="cursor-pointer"
                onClick={() => setIsPerpxWalletExpanded((v) => !v)}
              >
                <Trans>In Your PerpX Wallet</Trans>
                <span className="ml-4 text-typography-secondary">{isPerpxWalletExpanded ? "▲" : "▼"}</span>
              </span>
            </TooltipWithPortal>
          }
          className="py-4"
          value={
            perpxTotalUsd !== null ? (
              <span className="numbers">${perpxTotalUsd.toFixed(2)}</span>
            ) : (
              <UsdValueWithSkeleton usd={undefined} />
            )
          }
        />
        {isPerpxWalletExpanded && (
          <>
            <SyntheticsInfoRow
              label={
                <TooltipWithPortal
                  content="Held in your PerpX wallet"
                  variant="iconStroke"
                >
                  <span className="pl-12 text-typography-secondary">Ready to trade</span>
                </TooltipWithPortal>
              }
              className="py-2"
              value={<span className="numbers">{beUsd !== null ? `$${beUsd.toFixed(2)}` : "—"}</span>}
            />
            <SyntheticsInfoRow
              label={
                <TooltipWithPortal
                  content="Allocated to your selected venue"
                  variant="iconStroke"
                >
                  <span className="pl-12 text-typography-secondary">In active trading</span>
                </TooltipWithPortal>
              }
              className="py-2"
              value={<span className="numbers">{hlUsd !== null ? `$${hlUsd.toFixed(2)}` : "—"}</span>}
            />
          </>
        )}
      </div>
    </div>
  );
}

function MultichainBalance() {
  const { gmxAccountUsd } = useAvailableToTradeAssetMultichain();
  const availableToTradeAssetSymbols = useAvailableToTradeAssetSymbolsMultichain();

  return (
    <div className="flex flex-col gap-8 rounded-8 bg-fill-surfaceElevated50 p-12">
      <TooltipWithPortal
        handleClassName="text-body-small text-typography-secondary"
        content={<GmxAccountBalanceTooltipContent />}
        variant="iconStroke"
      >
        <Trans>Balance</Trans>
      </TooltipWithPortal>

      <Balance usd={gmxAccountUsd} availableToTradeAssetSymbols={availableToTradeAssetSymbols} />
    </div>
  );
}

function Balance({
  usd,
  availableToTradeAssetSymbols,
}: {
  usd: bigint | undefined;
  availableToTradeAssetSymbols: string[];
}) {
  const [, setIsVisibleOrView] = useGmxAccountModalOpen();

  const handleAvailableToTradeClick = () => {
    setIsVisibleOrView("availableToTradeAssets");
  };

  return (
    <div className="flex min-h-32 flex-wrap items-center justify-between gap-8">
      {usd !== undefined ? (
        <div className="text-h2 normal-nums leading-[30px]">{formatUsd(usd)}</div>
      ) : (
        <Skeleton
          baseColor="#B4BBFF1A"
          highlightColor="#B4BBFF1A"
          width={100}
          height={30}
          className="!block"
          inline={true}
        />
      )}
      {usd !== undefined && usd !== 0n && (
        <button
          className="flex min-h-32 items-center gap-4 rounded-full bg-slate-600 py-6 pl-12 pr-12 text-[13px] font-medium gmx-hover:bg-slate-600/90"
          onClick={handleAvailableToTradeClick}
        >
          <Trans>All assets</Trans>
          <TokenIcons tokens={availableToTradeAssetSymbols} />
          <ChevronLeftIcon className="size-16 rotate-180 text-typography-secondary" />
        </button>
      )}
      {usd === undefined && (
        <Skeleton
          baseColor="#B4BBFF1A"
          highlightColor="#B4BBFF1A"
          width={134}
          height={32}
          className="!block"
          inline={true}
        />
      )}
    </div>
  );
}

const BalanceSection = () => {
  const { chainId } = useAccount();

  return isSettlementChain(chainId!) ? <SettlementChainBalance /> : <MultichainBalance />;
};

const ActionButtons = () => {
  return null;
};

type DisplayFundingHistoryItem = Omit<MultichainFundingHistoryItem, "token"> & {
  token: Token;
};

/**
 * Mirrors the backend's activity item. `getActivity` is typed `any[]`, so nothing here is
 * checked against the server — keep it in sync with HyperliquidWithdrawalService.getActivity
 * by hand.
 */
type BackendActivityItem = {
  id: string;
  type: "deposit" | "withdrawal" | "hl_deposit";
  source: string;
  amount: string;
  asset: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  step1TxHash?: string;
  step1Status?: string;
  step2TxHash?: string;
  step2Status?: string;
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "text-yellow-500",
  PROCESSING: "text-blue-400",
  SUCCESS: "text-green-500",
  FAILED: "text-red-500",
};

/**
 * A PerpX Wallet → Hyperliquid transfer produces one hash per side of the bridge, and they
 * belong to different explorers: step 1 is an Arbitrum transaction, step 2 is a Hyperliquid
 * L1 one. Sending either hash to the other explorer gives a link that looks fine and 404s.
 */
function getActivityTxLinks(item: BackendActivityItem): { label: string; href: string }[] {
  const links: { label: string; href: string }[] = [];

  if (item.step1TxHash) {
    links.push({
      label: item.type === "hl_deposit" ? t`Sent on Arbitrum` : t`View transaction`,
      href: CHAIN_ID_TO_TX_URL_BUILDER[ARBITRUM](item.step1TxHash),
    });
  }

  if (item.step2TxHash) {
    links.push(
      item.type === "hl_deposit"
        ? { label: t`Credited on Hyperliquid`, href: buildHyperliquidTxUrl(item.step2TxHash) }
        : { label: t`View transaction`, href: CHAIN_ID_TO_TX_URL_BUILDER[ARBITRUM](item.step2TxHash) }
    );
  }

  return links;
}

const FundingHistorySection = () => {
  const [isVisible, setIsVisibleOrView] = useGmxAccountModalOpen();
  const [searchQuery, setSearchQuery] = useState("");
  const [, setSelectedTransferGuid] = useGmxAccountSelectedTransferGuid();
  const { token: authToken, ensureAuthenticated } = useAuth();

  const { fundingHistory, isLoading } = useGmxAccountFundingHistory();

  // Fetch backend activity (custody wallet deposits/withdrawals)
  const [backendActivity, setBackendActivity] = useState<BackendActivityItem[]>([]);
  const [isBackendLoading, setIsBackendLoading] = useState(false);
  const [backendError, setBackendError] = useState(false);
  // Whether the backend request has finished at least once (success, failure or
  // skipped). Drives the skeleton, so it can never hang on an unsettled source.
  const [backendSettled, setBackendSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // `token` is null whenever the session needs recovering (wallet auto-lock,
      // an unsigned prompt, a lapsed token). Returning early here meant Activity
      // silently rendered its empty state for a user who actually had history —
      // so recover the session the same way the withdraw flow does.
      const sessionToken = authToken ?? (await ensureAuthenticated().catch(() => null));
      if (cancelled) return;

      if (!sessionToken) {
        setBackendActivity([]);
        setBackendError(false);
        setBackendSettled(true);
        return;
      }

      setIsBackendLoading(true);
      setBackendError(false);
      try {
        const data = await getActivity(sessionToken, 50);
        if (cancelled) return;
        setBackendActivity(data || []);
      } catch (err) {
        if (cancelled) return;
        console.error("[Activity] Failed to fetch:", err);
        setBackendActivity([]);
        setBackendError(true);
      } finally {
        if (!cancelled) {
          setIsBackendLoading(false);
          setBackendSettled(true);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [authToken, ensureAuthenticated]);

  const filteredFundingHistory: DisplayFundingHistoryItem[] | undefined = fundingHistory
    ?.map((transfer): DisplayFundingHistoryItem | undefined => {
      const token = getToken(transfer.settlementChainId, transfer.token);

      if (!token) {
        return undefined;
      }

      return { ...transfer, token };
    })
    .filter((transfer): transfer is DisplayFundingHistoryItem => {
      if (!transfer) {
        return false;
      }

      const matchesSearch = transfer.token.symbol.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });

  const filteredBackendActivity = backendActivity.filter((item) =>
    item.asset.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTransferClick = (transfer: DisplayFundingHistoryItem) => {
    setSelectedTransferGuid(transfer.id);
    setIsVisibleOrView("transferDetails");
  };

  // Gate the skeleton on the backend request settling, not on either source's
  // loading flag.
  //
  // `isLoading` comes from SWR for the GMX multichain funding history, and stays
  // true indefinitely while that indexer is unreachable — so `||` leaves the
  // panel stuck on skeletons forever. The original `&&` had the opposite bug:
  // it went false as soon as the GMX hook settled, painting "No deposits or
  // withdrawals yet" over a backend list still in flight. Neither source can
  // wedge the panel now: once the backend answers we render data, an error, or
  // a genuine empty state, and GMX items still appear if they arrive.
  const hasAnyActivity = (filteredFundingHistory?.length ?? 0) > 0 || filteredBackendActivity.length > 0;
  const hasAnyData = (fundingHistory?.length ?? 0) > 0 || backendActivity.length > 0;
  const combinedIsLoading = !backendSettled && !hasAnyData;

  return (
    <div className="flex grow flex-col gap-12 overflow-y-hidden">
      <div className="flex items-center justify-between px-adaptive">
        <div className="text-body-large font-medium">
          <Trans>Activity</Trans>
        </div>
      </div>
      {hasAnyData && (
        <div className="px-adaptive">
          <SearchInput value={searchQuery} setValue={setSearchQuery} size="m" />
        </div>
      )}
      <VerticalScrollFadeContainer className="flex grow flex-col">
        {/* Backend activity (custody wallet withdrawals/deposits) */}
        {filteredBackendActivity.map((item) => {
          // A bridge transfer is not money arriving or leaving — it moves between two of
          // the user's own venues. So it gets no +/- and no red/green: a "-" here would
          // read as a loss, and a "+" as income, and neither happened.
          const isVenueTransfer = item.type === "hl_deposit";
          const isWithdrawal = item.type === "withdrawal";
          const txLinks = getActivityTxLinks(item);

          const label = isVenueTransfer
            ? t`PerpX Wallet → Hyperliquid`
            : isWithdrawal
              ? t`Withdrawal`
              : t`Deposit`;

          const formattedAmount = ["USDC", "USDT", "DAI"].includes(item.asset.toUpperCase())
            ? `$${parseFloat(item.amount).toFixed(2)}`
            : `${parseFloat(item.amount).toPrecision(4)} ${item.asset}`;

          return (
            <div
              key={`backend-${item.id}`}
              className="flex w-full items-center justify-between px-adaptive py-8 text-left"
            >
              <div className="flex items-center gap-16">
                {isVenueTransfer ? (
                  <div className="flex size-40 shrink-0 items-center justify-center rounded-full bg-fill-surfaceElevated50 text-typography-secondary">
                    <SwapVerticalIcon className="size-20" />
                  </div>
                ) : (
                  <TokenIcon symbol={item.asset} displaySize={40} />
                )}
                <div>
                  <div className="text-body-large">{item.asset}</div>
                  <div className={`text-body-small ${STATUS_COLORS[item.status] || "text-slate-100"}`}>
                    {label}
                    {!isVenueTransfer &&
                      (item.source === "hyperliquid" ? " (Hyperliquid)" : item.source === "gmx" ? " (GMX)" : "")}
                    {" · "}
                    {item.status}
                  </div>
                  {txLinks.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-8">
                      {txLinks.map((link) => (
                        <ExternalLink
                          key={link.href}
                          href={link.href}
                          variant="icon"
                          className="text-body-small text-typography-secondary"
                        >
                          {link.label}
                        </ExternalLink>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-body-large numbers">
                  <span
                    className={
                      isVenueTransfer ? "text-typography-primary" : isWithdrawal ? "text-red-500" : "text-green-500"
                    }
                  >
                    {isVenueTransfer ? "" : isWithdrawal ? "-" : "+"}
                    {formattedAmount}
                  </span>
                </div>
                <div className="text-body-small text-slate-100">
                  {formatRelativeDateWithComma(new Date(item.createdAt).getTime() / 1000)}
                </div>
              </div>
            </div>
          );
        })}

        {/* GMX multichain funding history */}
        {filteredFundingHistory?.map((transfer) => (
          <div
            role="button"
            tabIndex={0}
            key={transfer.id}
            className="flex w-full cursor-pointer items-center justify-between px-adaptive py-8 text-left -outline-offset-4 gmx-hover:bg-fill-surfaceElevated50"
            onClick={() => handleTransferClick(transfer)}
          >
            <div className="flex items-center gap-16">
              <TokenIcon symbol={transfer.token.symbol} displaySize={40} />
              <div>
                <div className="text-body-large">{transfer.token.symbol}</div>
                <FundingHistoryItemLabel
                  step={transfer.step}
                  operation={transfer.operation}
                  isExecutionError={transfer.isExecutionError}
                />
              </div>
            </div>
            <div className="text-right">
              <Amount
                className="text-body-large"
                amount={(transfer.operation === "deposit" ? 1n : -1n) * transfer.sentAmount}
                decimals={transfer.token.decimals}
                isStable={transfer.token.isStable}
                signed
              />
              <div className="text-body-small text-slate-100">
                {formatRelativeDateWithComma(transfer.sentTimestamp)}
              </div>
            </div>
          </div>
        ))}

        {!combinedIsLoading && !hasAnyActivity && !hasAnyData && backendError && (
          <div className="flex h-full flex-col items-center justify-center gap-8 p-adaptive text-center text-slate-100">
            <Trans>
              Couldn't load your activity. This doesn't mean you have none — check your connection
              and reopen this panel.
            </Trans>
          </div>
        )}
        {!combinedIsLoading && !hasAnyActivity && !hasAnyData && !backendError && (
          <div className="flex h-full flex-col items-center justify-center gap-8 p-adaptive text-slate-100">
            <Trans>No activity yet. Deposits, withdrawals and transfers to Hyperliquid show up here.</Trans>
          </div>
        )}
        {!combinedIsLoading && !hasAnyActivity && hasAnyData && (
          <div className="flex h-full flex-col items-center justify-center gap-8 p-adaptive text-slate-100">
            <Trans>No activity matching your search</Trans>
          </div>
        )}
        {combinedIsLoading && (
          <div className="flex flex-col gap-4 px-adaptive py-8">
            {[...Array(4)].map((_, i) => (
              <div key={`activity-skeleton-${i}`} className="flex items-center justify-between py-8">
                <div className="flex items-center gap-16">
                  <Skeleton baseColor="#1e293b" highlightColor="#334155" circle width={40} height={40} />
                  <div>
                    <Skeleton baseColor="#1e293b" highlightColor="#334155" width={60} height={14} />
                    <Skeleton baseColor="#1e293b" highlightColor="#334155" width={100} height={12} className="mt-4" />
                  </div>
                </div>
                <div className="text-right">
                  <Skeleton baseColor="#1e293b" highlightColor="#334155" width={70} height={14} />
                  <Skeleton baseColor="#1e293b" highlightColor="#334155" width={90} height={12} className="mt-4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </VerticalScrollFadeContainer>
    </div>
  );
};

export const MainView = ({ account }: { account: string }) => {
  return (
    <div className="text-body-medium flex grow flex-col gap-[--padding-adaptive] overflow-y-hidden">
      <div className="flex flex-col gap-12 px-adaptive pb-12 pt-8">
        <Toolbar account={account} />
        <BalanceSection />
        <ActionButtons />
      </div>
      <FundingHistorySection />
    </div>
  );
};
