import { Trans, t } from "@lingui/macro";
import SEO from "components/Common/SEO";
import { getPageTitle } from "lib/legacy";
import { useCallback, useEffect, useMemo, useState } from "react";

import AppPageLayout from "components/AppPageLayout/AppPageLayout";
import Footer from "components/Footer/Footer";
import Tabs from "components/Tabs/Tabs";
import useWallet from "lib/wallets/useWallet";

import { ArenaContextProvider, useArena } from "context/ArenaContext/ArenaContext";
import { LevelCard } from "./components/LevelCard";
import { QuestList, CommunityQuestSection } from "./components/QuestList";
import { LetterBoard } from "./components/LetterBoard";
import { RaffleWheel } from "./components/RaffleWheel";
import { SeasonBanner } from "./components/SeasonBanner";
import { ArenaLeaderboard } from "./components/ArenaLeaderboard";
import { ArenaBadges } from "./components/ArenaBadges";
import { ArenaQuest } from "domain/arena";
import { BACKEND_URL } from "config/perpx";


type TabKey = "quests" | "levels" | "letters" | "raffle" | "leaderboard" | "badges";

function ArenaInner() {
  const { state, loading, trackEvent, blockStatus, refresh } = useArena();
  const { active, account } = useWallet();
  const [tab, setTab] = useState<TabKey>("quests");
  const blocked = blockStatus?.blocked ?? false;
  const [communityQuests, setCommunityQuests] = useState<ArenaQuest[]>([]);

  useEffect(() => {
    trackEvent("ARENA_VIEW");
  }, [trackEvent]);

  useEffect(() => {
    if (tab !== "quests" || !active || blocked) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 10000);
    return () => clearInterval(id);
  }, [tab, active, blocked, refresh]);

  const fetchCommunityQuests = useCallback(() => {
    if (!account) return;
    fetch(`${BACKEND_URL}/api/arena/community-quests/${account}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status) setCommunityQuests(d.data);
      })
      .catch(() => {});
  }, [account]);

  useEffect(() => {
    fetchCommunityQuests();
  }, [fetchCommunityQuests]);

  const options = useMemo(
    () => [
      { value: "quests" as TabKey, label: t`Quests` },
      { value: "levels" as TabKey, label: t`Levels` },
      { value: "letters" as TabKey, label: t`Letters` },
      { value: "raffle" as TabKey, label: t`Raffle` },
      { value: "leaderboard" as TabKey, label: t`Leaderboard` },
      { value: "badges" as TabKey, label: t`Badges` },
    ],
    []
  );

  const lastSeason = blockStatus?.lastEndedSeason;

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-20 px-16 md:px-32 lg:px-48">
      <div className="flex flex-col gap-14">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">PerpX</span>
            <h1 className="bg-gradient-to-r from-white via-slate-100 to-[#1de9b6] bg-clip-text text-[32px] font-extrabold leading-tight tracking-tight text-transparent">
              ARENA V3
            </h1>
          </div>
          <span className="mb-2 rounded-full border border-[#1de9b6]/20 bg-[#1de9b6]/8 px-12 py-4 text-[11px] font-semibold uppercase tracking-widest text-[#1de9b6]/80">
            Live
          </span>
        </div>
        <SeasonBanner />
      </div>

      {!active && !blocked && (
        <div className="rounded-8 border-1/2 border-slate-600 bg-slate-800 p-16 text-body-medium text-slate-100">
          <Trans>Connect your wallet to start earning XP and raffle tickets.</Trans>
        </div>
      )}

      <LevelCard state={state} />

      {blocked ? (
        <div className="relative">
          {/* Blocked overlay */}
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-8 bg-slate-900/85 backdrop-blur-md">
            <div className="flex max-w-[420px] flex-col items-center gap-20 px-24 py-32 text-center">
              {/* Animated lock icon with glow ring */}
              <div className="relative">
                <div className="absolute inset-0 animate-pulse rounded-full bg-green-500/10 blur-xl" />
                <div className="relative flex h-80 w-80 items-center justify-center rounded-full border-1/2 border-slate-600 bg-gradient-to-b from-slate-700 to-slate-800 shadow-[0_0_40px_rgba(15,222,141,0.1)]">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" className="text-green-500">
                    <path d="M12 2C9.24 2 7 4.24 7 7v4H5.5A1.5 1.5 0 004 12.5v8A1.5 1.5 0 005.5 22h13a1.5 1.5 0 001.5-1.5v-8a1.5 1.5 0 00-1.5-1.5H17V7c0-2.76-2.24-5-5-5z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" />
                    <circle cx="12" cy="16.5" r="1.5" fill="currentColor" />
                    <path d="M12 18v1" stroke="currentColor" strokeLinecap="round" />
                  </svg>
                </div>
              </div>

              <div className="flex flex-col gap-8">
                <h2 className="text-[28px] font-bold leading-tight tracking-tight text-white">
                  <Trans>Quest Season Paused</Trans>
                </h2>
                <p className="text-body-medium leading-relaxed text-slate-100/60">
                  <Trans>
                    The arena is being prepared for the next season. Stay tuned — new quests, rewards, and
                    challenges are on the way.
                  </Trans>
                </p>
              </div>

              {lastSeason && (
                <div className="flex w-full items-center gap-16 rounded-8 border-1/2 border-slate-600 bg-slate-800/60 px-20 py-14 text-left">
                  <div className="flex h-44 w-44 shrink-0 items-center justify-center rounded-full bg-green-500/10">
                    <span className="text-[20px]">🏆</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-caption uppercase tracking-wider text-green-500/80">
                      <Trans>Previous Season</Trans>
                    </div>
                    <div className="text-body-large font-bold text-white">{lastSeason.label}</div>
                    <div className="text-body-small text-slate-100/50">
                      <Trans>Ended</Trans>{" "}
                      {new Date(lastSeason.endsAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-8 text-caption text-slate-100/40">
                <span className="inline-block h-[6px] w-[6px] animate-pulse rounded-full bg-green-500" />
                <Trans>Checking for updates…</Trans>
              </div>
            </div>
          </div>

          {/* Blurred content behind */}
          <div className="pointer-events-none select-none blur-sm opacity-40">
            <Tabs<TabKey> options={options} selectedValue={tab} onChange={() => {}} type="inline-primary" />
            <div className="mt-20">
              <QuestList />
            </div>
          </div>
        </div>
      ) : (
        <>
          <Tabs<TabKey> options={options} selectedValue={tab} onChange={setTab} type="inline-primary" />

          {loading && !state && (
            <div className="text-body-small text-slate-100 opacity-70">
              <Trans>Loading arena…</Trans>
            </div>
          )}

          {tab === "quests" && (
            <>
              <QuestList />
              {account && (
                <CommunityQuestSection
                  quests={communityQuests}
                  address={account}
                  onSubmitSuccess={fetchCommunityQuests}
                />
              )}
            </>
          )}
          {tab === "levels" && (
            <div className="rounded-8 border-1/2 border-slate-600 bg-slate-800 p-20 text-body-medium text-slate-100 opacity-80">
              <Trans>
                Levels 1–100 reset each season (~2 months). Your avatar evolves every 10 levels. Keep claiming
                quests to climb faster.
              </Trans>
            </div>
          )}
          {tab === "letters" && <LetterBoard state={state} />}
          {tab === "raffle" && <RaffleWheel />}
          {tab === "leaderboard" && <ArenaLeaderboard />}
          {tab === "badges" && <ArenaBadges />}
        </>
      )}
    </div>
  );
}

export function ArenaPage() {
  return (
    <SEO
      title={getPageTitle(t`Quest Hub`)}
      description={t`Complete daily missions, level up, collect letters, and spin the wheel for real USDC credit on PerpX Quest Hub.`}
    >
      <AppPageLayout>
        <ArenaContextProvider>
          <ArenaInner />
        </ArenaContextProvider>
        <Footer />
      </AppPageLayout>
    </SEO>
  );
}

export default ArenaPage;
