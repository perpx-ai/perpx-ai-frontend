import { useMemo } from "react";
import useSWR from "swr";

import { fetchDailyStats, type DailyTradeStats } from "lib/api/trades";

// USD float → 1e30 bigint, keeping 6 decimal places
function usdToE30(val: number | undefined): bigint {
  const n = Number(val ?? 0);
  if (!isFinite(n) || n === 0) return 0n;
  return BigInt(Math.round(n * 1_000_000)) * 10n ** 24n;
}

export type AccountBucketStats = {
  bucketLabel: string;
  pnlUsd: bigint;
  volume: bigint;
  wins: number;
  losses: number;
  winsLossesRatioBps: bigint | undefined;
};

export const ACCOUNT_STATS_BUCKETS = ["today", "yesterday", "week", "month", "year", "all"] as const;

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** UTC days (YYYY-MM-DD, inclusive) each summary bucket covers. */
function bucketRanges(now: number): Record<string, [string, string]> {
  const today = utcDay(now);
  const daysAgo = (n: number) => utcDay(now - n * 86_400_000);
  return {
    today: [today, today],
    yesterday: [daysAgo(1), daysAgo(1)],
    week: [daysAgo(6), today],
    month: [daysAgo(29), today],
    year: [`${today.slice(0, 4)}-01-01`, today],
    all: ["0000-00-00", today],
  };
}

function sumBucket(label: string, days: DailyTradeStats[]): AccountBucketStats {
  let pnl = 0;
  let volume = 0;
  let wins = 0;
  let losses = 0;
  for (const d of days) {
    pnl += d.pnl;
    volume += d.volume;
    wins += d.wins;
    losses += d.losses;
  }
  const total = wins + losses;
  return {
    bucketLabel: label,
    pnlUsd: usdToE30(pnl),
    volume: usdToE30(volume),
    wins,
    losses,
    winsLossesRatioBps: total > 0 ? BigInt(Math.round((wins / total) * 10_000)) : undefined,
  };
}

export type AccountTradeStats = {
  summaryByBucket: Record<string, AccountBucketStats>;
  /** YYYY-MM-DD → daily PnL in 1e30 bigint */
  dailyPnl: Map<string, bigint>;
  /** YYYY-MM-DD → number of trades */
  dailyCounts: Record<string, number>;
  isLoading: boolean;
  error: unknown;
};

/**
 * Competition stats for an account — GMX, Hyperliquid and manual corrections from the
 * backend — so the account page matches the leaderboard and competition numbers.
 */
export function useAccountTradeStats(account: string | null | undefined): AccountTradeStats {
  const { data, isLoading, error } = useSWR(
    account ? ["accountDailyStats", account.toLowerCase()] : null,
    () => fetchDailyStats(account!.toLowerCase()),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const days = useMemo(() => data ?? [], [data]);

  const summaryByBucket = useMemo(() => {
    const ranges = bucketRanges(Date.now());
    const result: Record<string, AccountBucketStats> = {};
    for (const label of ACCOUNT_STATS_BUCKETS) {
      const [from, to] = ranges[label];
      result[label] = sumBucket(label, days.filter((d) => d.date >= from && d.date <= to));
    }
    return result;
  }, [days]);

  const dailyPnl = useMemo(() => new Map(days.map((d) => [d.date, usdToE30(d.pnl)])), [days]);

  const dailyCounts = useMemo(() => Object.fromEntries(days.map((d) => [d.date, d.trades])), [days]);

  return { summaryByBucket, dailyPnl, dailyCounts, isLoading, error };
}
