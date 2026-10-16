import { useState, useEffect, useCallback, useRef } from "react";
import { getHlPositions, getHlBalances } from "lib/api/hyperliquid";

export interface HlPosition {
  symbol: string;
  side: "LONG" | "SHORT";
  size: string;
  entryPrice: string;
  markPrice: string;
  unrealizedPnl: string;
  leverage: number;
  marginMode: string;
  collateral: string;
  liquidationPrice: string | null;
  platform: string;
}

export interface HlBalance {
  asset: string;
  total: string;
  available: string;
  unrealizedPnl: string;
}

export function useHyperliquidPositions(userAddress: string | undefined) {
  const [positions, setPositions] = useState<HlPosition[]>([]);
  const [balances, setBalances] = useState<HlBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const fetch = useCallback(async () => {
    if (!userAddress) {
      // Nothing to fetch, but the list must not sit on a skeleton forever.
      setPositions([]);
      setBalances([]);
      setLoading(false);
      return;
    }
    // Only show loading spinner on the very first fetch — subsequent polls
    // update silently so existing rows don't flash away
    if (!hasFetched.current) setLoading(true);
    try {
      const pos = await getHlPositions(userAddress).catch(() => []);
      const bal = await getHlBalances(userAddress).catch(() => []);
      setPositions(pos ?? []);
      setBalances(bal ?? []);
    } finally {
      hasFetched.current = true;
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    hasFetched.current = false;
    fetch();
    const id = setInterval(fetch, 10_000);
    return () => clearInterval(id);
  }, [fetch]);

  return { positions, balances, loading, refetch: fetch };
}
