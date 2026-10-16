import { BACKEND_URL } from "config/perpx";

const BASE = `${BACKEND_URL}/api/hyperliquid`;

export interface HlOrderRequest {
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity: string;
  price?: string;
  leverage?: number;
  reduceOnly?: boolean;
  timeInForce?: "GTC" | "IOC" | "POST_ONLY";
  userAddress: string;
}

export interface HlRoutingInfo {
  recommended: "gmx" | "hyperliquid";
  price: number;
  reason: string;
  savings: number;
  savingsPercent: number;
  alternatives: {
    gmx: { price: number; available: boolean; effectivePrice: number };
    hyperliquid: { price: number; available: boolean; effectivePrice: number };
  };
}

/**
 * `fetch` rejects with a bare `TypeError: Failed to fetch` when the backend is
 * unreachable — wrong VITE_BACKEND_URL, backend not running, CORS, offline.
 * That string was reaching users verbatim in toasts, telling them nothing about
 * what to do. Translate it once here; every other error passes through.
 */
async function hlFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (e: any) {
    if (e instanceof TypeError) {
      throw new Error("Could not reach the PerpX backend. Check your connection and try again.");
    }
    throw e;
  }
}

function authHeaders(token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/**
 * Reads the payload of a mutating call, throwing a message the user can act on.
 * Controllers answer with `{ success, error }`, but the auth middleware answers
 * with `{ status, message }` — reading only `error` turns an expired session
 * into an unexplained generic failure.
 */
async function readHlResponse(res: Response, fallback: string) {
  const json = await res.json().catch(() => null);

  if (res.status === 401 || res.status === 403) {
    throw new Error("Your session expired. Please reconnect your wallet and sign in again.");
  }

  if (!json?.success) {
    throw new Error(json?.error ?? json?.message ?? fallback);
  }

  return json.data;
}

// ── Agent setup ───────────────────────────────────────────────────────────────

export async function checkHlApiKey(userAddress: string): Promise<boolean> {
  const res = await hlFetch(`${BASE}/check-apikey/${userAddress}`);
  const json = await res.json();
  return json?.data?.hasValidApiKey ?? false;
}

export async function setupHlAgent(token: string): Promise<{
  agentWalletAddress: string;
  custodyWalletAddress: string;
  isNew: boolean;
}> {
  const res = await hlFetch(`${BASE}/setup`, {
    method: "POST",
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Agent setup failed");
  return json.data;
}

// ── Browser-wallet EIP-712 flow (optional) ───────────────────────────────────

export async function prepareHlApproval(walletAddress: string): Promise<{
  typedData: any;
  agentWalletAddress: string;
  nonce: number;
}> {
  const res = await hlFetch(`${BASE}/prepare-approval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Prepare approval failed");
  return json.data;
}

export async function completeHlApproval(
  walletAddress: string,
  signature: string,
  custodyWalletAddress?: string,
): Promise<{ agentWalletAddress: string }> {
  const res = await hlFetch(`${BASE}/complete-approval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, signature, custodyWalletAddress }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Complete approval failed");
  return json.data;
}

// ── Trading ───────────────────────────────────────────────────────────────────

export async function placeHlOrder(req: HlOrderRequest, token: string) {
  const res = await hlFetch(`${BASE}/order`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(req),
  });
  return readHlResponse(res, "Order placement failed");
}

export async function closeHlPosition(
  symbol: string,
  size: string,
  side: "LONG" | "SHORT",
  token: string,
): Promise<{ status: string; filledQty?: string; avgPrice?: string }> {
  const res = await hlFetch(`${BASE}/close-position`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ symbol, size, side }),
  });
  return readHlResponse(res, "Close position failed");
}

export async function cancelHlOrder(
  orderId: string,
  symbol: string,
  token: string,
) {
  const res = await hlFetch(`${BASE}/order/${orderId}?symbol=${symbol}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Cancel failed");
  return json.data;
}

// ── Positions & balances ──────────────────────────────────────────────────────

export async function getHlPositions(userAddress: string, token?: string) {
  const res = await hlFetch(`${BASE}/positions/${userAddress}`, {
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Failed to fetch positions");
  return json.data.positions ?? [];
}

export async function getHlBalances(userAddress: string, token?: string) {
  const res = await hlFetch(`${BASE}/balances/${userAddress}`, {
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Failed to fetch balances");
  return json.data.balances ?? [];
}

/**
 * Whether HL has credited the bridge deposit sent in `arbTxHash`.
 *
 * HL's ledger records a bridge deposit under the Arbitrum tx hash, so this is an
 * exact match. A balance check can't tell: `withdrawable` is net of the margin
 * that open positions hold, so a credited deposit can still leave it below the
 * amount sent.
 */
export async function isHlDepositCredited(
  userAddress: string,
  arbTxHash: string,
  startTime: number,
): Promise<boolean> {
  const res = await hlFetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "userNonFundingLedgerUpdates", user: userAddress, startTime }),
  });
  if (!res.ok) throw new Error("Failed to fetch Hyperliquid ledger");
  const updates: any[] = (await res.json()) ?? [];
  const hash = arbTxHash.toLowerCase();
  return updates.some((u) => u?.delta?.type === "deposit" && String(u.hash).toLowerCase() === hash);
}

// ── Market data ───────────────────────────────────────────────────────────────

export async function getHlTicker(symbol: string) {
  const res = await hlFetch(`${BASE}/ticker/${symbol}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Failed to fetch ticker");
  return json.data;
}

export async function getHlMarkets(): Promise<string[]> {
  const res = await hlFetch(`${BASE}/markets`);
  const json = await res.json();
  return json?.data?.markets ?? [];
}

/** Max leverage per HL perp asset, keyed by upper-cased coin name (e.g. BTC → 40). */
export async function getHlMaxLeverages(): Promise<Record<string, number>> {
  const res = await hlFetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "meta" }),
  });
  if (!res.ok) throw new Error("Failed to fetch Hyperliquid meta");
  const json = await res.json();
  const result: Record<string, number> = {};
  for (const asset of json?.universe ?? []) {
    if (asset?.name && typeof asset.maxLeverage === "number") {
      result[String(asset.name).toUpperCase()] = asset.maxLeverage;
    }
  }
  return result;
}

// ── Smart routing ─────────────────────────────────────────────────────────────

export async function getRoutingRecommendation(
  symbol: string,
  side: "BUY" | "SELL",
  signal?: AbortSignal,
): Promise<HlRoutingInfo | null> {
  try {
    const res = await hlFetch(`${BASE}/routing/${symbol}?side=${side}`, { signal });
    const json = await res.json();
    return json?.data?.routing ?? null;
  } catch {
    return null;
  }
}

// ── Deposit ───────────────────────────────────────────────────────────────────

export async function getCustodyUSDCBalance(userAddress: string, token?: string): Promise<string> {
  const url = token
    ? `${BASE}/usdc-balance`
    : `${BASE}/usdc-balance/${userAddress}`;
  const res = await hlFetch(url, {
    headers: token ? authHeaders(token) : {},
  });
  const json = await res.json();
  if (!json.success) return "0";
  return json.data?.usdc ?? "0";
}

export async function depositToHyperliquid(
  amount: string,
  token: string,
): Promise<{
  txHash: string;
  amountUSDC: string;
  message: string;
  /** Present when the custody wallet needed an ETH top-up to pay for gas first. */
  gasTopUpTxHash?: string;
  /** Id of the Activity row tracking this transfer, absent if recording failed. */
  activityId?: string;
}> {
  const res = await hlFetch(`${BASE}/deposit`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ amount }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Deposit failed");
  return json.data;
}

export interface HlTrade {
  symbol: string;
  side: "BUY" | "SELL";
  price: string;
  size: string;
  fee: string;
  feeToken: string;
  closedPnl: string;
  time: number;
  hash: string;
  orderId?: string;
  dir: string;
  platform: string;
}

export async function getHlTradeHistory(
  userAddress: string,
  startTime?: number,
  token?: string,
): Promise<HlTrade[]> {
  const params = startTime ? `?startTime=${startTime}` : "";
  const res = await hlFetch(`${BASE}/trades/${userAddress}${params}`, {
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (!json.success) return [];
  return json.data?.trades ?? [];
}

export interface HlWithdrawalStatus {
  withdrawalId: string;
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
  step1Status?: "PENDING" | "SUCCESS" | "FAILED";
  step2Status?: "PENDING" | "SUCCESS" | "FAILED";
  amount: string;
  asset: string;
  youReceive?: string;
  step2TxHash?: string;
  errorMessage?: string;
}

export async function withdrawFromHl(
  amount: string,
  token: string,
  destination?: string,
): Promise<{ message: string; withdrawalId?: string }> {
  let res: Response;
  try {
    res = await hlFetch(`${BASE}/withdraw`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ amount, destination }),
    });
  } catch (err) {
    // fetch() only rejects when no HTTP response arrived at all — the request
    // was blocked, the connection dropped, or a proxy killed it. Surfacing the
    // browser's bare "Failed to fetch" here told the user nothing and read like
    // a validation failure, so replace it with something actionable.
    console.error("[HL:withdraw] Request never reached the server:", err);
    throw new Error(
      "Could not reach the PerpX server, so the withdrawal was not submitted. " +
        "Check your connection and try again — if it persists, check Activity " +
        "before retrying so you don't withdraw twice.",
    );
  }

  let json: any;
  try {
    json = await res.json();
  } catch (err) {
    // Non-JSON body means the response came from something other than the API
    // (e.g. an nginx 502/504 error page), so report the status instead of
    // letting a JSON parse error surface.
    throw new Error(
      `The withdrawal request failed (HTTP ${res.status}). Check Activity to see ` +
        `whether it was submitted before retrying.`,
    );
  }

  if (!json.success) throw new Error(json.error ?? "HL withdrawal failed");
  return json.data;
}

/**
 * Status of one submitted withdrawal. Both withdrawal steps run on the server
 * off the request path, so the modal polls this to report the real outcome
 * instead of assuming the submit call succeeding means the funds moved.
 */
export async function getWithdrawalStatus(
  withdrawalId: string,
  token: string,
): Promise<HlWithdrawalStatus | null> {
  const res = await hlFetch(`${BASE}/withdrawal/${withdrawalId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json?.success) return null;
  return json.data ?? null;
}

export async function getActivity(
  token: string,
  limit = 50,
): Promise<any[]> {
  const res = await hlFetch(`${BASE}/activity?limit=${limit}`, {
    headers: authHeaders(token),
  });

  // Throw rather than returning [] on failure. Swallowing the error here made a
  // rejected request indistinguishable from a genuinely empty history, so the
  // Activity panel showed "No deposits or withdrawals yet" when it had in fact
  // failed to load.
  if (!res.ok) {
    throw new Error(`Could not load activity (HTTP ${res.status})`);
  }

  const json = await res.json().catch(() => null);
  if (!json?.success) {
    throw new Error(json?.error ?? "Could not load activity");
  }

  return json.data ?? [];
}

export async function recordDeposit(
  token: string,
  params: {
    amount: string;
    asset: string;
    txHash: string;
    custodyAddress: string;
    type?: "deposit" | "withdrawal";
    destinationAddress?: string;
  },
): Promise<void> {
  const res = await hlFetch(`${BASE}/record-deposit`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error ?? "Failed to record activity");
  }
}

export async function getSupportedVenues(): Promise<
  Array<{ id: string; name: string; enabled: boolean }>
> {
  const res = await hlFetch(`${BASE}/venues`);
  const json = await res.json();
  return json?.data?.venues ?? [];
}
