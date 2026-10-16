import { arbitrumSepolia, base } from "viem/chains";

import {
  AnyChainId,
  ARBITRUM,
  ARBITRUM_SEPOLIA,
  AVALANCHE,
  AVALANCHE_FUJI,
  BOTANIX,
  getExplorerUrl,
  SOURCE_BASE_MAINNET,
  SOURCE_BSC_MAINNET,
  SOURCE_OPTIMISM_SEPOLIA,
  SOURCE_SEPOLIA,
} from "config/chains";

export const CHAIN_ID_TO_TX_URL_BUILDER: Record<
  AnyChainId | "layerzero" | "layerzero-testnet",
  (txId: string) => string
> = {
  [ARBITRUM]: (txId: string) => `${getExplorerUrl(ARBITRUM)}tx/${txId}`,
  [AVALANCHE]: (txId: string) => `${getExplorerUrl(AVALANCHE)}tx/${txId}`,
  [SOURCE_BASE_MAINNET]: (txId: string) => `${getExplorerUrl(SOURCE_BASE_MAINNET)}tx/${txId}`,
  [SOURCE_OPTIMISM_SEPOLIA]: (txId: string) => `${getExplorerUrl(SOURCE_OPTIMISM_SEPOLIA)}tx/${txId}`,
  [ARBITRUM_SEPOLIA]: (txId: string) => `${getExplorerUrl(ARBITRUM_SEPOLIA)}tx/${txId}`,
  [AVALANCHE_FUJI]: (txId: string) => `${getExplorerUrl(AVALANCHE_FUJI)}tx/${txId}`,
  [SOURCE_SEPOLIA]: (txId: string) => `${getExplorerUrl(SOURCE_SEPOLIA)}tx/${txId}`,
  [BOTANIX]: (txId: string) => `${getExplorerUrl(BOTANIX)}tx/${txId}`,
  [SOURCE_BSC_MAINNET]: (txId: string) => `${getExplorerUrl(SOURCE_BSC_MAINNET)}tx/${txId}`,
  layerzero: (txId: string) => `${getExplorerUrl("layerzero")}tx/${txId}`,
  "layerzero-testnet": (txId: string) => `${getExplorerUrl("layerzero-testnet")}tx/${txId}`,
};

/**
 * Hyperliquid's L1 is not an EVM chain and has no entry in `AnyChainId`, so it gets its own
 * builder rather than being forced into the maps above.
 *
 * Bridging USDC produces *two* unrelated hashes — the Arbitrum transfer to the bridge, and
 * the HL credit. Sending one to the other's explorer yields a confident-looking dead link,
 * so keep both builders side by side and pick deliberately.
 */
export const HYPERLIQUID_EXPLORER_NAME = "Hyperliquid Explorer";

export function buildHyperliquidTxUrl(txId: string): string {
  return `https://app.hyperliquid.xyz/explorer/tx/${txId}`;
}

export const CHAIN_ID_TO_EXPLORER_NAME: Record<AnyChainId, string> = {
  [ARBITRUM]: "Arbiscan",
  [AVALANCHE]: "Snowtrace",
  [AVALANCHE_FUJI]: "Snowtrace",
  [ARBITRUM_SEPOLIA]: arbitrumSepolia.blockExplorers.default.name,
  [SOURCE_BASE_MAINNET]: base.blockExplorers.default.name,
  [SOURCE_OPTIMISM_SEPOLIA]: "OP Sepolia Etherscan",
  [SOURCE_SEPOLIA]: "Sepolia Etherscan",
  [BOTANIX]: "Botanix Explorer",
  [SOURCE_BSC_MAINNET]: "BSC Scan",
};
