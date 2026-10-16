import { Trans } from "@lingui/macro";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import type { Address } from "viem";

import { useMarketsInfoData } from "context/SyntheticsStateContext/hooks/globalsHooks";
import type { FastMarketInfoData } from "domain/synthetics/markets/types";
import { fetchTrades, type UnifiedTrade } from "lib/api/trades";
import { formatUsd } from "lib/numbers";

import ExternalLinkIcon from "img/external-link.svg?react";

import { EmptyTableContent } from "components/EmptyTableContent/EmptyTableContent";
import { BottomTablePagination } from "components/Pagination/BottomTablePagination";
import { TableScrollFadeContainer } from "components/TableScrollFade/TableScrollFade";
import { TableTd, TableTh, TableTheadTr, TableTr } from "components/Table/Table";

const TRADES_PER_PAGE = 20;

type Props = {
  account: Address;
  chainId: number;
  startDate?: string | null;
  endDate?: string | null;
};

function formatDate(timeMs: number): string {
  if (!timeMs) return "—";
  try {
    return new Date(timeMs).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

function formatOrderType(trade: UnifiedTrade): string {
  if (trade.platform === "hyperliquid") {
    return trade.side === "BUY" ? "Buy" : "Sell";
  }
  const n = String(trade.orderType || "").toLowerCase();
  if (n.includes("increase") || n === "2" || n === "3") return "Increase";
  if (n.includes("decrease") || n === "4" || n === "5" || n === "6" || n === "7") return "Decrease";
  if (n.includes("swap") || n === "0" || n === "1") return "Swap";
  return trade.orderType || "—";
}

function formatSize(trade: UnifiedTrade): string {
  if (trade.platform === "hyperliquid") {
    const p = parseFloat(trade.price);
    const s = parseFloat(trade.size);
    if (Number.isFinite(p) && Number.isFinite(s)) {
      return `$${(p * s).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return trade.size;
  }
  try {
    return formatUsd(BigInt(trade.size), { maxThreshold: null });
  } catch {
    return trade.size;
  }
}

function formatGmxPrice(raw: string | undefined, decimals: number): string {
  if (!raw || raw === "0") return "—";
  try {
    const bn = BigInt(raw);
    if (bn === 0n) return "—";
    const priceExp = 30 - decimals;
    const usd = bn / 10n ** BigInt(priceExp);
    return formatUsd(usd * 10n ** 30n, { maxThreshold: null, displayDecimals: 2 })!;
  } catch {
    return "—";
  }
}

function formatPrice(trade: UnifiedTrade, decimals: number): string {
  if (trade.platform === "hyperliquid") {
    const p = parseFloat(trade.price);
    if (Number.isFinite(p)) {
      return `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return "—";
  }
  return formatGmxPrice(trade.price, decimals);
}

function formatSide(trade: UnifiedTrade): { label: string; isLong: boolean } {
  if (trade.platform === "hyperliquid") {
    const isLong = trade.side === "BUY";
    return { label: isLong ? "Long" : "Short", isLong };
  }
  const isLong = trade.isLong ?? trade.side === "LONG";
  return { label: isLong ? "Long" : "Short", isLong };
}

function TradeRow({ trade, marketsInfoData }: { trade: UnifiedTrade; marketsInfoData: FastMarketInfoData | undefined }) {
  const { label, isLong } = formatSide(trade);
  const venue = trade.platform === "hyperliquid" ? "HL" : "GMX";

  const marketInfo = trade.market ? marketsInfoData?.[trade.market] : undefined;
  const indexToken = "indexToken" in (marketInfo ?? {}) ? (marketInfo as any).indexToken : undefined;
  const symbol = trade.platform === "gmx"
    ? (indexToken?.symbol ?? "—")
    : trade.symbol;
  const decimals: number = indexToken?.decimals ?? 18;

  return (
    <TableTr>
      <TableTd className="text-typography-secondary">{formatDate(trade.time)}</TableTd>
      <TableTd className="font-mono text-body-small">
        {symbol}/USD
        <span className="ml-4 text-typography-secondary text-12">{venue}</span>
      </TableTd>
      <TableTd>{formatOrderType(trade)}</TableTd>
      <TableTd>
        <span className={isLong ? "text-green-500" : "text-red-500"}>{label}</span>
      </TableTd>
      <TableTd className="numbers">{formatSize(trade)}</TableTd>
      <TableTd className="numbers">{formatPrice(trade, decimals)}</TableTd>
      <TableTd className="font-mono text-body-small truncate">
        {trade.txHash ? (
          <a
            href={
              trade.platform === "hyperliquid"
                ? `https://app.hyperliquid.xyz/explorer/tx/${trade.txHash}`
                : `https://arbiscan.io/tx/${trade.txHash}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-blue-400 hover:text-blue-300"
            title={trade.txHash}
          >
            <ExternalLinkIcon className="size-14" />
          </a>
        ) : "—"}
      </TableTd>
    </TableTr>
  );
}

export function AccountTradeHistory({ account, startDate, endDate }: Props) {
  const [page, setPage] = useState(1);
  const marketsInfoData = useMarketsInfoData();

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate]);

  const key = useMemo(() => {
    if (!account) return null;
    return [
      "unifiedTrades",
      account.toLowerCase(),
      page,
      TRADES_PER_PAGE,
      startDate ?? "",
      endDate ?? "",
    ] as const;
  }, [account, page, startDate, endDate]);

  const { data, error, isLoading } = useSWR(
    key,
    ([, address, p, limit, start, end]) =>
      fetchTrades({
        address,
        page: p,
        limit,
        platform: "all",
        ...(start && { startDate: start }),
        ...(end && { endDate: end }),
      }),
    { revalidateOnFocus: false },
  );

  const trades = data?.data?.trades ?? [];
  const pageCount = data?.data?.pagination?.pages ?? 0;
  const isEmpty = !isLoading && !error && trades.length === 0;

  return (
    <div className="AccountTradeHistory flex grow flex-col bg-slate-900">
      <div className="pl-20 pr-8 pt-8">
        <span className="text-body-medium font-medium">
          <Trans>Trade History</Trans>
        </span>
      </div>
      <TableScrollFadeContainer disableScrollFade={trades.length === 0} className="flex grow flex-col">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead>
            <TableTheadTr>
              <TableTh><Trans>Date</Trans></TableTh>
              <TableTh><Trans>Market</Trans></TableTh>
              <TableTh><Trans>Type</Trans></TableTh>
              <TableTh><Trans>Side</Trans></TableTh>
              <TableTh><Trans>Size</Trans></TableTh>
              <TableTh><Trans>Price</Trans></TableTh>
              <TableTh><Trans>Tx</Trans></TableTh>
            </TableTheadTr>
          </thead>
          <tbody>
            {isLoading && (
              <TableTr>
                <TableTd colSpan={7} className="text-center text-typography-secondary">
                  <Trans>Loading…</Trans>
                </TableTd>
              </TableTr>
            )}
            {!isLoading && !error && trades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} marketsInfoData={marketsInfoData} />
            ))}
          </tbody>
        </table>
        {isEmpty && (
          <EmptyTableContent
            isLoading={false}
            isEmpty={true}
            emptyText={<Trans>No trades yet for this address</Trans>}
          />
        )}
      </TableScrollFadeContainer>
      <BottomTablePagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
