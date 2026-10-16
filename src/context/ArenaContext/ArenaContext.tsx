import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import useWallet from "lib/wallets/useWallet";
import { helperToast } from "lib/helperToast";
import {
  arenaClient,
  GET_ARENA_STATE,
  GET_ARENA_QUESTS,
  GET_ARENA_BLOCK_STATUS,
  GET_ARENA_SEASON_INFO,
  GET_ARENA_VOLUME_PROGRESS,
  CLAIM_QUEST,
  SPIN_RAFFLE,
  TRACK_EVENT,
  GET_TELEGRAM_LINKED,
  GET_TWITTER_LINKED,
  GET_DISCORD_LINKED,
  ArenaUserState,
  ArenaQuest,
  ArenaBlockStatus,
  ArenaSeasonInfo,
  ArenaVolumeProgress,
} from "domain/arena";
import { prettifyArenaError } from "domain/arena/errors";

export type ClaimOutcome = {
  success: boolean;
  message: string;
  reward?: ArenaQuest["reward"];
};

type ArenaContextValue = {
  state: ArenaUserState | null;
  quests: ArenaQuest[];
  loading: boolean;
  error: string | null;
  blockStatus: ArenaBlockStatus | null;
  seasonInfo: ArenaSeasonInfo | null;
  volumeProgress: ArenaVolumeProgress | null;
  telegramLinked: boolean;
  twitterLinked: { connected: boolean; username: string | null };
  discordLinked: { connected: boolean; username: string | null };
  refresh: () => Promise<void>;
  refreshTelegramLinked: () => Promise<void>;
  refreshTwitterLinked: () => Promise<void>;
  refreshDiscordLinked: () => Promise<void>;
  claimQuest: (questKey: string, ctx?: Record<string, any>) => Promise<ClaimOutcome>;
  spinRaffle: () => Promise<{ segmentIndex: number; prizeUsdc: number; wheel: number[] } | null>;
  trackEvent: (eventType: string) => void;
};

const ArenaContext = createContext<ArenaContextValue | null>(null);

export function ArenaContextProvider({ children }: { children: React.ReactNode }) {
  const { account } = useWallet();
  const [state, setState] = useState<ArenaUserState | null>(null);
  const [quests, setQuests] = useState<ArenaQuest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockStatus, setBlockStatus] = useState<ArenaBlockStatus | null>(null);
  const [seasonInfo, setSeasonInfo] = useState<ArenaSeasonInfo | null>(null);
  const [volumeProgress, setVolumeProgress] = useState<ArenaVolumeProgress | null>(null);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [twitterLinked, setTwitterLinked] = useState<{ connected: boolean; username: string | null }>({ connected: false, username: null });
  const [discordLinked, setDiscordLinked] = useState<{ connected: boolean; username: string | null }>({ connected: false, username: null });

  const refreshTelegramLinked = useCallback(async () => {
    if (!account) {
      setTelegramLinked(false);
      return;
    }
    try {
      const res = await arenaClient.query({
        query: GET_TELEGRAM_LINKED,
        variables: { address: account.toLowerCase() },
        fetchPolicy: "network-only",
      });
      setTelegramLinked(res.data.arenaTelegramLinked);
    } catch {
      setTelegramLinked(false);
    }
  }, [account]);

  const refreshTwitterLinked = useCallback(async () => {
    if (!account) {
      setTwitterLinked({ connected: false, username: null });
      return;
    }
    try {
      const res = await arenaClient.query({
        query: GET_TWITTER_LINKED,
        variables: { address: account.toLowerCase() },
        fetchPolicy: "network-only",
      });
      setTwitterLinked(res.data.arenaTwitterLinked);
    } catch {
      setTwitterLinked({ connected: false, username: null });
    }
  }, [account]);

  const refreshDiscordLinked = useCallback(async () => {
    if (!account) {
      setDiscordLinked({ connected: false, username: null });
      return;
    }
    try {
      const res = await arenaClient.query({
        query: GET_DISCORD_LINKED,
        variables: { address: account.toLowerCase() },
        fetchPolicy: "network-only",
      });
      setDiscordLinked(res.data.arenaDiscordLinked);
    } catch {
      setDiscordLinked({ connected: false, username: null });
    }
  }, [account]);

  const refresh = useCallback(async () => {
    // Always fetch block status + season info (even without wallet)
    try {
      const [bs, si] = await Promise.all([
        arenaClient.query({ query: GET_ARENA_BLOCK_STATUS, fetchPolicy: "network-only" }),
        arenaClient.query({
          query: GET_ARENA_SEASON_INFO,
          variables: { address: account?.toLowerCase() ?? null },
          fetchPolicy: "network-only",
        }),
      ]);
      setBlockStatus(bs.data.arenaBlockStatus);
      setSeasonInfo(si.data.arenaSeasonInfo);
    } catch {
      setBlockStatus(null);
      setSeasonInfo(null);
    }

    if (!account) {
      setState(null);
      setQuests([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [s, q, vp] = await Promise.all([
        arenaClient.query({
          query: GET_ARENA_STATE,
          variables: { address: account.toLowerCase() },
          fetchPolicy: "network-only",
        }),
        arenaClient.query({
          query: GET_ARENA_QUESTS,
          variables: { address: account.toLowerCase() },
          fetchPolicy: "network-only",
        }),
        arenaClient.query({
          query: GET_ARENA_VOLUME_PROGRESS,
          variables: { address: account.toLowerCase() },
          fetchPolicy: "network-only",
        }),
      ]);
      setState(s.data.arenaUserState);
      setQuests(q.data.arenaQuests);
      setVolumeProgress(vp.data.arenaVolumeProgress);
      refreshTelegramLinked();
      refreshTwitterLinked();
      refreshDiscordLinked();
    } catch (e: any) {
      setError(prettifyArenaError(e));
    } finally {
      setLoading(false);
    }
  }, [account, refreshTelegramLinked, refreshTwitterLinked, refreshDiscordLinked]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const claimQuest = useCallback(
    async (questKey: string, ctx?: Record<string, any>): Promise<ClaimOutcome> => {
      if (!account) {
        const m = "Connect your wallet first.";
        helperToast.error(m);
        return { success: false, message: m };
      }
      try {
        await arenaClient.mutate({
          mutation: CLAIM_QUEST,
          variables: {
            address: account.toLowerCase(),
            questKey,
            ctx: ctx ? JSON.stringify(ctx) : undefined,
          },
        });
        const reward = quests.find((q) => q.key === questKey)?.reward;
        const parts: string[] = [];
        if (reward?.xp) parts.push(`+${reward.xp} XP`);
        if (reward?.raffleTickets) parts.push(`+${reward.raffleTickets} 🎟`);
        if (reward?.letters?.length) parts.push(`+${reward.letters.join(" ")}`);
        const message = parts.length ? `Quest claimed · ${parts.join(" · ")}` : "Quest claimed!";
        helperToast.success(message);
        await refresh();
        return { success: true, message, reward };
      } catch (e: any) {
        const message = prettifyArenaError(e);
        helperToast.error(message);
        setError(null);
        return { success: false, message };
      }
    },
    [account, refresh, quests]
  );

  const spinRaffle = useCallback(async () => {
    if (!account) return null;
    try {
      const res = await arenaClient.mutate({
        mutation: SPIN_RAFFLE,
        variables: { address: account.toLowerCase() },
      });
      const data = res.data.arenaSpinRaffle;
      await refresh();
      return { segmentIndex: data.segmentIndex, prizeUsdc: data.prizeUsdc, wheel: data.wheel };
    } catch (e: any) {
      const msg = prettifyArenaError(e);
      helperToast.error(msg);
      return null;
    }
  }, [account, refresh]);

  const trackEvent = useCallback(
    (eventType: string) => {
      arenaClient
        .mutate({
          mutation: TRACK_EVENT,
          variables: { address: account?.toLowerCase(), eventType },
        })
        .catch(() => void 0);
    },
    [account]
  );

  const value = useMemo<ArenaContextValue>(
    () => ({ state, quests, loading, error, blockStatus, seasonInfo, volumeProgress, telegramLinked, twitterLinked, discordLinked, refresh, refreshTelegramLinked, refreshTwitterLinked, refreshDiscordLinked, claimQuest, spinRaffle, trackEvent }),
    [state, quests, loading, error, blockStatus, seasonInfo, volumeProgress, telegramLinked, twitterLinked, discordLinked, refresh, refreshTelegramLinked, refreshTwitterLinked, refreshDiscordLinked, claimQuest, spinRaffle, trackEvent]
  );

  return <ArenaContext.Provider value={value}>{children}</ArenaContext.Provider>;
}

export function useArena() {
  const ctx = useContext(ArenaContext);
  if (!ctx) throw new Error("useArena must be used inside ArenaContextProvider");
  return ctx;
}
