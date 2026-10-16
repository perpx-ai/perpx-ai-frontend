import { useEffect, useState } from "react";
import { getHlMarkets } from "./api/hyperliquid";

// Must match SmartRouterService.ts GMX_SYMBOL_MAP keys
const GMX_SYMBOLS = new Set(["BTC", "ETH", "SOL", "ARB", "DOGE", "LINK", "UNI", "AVAX", "LTC", "OP"]);

let cachedHlMarkets: Set<string> | null = null;

export function useVenueAvailability(symbol: string | undefined) {
  const [hlMarkets, setHlMarkets] = useState<Set<string>>(cachedHlMarkets ?? new Set());

  useEffect(() => {
    if (cachedHlMarkets) return;
    getHlMarkets().then((markets) => {
      cachedHlMarkets = new Set(markets.map((m) => m.toUpperCase()));
      setHlMarkets(cachedHlMarkets);
    }).catch(() => {});
  }, []);

  const sym = symbol?.toUpperCase() ?? "";

  // If no symbol yet, all venues are available
  if (!sym) return { isOnGmx: true, isOnHl: true };

  const isOnGmx = GMX_SYMBOLS.has(sym);
  // Treat empty hlMarkets (still loading) as available to avoid false-disabling
  const isOnHl = hlMarkets.size === 0 || hlMarkets.has(sym);

  return { isOnGmx, isOnHl };
}
