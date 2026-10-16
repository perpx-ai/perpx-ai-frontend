import { ARBITRUM, ARBITRUM_SEPOLIA, AVALANCHE, AVALANCHE_FUJI, BOTANIX, ETH_MAINNET } from "./chains";
import { isDevelopment } from "./env";
import { getSubgraphUrlKey } from "./localStorage";

const SUBGRAPH_URLS = {
  [ARBITRUM]: {
    nissohVault: "https://api.thegraph.com/subgraphs/name/nissoh/gmx-vault",
    stats: "https://subgraph.satsuma-prod.com/3b2ced13c8d9/gmx/synthetics-arbitrum-stats/api",
    syntheticsStats: "https://subgraph.satsuma-prod.com/3b2ced13c8d9/gmx/synthetics-arbitrum-stats/api",
    subsquid: "https://gmx.squids.live/gmx-synthetics-arbitrum/graphql",
    referrals: "https://subgraph.satsuma-prod.com/3b2ced13c8d9/gmx/gmx-arbitrum-referrals/api",
  },

  [AVALANCHE]: {
    subsquid: "https://gmx.squids.live/gmx-synthetics-avalanche/graphql",
    syntheticsStats: "https://subgraph.satsuma-prod.com/3b2ced13c8d9/gmx/synthetics-avalanche-stats/api",
  },

  [AVALANCHE_FUJI]: {
    stats: "https://api.thegraph.com/subgraphs/name/gmx-io/gmx-avalanche-stats",
    subsquid: "https://gmx.squids.live/gmx-synthetics-fuji/graphql",
  },

  [ARBITRUM_SEPOLIA]: {
    subsquid: "https://gmx.squids.live/gmx-synthetics-arbitrum-sepolia/graphql",
  },

  [BOTANIX]: {},

  common: {
    [ETH_MAINNET]: {
      chainLink: "https://api.thegraph.com/subgraphs/name/deividask/chainlink",
    },
  },
};

export function getSubgraphUrl(
  chainId: number,
  subgraph: "stats" | "referrals" | "nissohVault" | "syntheticsStats" | "subsquid" | "chainLink"
): string | undefined {
  if (isDevelopment()) {
    const localStorageKey = getSubgraphUrlKey(chainId, subgraph);
    const url = localStorage.getItem(localStorageKey);
    if (url) {
      // eslint-disable-next-line no-console
      console.warn("%s subgraph on chain %s url is overriden: %s", subgraph, chainId, url);
      return url;
    }
  }

  if (chainId === ETH_MAINNET) {
    return SUBGRAPH_URLS.common[ETH_MAINNET]?.[subgraph];
  }

  return SUBGRAPH_URLS?.[chainId]?.[subgraph];
}
