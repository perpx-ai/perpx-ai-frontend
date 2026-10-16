import { BACKEND_URL } from "config/perpx";

/**
 * Backend orders API - fetches order/trade history from perpx-backend DB.
 */

export type BackendOrder = {
  _id: string;
  account: string;
  address: string;
  market: string;
  initialCollateralToken: string;
  orderType: string;
  decreasePositionSwapType?: string;
  sizeDeltaUsd: string;
  initialCollateralDeltaAmount: string;
  triggerPrice: string;
  acceptablePrice: string;
  isLong: boolean;
  isOpen: boolean;
  indextokenSymbol?: string;
  futureTokenSymbol?: string;
  realizedPnlUsd?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedAtTime?: number;
};

export type BackendOrdersResponse = {
  status: boolean;
  data?: {
    orders: BackendOrder[];
    pagination: {
      total: number;
      page: number;
      pages: number;
    };
  };
  message?: string;
};

export type FetchOrdersParams = {
  address?: string;
  account?: string;
  page?: number;
  limit?: number;
  sortOrder?: "asc" | "desc";
  startDate?: string;
  endDate?: string;
};

export async function fetchOrders(params: FetchOrdersParams): Promise<BackendOrdersResponse> {
  const { address, account, page = 1, limit = 50, sortOrder = "desc", startDate, endDate } = params;
  const searchParams = new URLSearchParams();
  if (account) {
    searchParams.set("account", account);
  } else if (address) {
    searchParams.set("address", address);
  }
  searchParams.set("page", String(page));
  searchParams.set("limit", String(limit));
  searchParams.set("sortOrder", sortOrder);
  if (startDate) searchParams.set("startDate", startDate);
  if (endDate) searchParams.set("endDate", endDate);

  const url = `${BACKEND_URL}/api/admin/orders?${searchParams.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  const data = (await res.json()) as BackendOrdersResponse;
  if (!res.ok) {
    throw new Error(data?.message || `Orders request failed: ${res.status}`);
  }
  return data;
}

export function useBackendOrdersKey(
  address: string | null | undefined,
  page: number,
  limit: number,
  startDate?: string | null,
  endDate?: string | null
): [string, string, number, number, string, string] | null {
  if (!address) return null;
  return [
    "backendOrders",
    address.toLowerCase(),
    page,
    limit,
    startDate ?? "",
    endDate ?? "",
  ];
}
