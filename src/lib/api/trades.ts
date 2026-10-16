import { BACKEND_URL } from "config/perpx";

/**
 * Unified trades API — GMX orders + Hyperliquid fills from perpx-backend DB.
 */

export type TradePlatform = "gmx" | "hyperliquid";

export type UnifiedTrade = {
  id: string;
  platform: TradePlatform;
  time: number;
  symbol: string;
  side: string;
  size: string;
  price: string;
  fee?: string;
  pnl?: string;
  orderId?: string;
  txHash?: string;
  orderType?: string;
  isLong?: boolean;
  market?: string;
};

export type FetchTradesParams = {
  address?: string;
  account?: string;
  page?: number;
  limit?: number;
  platform?: "all" | TradePlatform;
  startDate?: string;
  endDate?: string;
};

export type FetchTradesResponse = {
  status: boolean;
  data?: {
    trades: UnifiedTrade[];
    pagination: {
      total: number;
      page: number;
      pages: number;
    };
  };
  message?: string;
};

export async function fetchTrades(params: FetchTradesParams): Promise<FetchTradesResponse> {
  const {
    address,
    account,
    page = 1,
    limit = 50,
    platform = "all",
    startDate,
    endDate,
  } = params;

  const searchParams = new URLSearchParams();
  if (address) searchParams.set("address", address);
  if (account) searchParams.set("account", account);
  searchParams.set("page", String(page));
  searchParams.set("limit", String(limit));
  searchParams.set("platform", platform);
  if (startDate) searchParams.set("startDate", startDate);
  if (endDate) searchParams.set("endDate", endDate);

  const url = `${BACKEND_URL}/api/admin/trades?${searchParams.toString()}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const data = (await res.json()) as FetchTradesResponse;
  if (!res.ok) {
    throw new Error(data?.message || `Trades request failed: ${res.status}`);
  }
  return data;
}

export type DailyTradeStats = {
  /** UTC day, YYYY-MM-DD. */
  date: string;
  volume: number;
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
};

export type RangeTradeStats = { volume: number; pnl: number; trades: number };

function backendUrl(path: string): string {
  return `${BACKEND_URL}${path}`;
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || `Request failed: ${res.status}`);
  }
  return data;
}

/**
 * Competition stats (GMX + Hyperliquid + manual corrections) for one wallet, per UTC day.
 * Accepts the main wallet or its custody wallet.
 */
export async function fetchDailyStats(address: string): Promise<DailyTradeStats[]> {
  const data = await getJson(backendUrl(`/api/admin/trades/daily-stats?address=${encodeURIComponent(address)}`));
  return data?.data?.days ?? [];
}

/** Competition stats over the last `days` days, keyed by lowercased main wallet. */
export async function fetchRangeStats(addresses: string[], days: number): Promise<Record<string, RangeTradeStats>> {
  const params = new URLSearchParams({ addresses: addresses.join(","), days: String(days) });
  const data = await getJson(backendUrl(`/api/admin/trades/range-stats?${params}`));
  return data?.data ?? {};
}
