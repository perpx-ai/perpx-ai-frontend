import { useEffect, useState } from "react";
import useWallet from "lib/wallets/useWallet";
import { arenaClient, GET_ARENA_LEADERBOARD, ArenaLeaderboardEntry, ArenaLeaderboardData } from "domain/arena";

type Kind = "VOLUME" | "XP" | "QUESTS";

const KINDS: { value: Kind; label: string; icon: string }[] = [
  { value: "VOLUME", label: "Volume",  icon: "📊" },
  { value: "XP",     label: "XP",      icon: "⚡" },
  { value: "QUESTS", label: "Quests",  icon: "🎯" },
];

const RANK_STYLE: Record<number, { bg: string; border: string; text: string; medal: string }> = {
  1: { bg: "bg-[#f7b731]/6",  border: "border-l-2 border-l-[#f7b731]/60", text: "text-[#f7b731]",  medal: "🥇" },
  2: { bg: "bg-slate-400/5",  border: "border-l-2 border-l-slate-400/50", text: "text-slate-300",  medal: "🥈" },
  3: { bg: "bg-amber-700/8",  border: "border-l-2 border-l-amber-700/50", text: "text-amber-600",  medal: "🥉" },
};

const AVATAR_COLORS = ["#7c3aed","#2563eb","#db2777","#d97706","#059669","#0891b2","#7c2d12","#4f46e5"];
function avatarColor(a: string) { return AVATAR_COLORS[parseInt(a.slice(2,4),16) % AVATAR_COLORS.length]; }
function initials(a: string) { return a.slice(2,4).toUpperCase(); }
function shortAddr(a: string) { return `${a.slice(0,6)}…${a.slice(-4)}`; }

function MiniBar({ pct, isMe }: { pct: number; isMe: boolean }) {
  return (
    <div className="h-[3px] w-[80px] shrink-0 overflow-hidden rounded-full bg-slate-700">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${
          isMe ? "bg-gradient-to-r from-blue-500 to-blue-400" : "bg-gradient-to-r from-[#f7b731]/80 to-[#f7b731]"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function EntryRow({ entry, isMe, kind }: { entry: ArenaLeaderboardEntry; isMe: boolean; kind: Kind }) {
  const rs = RANK_STYLE[entry.rank];
  const rewardIsTbd = entry.estimatedReward === "TBD";

  return (
    <div
      className={`flex items-center gap-12 px-20 py-12 transition-colors ${
        isMe
          ? "bg-blue-950/50 border-l-2 border-l-blue-500/70"
          : rs
          ? `${rs.bg} ${rs.border}`
          : "hover:bg-slate-700/20 border-l-2 border-l-transparent"
      } ${!isMe && "border-b border-slate-700/30 last:border-0"}`}
    >
      {/* Rank */}
      <div className="w-20 shrink-0 text-center">
        {rs && !isMe ? (
          <span className="text-[18px] leading-none">{rs.medal}</span>
        ) : (
          <span className={`text-[13px] font-bold tabular-nums ${isMe ? "text-blue-400" : "text-slate-500"}`}>
            {entry.rank}
          </span>
        )}
      </div>

      {/* Avatar */}
      <div
        className="flex h-34 w-34 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ring-1 ring-white/10"
        style={{ backgroundColor: avatarColor(entry.address) }}
      >
        {initials(entry.address)}
      </div>

      {/* Name */}
      <div className="min-w-0 grow">
        <div className="flex flex-wrap items-center gap-6">
          <span className="text-[13px] font-semibold text-white">{shortAddr(entry.address)}</span>
          {isMe && (
            <span className="rounded-2 bg-blue-500/20 px-5 py-[1px] text-[9px] font-bold uppercase tracking-widest text-blue-400">
              YOU
            </span>
          )}
          {entry.todayDelta && !isMe && (
            <span className="text-[10px] font-semibold text-[#1de9b6]">{entry.todayDelta} today</span>
          )}
        </div>
      </div>

      {/* Mini bar */}
      <MiniBar pct={entry.barPct} isMe={isMe} />

      {/* Value + reward */}
      <div className="shrink-0 text-right">
        <div className={`text-[15px] font-bold tabular-nums leading-tight ${
          isMe ? "text-blue-400" : rs ? rs.text : "text-[#f7b731]"
        }`}>
          {entry.displayValue}
        </div>
        <div className="mt-1 text-[10px] text-slate-500">
          {kind !== "XP" && <>{entry.xp.toLocaleString()} XP · </>}
          <span className={rewardIsTbd ? "text-slate-600" : "font-semibold text-[#f7b731]"}>
            {entry.estimatedReward}
          </span>
        </div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-12 border-b border-slate-700/30 px-20 py-12 last:border-0">
      <div className="h-18 w-20 animate-pulse rounded-4 bg-slate-700/60" />
      <div className="h-34 w-34 animate-pulse rounded-full bg-slate-700/60" />
      <div className="grow">
        <div className="h-12 w-[110px] animate-pulse rounded-4 bg-slate-700/60" />
      </div>
      <div className="h-[3px] w-[80px] animate-pulse rounded-full bg-slate-700/60" />
      <div className="text-right">
        <div className="mb-4 h-14 w-[70px] animate-pulse rounded-4 bg-slate-700/60" />
        <div className="h-10 w-[90px] animate-pulse rounded-4 bg-slate-700/60" />
      </div>
    </div>
  );
}

export function ArenaLeaderboard() {
  const { account } = useWallet();
  const [activeKind, setActiveKind] = useState<Kind>("VOLUME");
  const [cache, setCache] = useState<Partial<Record<Kind, ArenaLeaderboardData>>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { setCache({}); }, [account]);

  useEffect(() => {
    if (cache[activeKind]) return;
    setLoading(true);
    arenaClient
      .query({
        query: GET_ARENA_LEADERBOARD,
        variables: { kind: activeKind, address: account?.toLowerCase() ?? null },
        fetchPolicy: "network-only",
      })
      .then((res) => setCache((prev) => ({ ...prev, [activeKind]: res.data.arenaLeaderboard })))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeKind, account, cache]);

  const board = cache[activeKind];
  const meInTopN = board?.me != null && board.entries.some((e) => e.rank === board.me!.rank);

  return (
    <div className="relative overflow-hidden rounded-16 border border-slate-700/60 bg-gradient-to-b from-slate-900 to-slate-800/80">
      {/* Top accent line */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#1de9b6]/35 to-transparent" />

      {/* Header */}
      <div className="flex items-center gap-10 px-20 py-16">
        <div className="flex h-28 w-28 items-center justify-center rounded-6 bg-[#1de9b6]/10 text-[#1de9b6]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
          </svg>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Season Leaderboard
        </span>
      </div>

      {/* Tab bar */}
      <div className="grid grid-cols-3 border-t border-slate-700/40">
        {KINDS.map((k) => (
          <button
            key={k.value}
            onClick={() => setActiveKind(k.value)}
            className={`relative py-11 text-[13px] font-semibold transition-all ${
              activeKind === k.value
                ? "text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <span className="flex items-center justify-center gap-6">
              <span className="text-[14px]">{k.icon}</span>
              {k.label}
            </span>
            {/* Active underline */}
            {activeKind === k.value && (
              <span className="absolute bottom-0 left-1/2 h-[2px] w-[40%] -translate-x-1/2 rounded-t-full bg-[#1de9b6]" />
            )}
          </button>
        ))}
      </div>

      {/* Rows */}
      <div className="border-t border-slate-700/40">
        {loading && !board ? (
          <>{[0,1,2].map((i) => <SkeletonRow key={i} />)}</>
        ) : board ? (
          <>
            {board.entries.map((entry) => (
              <EntryRow
                key={entry.address}
                entry={entry}
                isMe={entry.rank === board.me?.rank}
                kind={activeKind}
              />
            ))}

            {board.me && !meInTopN && (
              <>
                <div className="mx-20 my-2 border-t border-dashed border-slate-700/50" />
                <EntryRow entry={board.me} isMe kind={activeKind} />
              </>
            )}

            {board.me?.spotsToRewardZone != null && board.me.spotsToRewardZone > 0 && (
              <div className="flex items-center justify-center gap-6 px-20 py-12 text-[11px] text-slate-500">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
                <span>
                  {board.me.spotsToRewardZone} more spot{board.me.spotsToRewardZone > 1 ? "s" : ""} to enter reward zone
                  {board.me.valueToRewardZone ? ` — ${board.me.valueToRewardZone} away` : ""}
                </span>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
