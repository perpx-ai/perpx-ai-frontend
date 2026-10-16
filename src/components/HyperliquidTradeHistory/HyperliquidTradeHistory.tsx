import cx from "classnames";
import { t, Trans } from "@lingui/macro";
import { useState, useEffect, useCallback } from "react";
import { getHlTradeHistory, type HlTrade } from "lib/api/hyperliquid";
import { Table, TableTd, TableTh, TableTheadTr, TableTr } from "components/Table/Table";
import { TableScrollFadeContainer } from "components/TableScrollFade/TableScrollFade";

interface Props {
  userAddress: string | undefined;
}

export function HyperliquidTradeHistory({ userAddress }: Props) {
  const [trades, setTrades] = useState<HlTrade[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTrades = useCallback(async () => {
    if (!userAddress) return;
    setLoading(true);
    try {
      const data = await getHlTradeHistory(userAddress);
      // Most recent first, cap at 100
      setTrades(data.slice().sort((a, b) => b.time - a.time).slice(0, 100));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  if (!userAddress) return null;
  if (loading && trades.length === 0) {
    return <div className="px-16 py-12 text-body-small text-typography-secondary">{t`Loading Hyperliquid trade history…`}</div>;
  }
  if (trades.length === 0) {
    return <div className="px-16 py-12 text-body-small text-typography-secondary">{t`No Hyperliquid trades yet`}</div>;
  }

  return (
    <TableScrollFadeContainer className="mt-8">
      <Table className="!w-[max(100%,700px)] table-fixed">
        <thead className="text-body-medium">
          <TableTheadTr>
            <TableTh className="w-[12%]"><Trans>Market</Trans></TableTh>
            <TableTh className="w-[8%]"><Trans>Side</Trans></TableTh>
            <TableTh className="w-[14%]"><Trans>Price</Trans></TableTh>
            <TableTh className="w-[12%]"><Trans>Size</Trans></TableTh>
            <TableTh className="w-[12%]"><Trans>Realized PnL</Trans></TableTh>
            <TableTh className="w-[10%]"><Trans>Fee</Trans></TableTh>
            <TableTh className="w-[6%]"><Trans>Venue</Trans></TableTh>
            <TableTh className="w-[16%]"><Trans>Time</Trans></TableTh>
          </TableTheadTr>
        </thead>
        <tbody>
          {trades.map((trade, i) => {
            const pnl = parseFloat(trade.closedPnl);
            const isBuy = trade.side === "BUY";
            return (
              <TableTr key={`${trade.hash}-${i}`} hoverable={false}>
                <TableTd className="font-medium text-typography-primary">
                  {trade.symbol}/USD
                </TableTd>
                <TableTd>
                  <span className={cx("font-medium", isBuy ? "positive" : "negative")}>
                    {isBuy ? t`Buy` : t`Sell`}
                  </span>
                </TableTd>
                <TableTd className="numbers">
                  ${parseFloat(trade.price).toLocaleString()}
                </TableTd>
                <TableTd className="numbers">
                  {trade.size} {trade.symbol}
                </TableTd>
                <TableTd>
                  {pnl !== 0 ? (
                    <span className={cx("numbers", pnl > 0 ? "positive" : "negative")}>
                      {pnl > 0 ? "+" : ""}${pnl.toFixed(4)}
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </TableTd>
                <TableTd className="numbers text-typography-secondary">
                  {parseFloat(trade.fee).toFixed(4)} {trade.feeToken}
                </TableTd>
                <TableTd>
                  <span className="rounded-4 bg-[#1a2d1a] px-6 py-2 text-[10px] font-medium text-[#4ade80]">HL</span>
                </TableTd>
                <TableTd className="text-body-small text-typography-secondary">
                  {new Date(trade.time).toLocaleString()}
                </TableTd>
              </TableTr>
            );
          })}
        </tbody>
      </Table>
    </TableScrollFadeContainer>
  );
}
