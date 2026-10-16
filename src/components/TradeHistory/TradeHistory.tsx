import { Trans } from "@lingui/macro";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import useSWR from "swr";
import type { Address } from "viem";

import { TRADE_HISTORY_PER_PAGE } from "config/ui";
import { selectChainId } from "context/SyntheticsStateContext/selectors/globalSelectors";
import { useSelector } from "context/SyntheticsStateContext/utils";
import { useDateRange, useNormalizeDateRange } from "lib/dates";
import { useBreakpoints } from "lib/useBreakpoints";
import { buildAccountDashboardUrl } from "pages/AccountDashboard/buildAccountDashboardUrl";
import { fetchTrades, type UnifiedTrade } from "lib/api/trades";

import Button from "components/Button/Button";
import { EmptyTableContent } from "components/EmptyTableContent/EmptyTableContent";
import { BottomTablePagination } from "components/Pagination/BottomTablePagination";
import usePagination from "components/Referrals/usePagination";
import { TradesHistorySkeleton } from "components/Skeleton/Skeleton";
import { TableTh, TableTheadTr } from "components/Table/Table";
import { TableScrollFadeContainer } from "components/TableScrollFade/TableScrollFade";
import TooltipWithPortal from "components/Tooltip/TooltipWithPortal";

import DownloadIcon from "img/ic_download2.svg?react";
import PieChartIcon from "img/ic_pie_chart.svg?react";

import { DateRangeSelect } from "../DateRangeSelect/DateRangeSelect";
import type { MarketFilterLongShortItemData } from "../TableMarketFilter/MarketFilterLongShort";
import { TableTd, TableTr } from "components/Table/Table";
import cx from "classnames";

import "./TradeHistorySynthetics.scss";
import { useCustodyWallet } from "context/CustodyWalletContext/CustodyWalletContextProvider";

const ENTITIES_PER_PAGE = TRADE_HISTORY_PER_PAGE;

type ActionFilter = object;

type Props = {
  account: Address | null | undefined;
  chainId?: number;
  forAllAccounts?: boolean;
  hideDashboardLink?: boolean;
};

// GMX v2 Arbitrum market address → { symbol, priceExp = 30 - indexToken.decimals }
const GMX_MARKETS: Record<string, { symbol: string; priceExp: number }> = {
  "0x70d95587d40a2caf56bd97485ab3eec10bee6336": { symbol: "ETH", priceExp: 12 },
  "0x47c031236e19d024b42f8ae6780e44a573170703": { symbol: "BTC", priceExp: 22 },
  "0x6853ea96ff216fab11d2d930ce3c508556a4bdc4": { symbol: "SOL", priceExp: 21 },
  "0xd9535bb5f58a1a75032416f2dfe7880c30575a41": { symbol: "ARB", priceExp: 12 },
  "0x0ccb4faa6f1f1b0f60b21a21b5ed88e5c09aada": { symbol: "LINK", priceExp: 12 },
  "0x248c35760068ce009a13076d573ed3497a47bcd4": { symbol: "OP", priceExp: 12 },
  "0x7f1fa204bb700853d36994da19f830b6ad18d297": { symbol: "AAVE", priceExp: 12 },
  "0x450bb6774dd8a756274e0ab4107953259d2ac541": { symbol: "UNI", priceExp: 12 },
  "0xc7abb2c5f3bf3ceb389df0eecd6120d451170b50": { symbol: "DOGE", priceExp: 22 },
  "0x2d340912aa47e33c90efb078e69e70efe2b34b9b": { symbol: "LTC", priceExp: 22 },
};

function getGmxMarket(market: string | undefined): { symbol: string; priceExp: number } {
  if (!market) return { symbol: "—", priceExp: 12 };
  const found = GMX_MARKETS[market.toLowerCase()];
  if (found) return found;
  // Fallback: shorten the address instead of showing full hex
  const short = market.length > 10 ? `${market.slice(0, 6)}...${market.slice(-4)}` : market;
  return { symbol: short, priceExp: 12 };
}

function formatOrderType(orderType: string): string {
  const n = String(orderType || "").toLowerCase();
  if (n.includes("increase") || n === "2" || n === "3") return "Increase";
  if (n.includes("decrease") || n === "4" || n === "5" || n === "6" || n === "7") return "Decrease";
  if (n.includes("swap") || n === "0" || n === "1") return "Swap";
  return orderType || "—";
}

function formatSizeUsd(sizeDeltaUsd: string | undefined): string {
  if (!sizeDeltaUsd || sizeDeltaUsd === "0") return "—";
  try {
    const val = BigInt(sizeDeltaUsd);
    // GMX sizeDeltaUsd uses 30 decimal places
    const dollars = Number(val / 10n ** 28n) / 100;
    return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } catch {
    return sizeDeltaUsd;
  }
}

function formatRealizedPnl(rawPnl: string | undefined): { text: string; positive: boolean } | null {
  if (!rawPnl) return null;
  try {
    const val = BigInt(rawPnl);
    if (val === 0n) return null;
    const positive = val >= 0n;
    const absVal = positive ? val : -val;
    const dollars = Number(absVal / 10n ** 28n) / 100;
    return { text: `${positive ? "+" : "-"}$${dollars.toFixed(2)}`, positive };
  } catch {
    return null;
  }
}

function formatGmxPrice(rawPrice: string | undefined, priceExp: number): string {
  if (!rawPrice || rawPrice === "0") return "—";
  try {
    const val = BigInt(rawPrice);
    const divisor = 10n ** BigInt(priceExp);
    const whole = val / divisor;
    const frac = val % divisor;
    // Get 2 decimal places from the fractional part
    const fracTwoDecimals = Number((frac * 100n) / divisor);
    const dollars = Number(whole) + fracTwoDecimals / 100;
    return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } catch {
    return rawPrice;
  }
}

export function TradeHistory(p: Props) {
  const { custodyWalletAddress } = useCustodyWallet();
  const params = useParams<{ account?: string }>();
  const accountFromRoute = params.account && params.account.length >= 10 ? params.account : undefined;
  const account: Address | null | undefined =
    p.account !== undefined && p.account !== null
      ? p.account
      : accountFromRoute
        ? (accountFromRoute as Address)
        : (custodyWalletAddress as Address | null);
  const { forAllAccounts, hideDashboardLink = false, chainId: chainIdProp } = p;
  const chainIdFromContext = useSelector(selectChainId);
  const chainId = chainIdProp ?? chainIdFromContext;
  const [startDate, endDate, setDateRange] = useDateRange();
  const [marketsDirectionsFilter] = useState<MarketFilterLongShortItemData[]>([]);
  const [actionFilter] = useState<ActionFilter[]>([]);
  const [fromTxTimestamp, toTxTimestamp] = useNormalizeDateRange(startDate, endDate);

  const mainAccount = account?.toLowerCase();
  const custodyAccount = custodyWalletAddress?.toLowerCase();

  const { data: tradesData, isLoading: isTradesLoading } = useSWR(
    mainAccount ? ["tradeHistoryUnified", mainAccount, custodyAccount ?? "", startDate ?? "", endDate ?? ""] : null,
    () =>
      fetchTrades({
        address: mainAccount!,
        account: custodyAccount,
        limit: 100,
        platform: "all",
        ...(startDate && { startDate: startDate.toISOString().split("T")[0] }),
        ...(endDate && { endDate: endDate.toISOString().split("T")[0] }),
      }),
    { revalidateOnFocus: false },
  );

  const mergedEntries = useMemo((): UnifiedTrade[] => {
    let trades = tradesData?.data?.trades ?? [];
    if (fromTxTimestamp) {
      trades = trades.filter((t) => t.time >= fromTxTimestamp * 1000);
    }
    if (toTxTimestamp) {
      trades = trades.filter((t) => t.time <= toTxTimestamp * 1000);
    }
    return trades.sort((a, b) => b.time - a.time);
  }, [tradesData, fromTxTimestamp, toTxTimestamp]);

  const isConnected = Boolean(account);
  const isLoading = (forAllAccounts || isConnected) && isTradesLoading;

  const isEmpty = !isLoading && mergedEntries.length === 0;
  const {
    currentPage,
    setCurrentPage,
    currentData: currentPageData,
    pageCount,
  } = usePagination([account, forAllAccounts].toString(), mergedEntries, ENTITIES_PER_PAGE);

  const hasFilters = Boolean(startDate || endDate || marketsDirectionsFilter.length || actionFilter.length);

  const pnlAnalysisButton = useMemo(() => {
    if (!account || hideDashboardLink) {
      return null;
    }
    const url = buildAccountDashboardUrl(account, chainId, 2);
    return (
      <Button variant="ghost" to={url}>
        <PieChartIcon className="size-16" />
        <Trans>PnL Analysis</Trans>
      </Button>
    );
  }, [account, chainId, hideDashboardLink]);

  const { isMobile } = useBreakpoints();

  const controls = (
    <div className="flex items-center gap-4">
      {pnlAnalysisButton}
      <DateRangeSelect startDate={startDate} endDate={endDate} onChange={setDateRange} />
      <Button variant="ghost" className="flex items-center gap-4" disabled>
        <DownloadIcon className="size-16" />
        CSV
      </Button>
    </div>
  );

  return (
    <div className="TradeHistorySynthetics flex grow flex-col bg-slate-900">
      <div className="flex items-center justify-between gap-8 pl-20 pr-8 pt-8">
        {!isMobile ? (
          <span className="text-body-medium font-medium">
            <Trans>Trade History</Trans>
          </span>
        ) : null}

        {controls}
      </div>
      <TableScrollFadeContainer disableScrollFade={currentPageData.length === 0} className="flex grow flex-col">
        <table className="TradeHistorySynthetics-table table-fixed">
          <colgroup>
            <col className="TradeHistorySynthetics-action-column" />
            <col className="TradeHistorySynthetics-market-column" />
            <col className="TradeHistorySynthetics-size-column" />
            <col className="TradeHistorySynthetics-price-column" />
            <col className="TradeHistorySynthetics-pnl-fees-column" />
          </colgroup>
          <thead>
            <TableTheadTr>
              <TableTh className="w-[18%]">
                <Trans>Action</Trans>
              </TableTh>
              <TableTh className="w-[18%]">
                <Trans>Market</Trans>
              </TableTh>
              <TableTh className="w-[26%]">
                <Trans>Size</Trans>
              </TableTh>
              <TableTh className="w-[22%]">
                <Trans>Price</Trans>
              </TableTh>
              <TableTh className="w-[12%]">
                <TooltipWithPortal
                  variant="iconStroke"
                  content={<Trans>Realized PnL after fees and net price impact.</Trans>}
                >
                  <Trans>RPnL</Trans>
                </TooltipWithPortal>
              </TableTh>
              <TableTh className="w-[8%]">
                <Trans>Venue</Trans>
              </TableTh>
              <TableTh className="w-[100px]" />
            </TableTheadTr>
          </thead>
          <tbody>
            {isLoading ? (
              <TradesHistorySkeleton withTimestamp={forAllAccounts} />
            ) : (
              currentPageData.map((trade, i) => {
                if (trade.platform === "gmx") {
                  const orderLabel = formatOrderType(trade.orderType ?? "");
                  const { symbol, priceExp } = getGmxMarket(trade.market);
                  const marketLabel = symbol !== "—" ? symbol : (trade.symbol ?? "—");
                  const pnl = formatRealizedPnl(trade.pnl);
                  return (
                    <TableTr key={`gmx-${trade.id}-${i}`} hoverable={false}>
                      <TableTd>
                        <span className={cx("font-medium", trade.isLong ? "text-green-500" : "text-red-500")}>
                          {orderLabel} {trade.isLong ? "Long" : "Short"}
                        </span>
                        <div className="text-body-small text-typography-secondary">
                          {trade.time ? new Date(trade.time).toLocaleString() : "—"}
                        </div>
                      </TableTd>
                      <TableTd className="font-medium">{marketLabel}/USD</TableTd>
                      <TableTd className="numbers">{formatSizeUsd(trade.size)}</TableTd>
                      <TableTd className="numbers">{formatGmxPrice(trade.price, priceExp)}</TableTd>
                      <TableTd>
                        {pnl ? (
                          <span className={cx("numbers", pnl.positive ? "text-green-500" : "text-red-500")}>
                            {pnl.text}
                          </span>
                        ) : (
                          <span className="text-typography-secondary">—</span>
                        )}
                      </TableTd>
                      <TableTd>
                        <span className="rounded-4 bg-[#1a1a2d] px-6 py-2 text-[10px] font-medium text-[#818cf8]">
                          GMX
                        </span>
                      </TableTd>
                      <TableTd />
                    </TableTr>
                  );
                }
                const pnl = parseFloat(trade.pnl ?? "0");
                const isBuy = trade.side === "BUY";
                return (
                  <TableTr key={`hl-${trade.id}-${i}`} hoverable={false}>
                    <TableTd>
                      <span className={cx("font-medium", isBuy ? "text-green-500" : "text-red-500")}>
                        {isBuy ? "Buy" : "Sell"}
                      </span>
                      <div className="text-body-small text-typography-secondary">
                        {new Date(trade.time).toLocaleString()}
                      </div>
                    </TableTd>
                    <TableTd className="font-medium">{trade.symbol}/USD</TableTd>
                    <TableTd className="numbers">
                      {trade.size} {trade.symbol}
                    </TableTd>
                    <TableTd className="numbers">${parseFloat(trade.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableTd>
                    <TableTd>
                      {pnl !== 0 ? (
                        <span className={cx("numbers", pnl > 0 ? "text-green-500" : "text-red-500")}>
                          {pnl > 0 ? "+" : ""}${pnl.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-typography-secondary">—</span>
                      )}
                    </TableTd>
                    <TableTd>
                      <span className="rounded-4 bg-[#1a2d1a] px-6 py-2 text-[10px] font-medium text-[#4ade80]">
                        HL
                      </span>
                    </TableTd>
                    <TableTd />
                  </TableTr>
                );
              })
            )}
          </tbody>
        </table>
        {isEmpty && hasFilters && (
          <EmptyTableContent
            isLoading={false}
            isEmpty={isEmpty}
            emptyText={<Trans>No trades match the selected filters</Trans>}
          />
        )}
        {isEmpty && !hasFilters && !isLoading && (
          <EmptyTableContent isLoading={false} isEmpty={isEmpty} emptyText={<Trans>No trades yet</Trans>} />
        )}
      </TableScrollFadeContainer>

      <BottomTablePagination page={currentPage} pageCount={pageCount} onPageChange={setCurrentPage} />
    </div>
  );
}
