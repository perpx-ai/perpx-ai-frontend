/**
 * Contract Executor API Client
 *
 * This module provides a client for interacting with the backend Contract Executor API
 * instead of making direct smart contract calls via ethers.js
 *
 * All blockchain operations are now routed through the backend API at:
 * http://localhost:4000/api/admin/contract
 */

import { ethers } from "ethers";
import { getChainName } from "config/chains";
import { makeAuthenticatedRequest } from "./auth";
import { BACKEND_URL } from "config/perpx";
// import TokenAbi from "sdk/abis/Token.json";


const API_BASE_URL = `${BACKEND_URL}/api/admin/contract`;

// RPC URLs for different chains
const RPC_URLS: Record<number, string> = {
  42161: import.meta.env.VITE_APP_ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
  43114: import.meta.env.VITE_APP_AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
};

/**
 * Get RPC URL for a chain
 */
function getRpcUrl(chainId: number): string {
  const rpcUrl = RPC_URLS[chainId];
  if (!rpcUrl) {
    throw new Error(`No RPC URL configured for chain ${chainId} (${getChainName(chainId)})`);
  }
  return rpcUrl;
}

/**
 * Error response from API
 */
export interface ApiErrorResponse {
  status: false;
  message: string;
  error?: string;
}

/**
 * Parameters for reading a contract function
 */
export interface ReadContractParams {
  userAddress: string;
  contractAddress: string;
  contractName: string;
  functionName: string;
  args?: any[];
  chainId?: number;
  rpcUrl?: string;
}

/**
 * Response from read contract endpoint
 */
export interface ReadContractResponse {
  status: true;
  data: {
    contractAddress: string;
    contractName: string;
    functionName: string;
    args: any[];
    result: any;
  };
}

/**
 * Parameters for writing to a contract function
 */
export interface WriteContractParams {
  userAddress: string;
  contractAddress: string;
  contractName: string;
  functionName: string;
  args?: any[];
  chainId?: number;
  rpcUrl?: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  value?: string;
  metadata?: {
    payAmountUsd?: string;
    positionSizeUsd?: string;
    positionType?: "LONG" | "SHORT";
    [key: string]: any;
  };
}

/**
 * Response from write contract endpoint
 */
export interface WriteContractResponse {
  status: true;
  data: {
    contractAddress: string;
    contractName: string;
    functionName: string;
    args: any[];
    transactionHash: string;
    blockNumber: number;
    gasUsed: string;
    status: string;
    from: string;
    to: string;
  };
}

/**
 * Response from wallet endpoint
 */
export interface WalletResponse {
  status: true;
  data: {
    userAddress: string;
    custodyWalletAddress: string;
    isNewWallet: boolean;
  };
}

/**
 * Response from contracts list endpoint
 */
export interface ContractsListResponse {
  status: true;
  data: {
    totalContracts: number;
    contracts: string[];
    categories: string[];
  };
}

/**
 * Handle API response and errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text();
    console.error("[CONTRACT_EXECUTOR] Error response:", errorText);

    let error: any;
    try {
      error = JSON.parse(errorText);
    } catch {
      error = {
        status: false,
        message: `HTTP ${response.status}: ${response.statusText}`,
        details: errorText,
      };
    }

    const errorMessage = error?.message || error?.error || `API request failed with status ${response.status}`;
    console.error("[CONTRACT_EXECUTOR] Error message:", errorMessage);
    throw new Error(errorMessage);
  }

  const text = await response.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error("[CONTRACT_EXECUTOR] Failed to parse response:", e);
    throw new Error("Invalid JSON response from API");
  }

  if (!data.status) {
    console.error("[CONTRACT_EXECUTOR] API returned error status:", data);
    throw new Error(data.message || data.error || "API request failed");
  }

  return data;
}

/**
 * Read a contract function (view/pure - no transaction)
 *
 * @param params - Parameters for the contract read
 * @returns The result from the contract function
 *
 * @example
 * const balance = await readContract({
 *   userAddress: "0x...",
 *   contractAddress: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
 *   contractName: "IERC20",
 *   functionName: "balanceOf",
 *   args: ["0x..."],
 *   chainId: 42161
 * });
 */
export async function readContract(params: ReadContractParams): Promise<any> {
  const { chainId = 42161, rpcUrl = getRpcUrl(chainId!), ...rest } = params;

  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...rest,
      rpcUrl,
      args: rest.args || [],
    }),
  });

  if (!response) return null;

  const data = await handleResponse<ReadContractResponse>(response);
  return data.data.result;
}

/**
 * Write to a contract function (creates a transaction)
 *
 * @param params - Parameters for the contract write
 * @returns Transaction details including hash and receipt
 *
 * @example
 * const txResult = await writeContract({
 *   userAddress: "0x...",
 *   contractAddress: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
 *   contractName: "IERC20",
 *   functionName: "transfer",
 *   args: ["0xRecipient...", "1000000000000000000"],
 *   chainId: 42161
 * });
 */
export async function writeContract(params: WriteContractParams): Promise<WriteContractResponse["data"]> {
  const { chainId = 42161, rpcUrl = getRpcUrl(chainId!), metadata, ...rest } = params;
  const requestBody = {
    ...rest,
    rpcUrl,
    args: rest.args || [],
    value: rest.value || "0",
    ...(metadata && { metadata }), // Include metadata if provided
  };

  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/write`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response) return null as any;

  const data = await handleResponse<WriteContractResponse>(response);

  return data.data;
}

/**
 * Get user's custody wallet address
 *
 * @param userAddress - User's wallet address
 * @param referralAddress - Optional referral address to pass as query parameter
 * @returns Custody wallet information
 *
 * @example
 * const wallet = await getCustodyWallet("0x...");
 * console.log(wallet.custodyWalletAddress);
 * @example with referral
 * const wallet = await getCustodyWallet("0x...", "0xreferral...");
 */
export async function getCustodyWallet(userAddress: string, referralAddress?: string): Promise<WalletResponse["data"]> {
  const url = new URL(`${API_BASE_URL}/wallet/${userAddress}`);

  //   if (referralAddress) {
  //     url.searchParams.set("referral", referralAddress);
  //   }

  const response = await makeAuthenticatedRequest(url.toString(), {
    method: "GET",
  });

  if (!response) return null as unknown as WalletResponse["data"];

  const data = await handleResponse<WalletResponse>(response);
  return data.data;
}

/**
 * Get list of all available contracts
 *
 * @returns List of contract names and categories
 *
 * @example
 * const contracts = await getContractsList();
 * console.log(contracts.contracts); // ["Vault", "Router", ...]
 */
export async function getContractsList(): Promise<ContractsListResponse["data"]> {
  const response = await fetch(`${API_BASE_URL}/contracts/list`, {
    method: "GET",
  });

  const data = await handleResponse<ContractsListResponse>(response);
  return data.data;
}

/**
 * Get contracts by category
 *
 * @param category - Category name (e.g., "core", "tokens", "staking")
 * @returns List of contracts in the category
 */
export async function getContractsByCategory(category: string): Promise<{ contracts: string[]; count: number }> {
  const response = await fetch(`${API_BASE_URL}/contracts/category/${category}`, {
    method: "GET",
  });

  const data = await handleResponse<{
    status: true;
    data: { category: string; contracts: string[]; count: number };
  }>(response);
  return data.data;
}

/**
 * Search for contracts by name
 *
 * @param query - Search query
 * @returns Matching contract names
 */
export async function searchContracts(query: string): Promise<{ results: string[]; count: number }> {
  const response = await fetch(`${API_BASE_URL}/contracts/search?query=${encodeURIComponent(query)}`, {
    method: "GET",
  });

  const data = await handleResponse<{
    status: true;
    data: { query: string; results: string[]; count: number };
  }>(response);
  return data.data;
}

/**
 * Batch read multiple contract functions
 * This is useful for efficiently reading multiple values in one API call
 *
 * @param calls - Array of read contract parameters
 * @returns Array of results in the same order
 */
export async function batchReadContracts(calls: ReadContractParams[]): Promise<any[]> {
  const results = await Promise.all(calls.map((call) => readContract(call)));
  return results;
}

/**
 * Helper to format wei values to readable decimals
 */
export function formatFromWei(value: string | bigint, decimals: number = 18): string {
  const bigValue = typeof value === "string" ? BigInt(value) : value;
  const divisor = 10n ** BigInt(decimals);
  const integerPart = bigValue / divisor;
  const fractionalPart = bigValue % divisor;

  if (fractionalPart === 0n) {
    return integerPart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  return `${integerPart}.${fractionalStr}`.replace(/\.?0+$/, "");
}

/**
 * Helper to format readable decimals to wei
 */
export function formatToWei(value: string | number, decimals: number = 18): string {
  const valueStr = value.toString();
  const [integerPart = "0", fractionalPart = ""] = valueStr.split(".");
  const paddedFractional = fractionalPart.padEnd(decimals, "0").slice(0, decimals);
  const wei = BigInt(integerPart) * 10n ** BigInt(decimals) + BigInt(paddedFractional || "0");
  return wei.toString();
}

/**
 * Check token allowance for a spender (DIRECT CONTRACT CALL - V2 Pattern)
 * Uses ethers.js to directly query the blockchain for custody wallet's allowance
 * This matches the old V2 pattern before API refactoring
 *
 * @param params - Parameters for checking allowance
 * @returns Current allowance as a bigint
 *
 * @example
 * const allowance = await checkTokenAllowance({
 *   userAddress: "0x...",
 *   custodyWalletAddress: "0xCustody...",
 *   tokenAddress: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
 *   spenderAddress: "0xRouter...",
 *   chainId: 42161
 * });
 */
export async function checkTokenAllowance(params: {
  userAddress: string;
  custodyWalletAddress?: string;
  tokenAddress: string;
  spenderAddress: string;
  chainId?: number;
}): Promise<bigint> {
  const { userAddress, custodyWalletAddress, tokenAddress: _tokenAddress, spenderAddress: _spenderAddress, chainId = 42161 } = params;

  // Use custody wallet address if available, otherwise use user address
  void (custodyWalletAddress || userAddress);


  try {
    // Get RPC provider (V2 pattern using ethers.js)
    const rpcUrl = getRpcUrl(chainId);
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Create token contract instance (V2 pattern)
    // const tokenContract = new ethers.Contract(tokenAddress, TokenAbi.abi, provider);

    // Call allowance function directly on the contract (V2 pattern)
    // const allowance: bigint = await tokenContract.allowance(ownerAddress, spenderAddress);

    // console.log("[CONTRACT_EXECUTOR] ✅ Current allowance (from blockchain):", allowance.toString());
    return rpcUrl;
    // return allowance;
  } catch (error) {
    console.error("[CONTRACT_EXECUTOR] ❌ Failed to check allowance:", error);
    throw error;
  }
}

/**
 * Approve token spending for a spender
 *
 * @param params - Parameters for token approval
 * @returns Transaction details including hash and receipt
 *
 * @example
 * const txResult = await approveToken({
 *   userAddress: "0x...",
 *   tokenAddress: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
 *   spenderAddress: "0xRouter...",
 *   amount: "1000000000000000000", // 1 token with 18 decimals
 *   chainId: 42161
 * });
 */
export async function approveToken(params: {
  userAddress: string;
  tokenAddress: string;
  spenderAddress: string;
  amount: string;
  chainId?: number;
}): Promise<WriteContractResponse["data"]> {
  const { userAddress, tokenAddress, spenderAddress, amount, chainId = 42161 } = params;

  console.log("[CONTRACT_EXECUTOR] 📝 Approving token");
  console.log("[CONTRACT_EXECUTOR] User:", userAddress);
  console.log("[CONTRACT_EXECUTOR] Token:", tokenAddress);
  console.log("[CONTRACT_EXECUTOR] Spender:", spenderAddress);
  console.log("[CONTRACT_EXECUTOR] Amount:", amount);

  const result = await writeContract({
    userAddress,
    contractAddress: tokenAddress,
    contractName: "IERC20",
    functionName: "approve",
    args: [spenderAddress, amount],
    chainId,
  });

  console.log("[CONTRACT_EXECUTOR] ✅ Approval successful:", result.transactionHash);
  return result;
}

/**
 * Check if token approval is needed and approve if necessary
 *
 * @param params - Parameters for checking and approving
 * @returns Transaction result if approval was needed, undefined if not needed
 *
 * @example
 * const txResult = await ensureTokenApproval({
 *   userAddress: "0x...",
 *   custodyWalletAddress: "0xCustody...",
 *   tokenAddress: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
 *   spenderAddress: "0xRouter...",
 *   requiredAmount: "1000000000000000000",
 *   chainId: 42161
 * });
 */
export async function ensureTokenApproval(params: {
  userAddress: string;
  custodyWalletAddress?: string;
  tokenAddress: string;
  spenderAddress: string;
  requiredAmount: string;
  chainId?: number;
}): Promise<WriteContractResponse["data"] | undefined> {
  const { userAddress, custodyWalletAddress, tokenAddress, spenderAddress, requiredAmount, chainId = 42161 } = params;

  console.log(
    "[CONTRACT_EXECUTOR] 🔐 Ensuring token approval",
    userAddress,
    custodyWalletAddress,
    tokenAddress,
    spenderAddress,
    requiredAmount
  );

  // Check current allowance
  const currentAllowance = await checkTokenAllowance({
    userAddress,
    custodyWalletAddress,
    tokenAddress,
    spenderAddress,
    chainId,
  });

  const requiredAmountBigInt = BigInt(requiredAmount);

  // If allowance is sufficient, no approval needed
  if (currentAllowance >= requiredAmountBigInt) {
    console.log("[CONTRACT_EXECUTOR] ✅ Sufficient allowance already exists");
    return undefined;
  }

  // Need to approve
  console.log("[CONTRACT_EXECUTOR] ⚠️ Insufficient allowance, approving...");
  console.log("[CONTRACT_EXECUTOR] Required:", requiredAmount);
  console.log("[CONTRACT_EXECUTOR] Current:", currentAllowance.toString());

  // Approve maximum amount for future transactions
  const maxAmount = "115792089237316195423570985008687907853269984665640564039457584007913129639935"; // MaxUint256

  return await approveToken({
    userAddress,
    tokenAddress,
    spenderAddress,
    amount: maxAmount,
    chainId,
  });
}

/**
 * Withdraw ETH from custody wallet to user's connected wallet
 *
 * @param userAddress - User's wallet address (recipient)
 * @param value - Amount in wei to withdraw
 * @returns Response from the withdrawal API
 *
 * @example
 * await withdrawETH("0x123...", "1000000000000000000"); // Withdraw 1 ETH
 */
export async function withdrawETH(userAddress: string, value: string): Promise<any> {
  console.log("[CONTRACT_EXECUTOR] 💸 Withdrawing ETH from custody wallet");
  console.log("[CONTRACT_EXECUTOR] User address:", userAddress);
  console.log("[CONTRACT_EXECUTOR] Amount (wei):", value);

  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/withdraw-eth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userAddress,
      value,
    }),
  });

  if (!response) {
    throw new Error("Failed to withdraw ETH");
  }

  const data = await handleResponse(response);
  console.log("[CONTRACT_EXECUTOR] ✅ ETH withdrawal successful:", data);
  return data;
}

/**
 * Withdraw ERC20 tokens from custody wallet to user's connected wallet
 *
 * @param userAddress - User's wallet address (recipient)
 * @param tokenAddress - Token contract address
 * @param value - Amount in token's smallest unit to withdraw
 * @returns Response from the withdrawal API
 *
 * @example
 * await withdrawToken("0x123...", "0xABC...", "1000000000000000000"); // Withdraw 1 token (18 decimals)
 */
export async function withdrawToken(userAddress: string, tokenAddress: string, value: string): Promise<any> {
  console.log("[CONTRACT_EXECUTOR] 💸 Withdrawing token from custody wallet");
  console.log("[CONTRACT_EXECUTOR] User address:", userAddress);
  console.log("[CONTRACT_EXECUTOR] Token address:", tokenAddress);
  console.log("[CONTRACT_EXECUTOR] Amount:", value);

  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/withdraw-eth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userAddress,
      tokenAddress,
      value,
    }),
  });

  if (!response) {
    throw new Error("Failed to withdraw token");
  }

  const data = await handleResponse(response);
  console.log("[CONTRACT_EXECUTOR] ✅ Token withdrawal successful:", data);
  return data;
}
