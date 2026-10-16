import { useEffect, useRef, useState } from "react";
import { getRoutingRecommendation, HlRoutingInfo } from "./api/hyperliquid";

const REFRESH_INTERVAL_MS = 3000;

export function useSmartRouter(
  symbol: string | undefined,
  side: "BUY" | "SELL" | undefined,
  enabled = true,
) {
  const [routing, setRouting] = useState<HlRoutingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!symbol || !side || !enabled) {
      setRouting(null);
      return;
    }

    let timer: ReturnType<typeof setInterval>;

    const fetch = async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      const result = await getRoutingRecommendation(symbol, side, ctrl.signal);
      if (!ctrl.signal.aborted) {
        setRouting(result);
        setLoading(false);
      }
    };

    fetch();
    timer = setInterval(fetch, REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [symbol, side, enabled]);

  return { routing, loading };
}
