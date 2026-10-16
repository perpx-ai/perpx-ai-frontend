import { gql, ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";

import { getStoredAuthToken } from "lib/api/authSession";
import { BACKEND_GRAPHQL_URL } from "config/perpx";

const httpLink = createHttpLink({
  uri: BACKEND_GRAPHQL_URL,
});

const authLink = setContext((_, { headers }) => {
  // Read through the session store so an expired token is dropped rather than sent.
  const token = getStoredAuthToken();
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

export const arenaClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: "cache-and-network" },
  },
});

export const GET_ARENA_BLOCK_STATUS = gql`
  query ArenaBlockStatus {
    arenaBlockStatus {
      blocked
      raffleEnabled
      season
      lastEndedSeason {
        seasonId
        label
        endsAt
      }
    }
  }
`;

export type ArenaBlockStatus = {
  blocked: boolean;
  raffleEnabled: boolean;
  season: string;
  lastEndedSeason: {
    seasonId: string;
    label: string;
    endsAt: string;
  } | null;
};

export const GET_ARENA_STATE = gql`
  query ArenaUserState($address: String!) {
    arenaUserState(address: $address) {
      address
      season
      totalXP
      level
      tier
      xpIntoLevel
      xpPerLevel
      letters
      word
      wordCompletedCount
      raffleTickets
      raffleCreditUsdc
    }
  }
`;

export const GET_ARENA_QUESTS = gql`
  query ArenaQuests($address: String!) {
    arenaQuests(address: $address) {
      key
      kind
      title
      description
      reward {
        xp
        raffleTickets
        letters
      }
      target {
        volumeUsd
        pnlUsd
        tweetUrl
        telegramUrl
      }
      status
      progress
      lastClaimedAt
    }
  }
`;

export const GET_TWITTER_LINKED = gql`
  query ArenaTwitterLinked($address: String!) {
    arenaTwitterLinked(address: $address) {
      connected
      username
    }
  }
`;

export const GET_TELEGRAM_LINKED = gql`
  query ArenaTelegramLinked($address: String!) {
    arenaTelegramLinked(address: $address)
  }
`;

export const GET_DISCORD_LINKED = gql`
  query ArenaDiscordLinked($address: String!) {
    arenaDiscordLinked(address: $address) {
      connected
      username
    }
  }
`;

export const CLAIM_QUEST = gql`
  mutation ArenaClaimQuest($address: String!, $questKey: String!, $ctx: String) {
    arenaClaimQuest(address: $address, questKey: $questKey, ctx: $ctx) {
      address
      totalXP
      level
      tier
      xpIntoLevel
      xpPerLevel
      letters
      wordCompletedCount
      raffleTickets
      raffleCreditUsdc
    }
  }
`;

export const SPIN_RAFFLE = gql`
  mutation ArenaSpinRaffle($address: String!) {
    arenaSpinRaffle(address: $address) {
      segmentIndex
      prizeUsdc
      wheel
      drawId
      state {
        totalXP
        level
        raffleTickets
        raffleCreditUsdc
      }
    }
  }
`;

export const GET_ARENA_BATCH = gql`
  query ArenaBatchStates($addresses: [String!]!) {
    arenaBatchStates(addresses: $addresses) {
      address
      level
      tier
      letters
      raffleTickets
    }
  }
`;

export type ArenaBatchState = {
  address: string;
  level: number;
  tier: number;
  letters: string[];
  raffleTickets: number;
};

export const GET_ARENA_BADGES = gql`
  query ArenaBadges($address: String!) {
    arenaBadges(address: $address) {
      key
      title
      description
      emoji
      rarity
      earned
      earnedAt
    }
  }
`;

export type ArenaBadge = {
  key: string;
  title: string;
  description: string;
  emoji: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  earned: boolean;
  earnedAt: string | null;
};

export const GET_ARENA_LEADERBOARD = gql`
  query ArenaLeaderboard($kind: String!, $address: String) {
    arenaLeaderboard(kind: $kind, address: $address) {
      kind
      rewardZoneSize
      entries {
        rank
        address
        displayValue
        rawValue
        todayDelta
        xp
        estimatedReward
        barPct
      }
      me {
        rank
        address
        displayValue
        rawValue
        todayDelta
        xp
        estimatedReward
        barPct
        spotsToRewardZone
        valueToRewardZone
      }
    }
  }
`;

export type ArenaLeaderboardEntry = {
  rank: number;
  address: string;
  displayValue: string;
  rawValue: number;
  todayDelta: string | null;
  xp: number;
  estimatedReward: string;
  barPct: number;
  spotsToRewardZone?: number | null;
  valueToRewardZone?: string | null;
};

export type ArenaLeaderboardData = {
  kind: string;
  entries: ArenaLeaderboardEntry[];
  me: ArenaLeaderboardEntry | null;
  rewardZoneSize: number;
};

export const GET_ARENA_VOLUME_PROGRESS = gql`
  query ArenaVolumeProgress($address: String!) {
    arenaVolumeProgress(address: $address) {
      title
      description
      enabled
      monthlyVolumeUsd
      targetVolumeUsd
      percentage
      milestones {
        threshold
        label
        rewardDisplay
        completed
        isCurrent
      }
    }
  }
`;

export type ArenaVolumeMilestone = {
  threshold: number;
  label: string;
  rewardDisplay: string;
  completed: boolean;
  isCurrent: boolean;
};

export type ArenaVolumeProgress = {
  title: string;
  description: string;
  enabled: boolean;
  monthlyVolumeUsd: number;
  targetVolumeUsd: number;
  percentage: number;
  milestones: ArenaVolumeMilestone[];
};

export const GET_ARENA_SEASON_INFO = gql`
  query ArenaSeasonInfo($address: String) {
    arenaSeasonInfo(address: $address) {
      seasonId
      label
      startsAt
      endsAt
      prizePool
      daysRemaining
      participants
      currentRank
    }
  }
`;

export type ArenaSeasonInfo = {
  seasonId: string;
  label: string;
  startsAt: string;
  endsAt: string;
  prizePool: number;
  daysRemaining: number;
  participants: number;
  currentRank: number | null;
};

export const TRACK_EVENT = gql`
  mutation ArenaTrackEvent($address: String, $eventType: String!) {
    arenaTrackEvent(address: $address, eventType: $eventType)
  }
`;

export type ArenaUserState = {
  address: string;
  season: string;
  totalXP: number;
  level: number;
  tier: number;
  xpIntoLevel: number;
  xpPerLevel: number;
  letters: string[];
  word: string;
  wordCompletedCount: number;
  raffleTickets: number;
  raffleCreditUsdc: number;
};

export type CommunitySubmission = {
  submissionId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote?: string;
  imageUrl?: string;
  caption?: string;
} | null;

export type ArenaQuest = {
  key: string;
  kind:
    | "DAILY_CHECKIN"
    | "SOCIAL_TWITTER"
    | "SOCIAL_TELEGRAM"
    | "SOCIAL_DISCORD"
    | "TIME_ATTACK"
    | "LEVEL_UP"
    | "STAKING"
    | "DAILY_TRADE_ASSET"
    | "DAILY_TRADE_VOLUME"
    | "DAILY_TRADE_COUNT"
    | "DAILY_TRADE_BOTH_SIDES"
    | "DAILY_TRADE_PROFIT"
    | "DAILY_TRADE_DIVERSITY"
    | "DAILY_TRADE_HIGH_STAKES"
    | "DAILY_TRADE_SPEED"
    | "DAILY_COMMENT_TWITTER"
    | "COMMUNITY_PHOTO";
  title: string;
  description: string;
  reward: { xp: number; raffleTickets?: number; letters?: string[] };
  target?: {
    volumeUsd?: number;
    pnlUsd?: number;
    tweetUrl?: string;
    telegramUrl?: string;
    discordUrl?: string;
    communityPrompt?: string;
  };
  status: "PENDING" | "VERIFYING" | "CLAIMABLE" | "CLAIMED" | "FAILED";
  progress: number;
  lastClaimedAt: string | null;
  isDynamic?: boolean;
  activeDate?: string | null;
  refreshesAt?: string | null;
  communitySubmission?: CommunitySubmission;
};
