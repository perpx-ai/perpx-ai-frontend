import { useEffect, useState } from "react";
import { Trans } from "@lingui/macro";
import useWallet from "lib/wallets/useWallet";
import { arenaClient, GET_ARENA_BADGES, ArenaBadge } from "domain/arena";

const RARITY = {
  common:    {
    border: "border-slate-600/50",
    glow: "",
    bg: "bg-slate-800/60",
    label: "Common",
    color: "text-slate-400",
    chip: "border-slate-600/50 text-slate-400 bg-slate-800",
  },
  uncommon:  {
    border: "border-green-500/40",
    glow: "shadow-[0_0_18px_rgba(34,197,94,0.1)]",
    bg: "bg-green-950/20",
    label: "Uncommon",
    color: "text-green-400",
    chip: "border-green-500/30 text-green-400 bg-green-950/40",
  },
  rare:      {
    border: "border-blue-500/40",
    glow: "shadow-[0_0_18px_rgba(59,130,246,0.12)]",
    bg: "bg-blue-950/20",
    label: "Rare",
    color: "text-blue-400",
    chip: "border-blue-500/30 text-blue-400 bg-blue-950/40",
  },
  epic:      {
    border: "border-purple-500/40",
    glow: "shadow-[0_0_18px_rgba(168,85,247,0.14)]",
    bg: "bg-purple-950/20",
    label: "Epic",
    color: "text-purple-400",
    chip: "border-purple-500/30 text-purple-400 bg-purple-950/40",
  },
  legendary: {
    border: "border-[#f7b731]/50",
    glow: "shadow-[0_0_24px_rgba(247,183,49,0.18)]",
    bg: "bg-yellow-950/20",
    label: "Legendary",
    color: "text-[#f7b731]",
    chip: "border-[#f7b731]/30 text-[#f7b731] bg-yellow-950/40",
  },
} as const;

function BadgeCard({ badge }: { badge: ArenaBadge }) {
  const rc = RARITY[badge.rarity] ?? RARITY.common;
  const earned = badge.earned;

  return (
    <div
      className={`group relative flex flex-col items-center gap-10 rounded-14 border p-16 text-center transition-all duration-300 ${
        earned
          ? `${rc.border} ${rc.bg} ${rc.glow} hover:scale-[1.02]`
          : "border-slate-700/25 bg-slate-800/20 opacity-40 grayscale"
      }`}
    >
      {/* Legendary shimmer */}
      {earned && badge.rarity === "legendary" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-14">
          <div className="absolute inset-x-0 -top-10 h-[60px] animate-pulse bg-gradient-to-b from-[#f7b731]/6 to-transparent" />
        </div>
      )}

      {/* Lock / earned indicator */}
      {!earned ? (
        <div className="absolute right-10 top-10 text-slate-600">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </div>
      ) : (
        <div className="absolute right-9 top-9 flex h-16 w-16 items-center justify-center rounded-full bg-[#1de9b6]/15 text-[#1de9b6]">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

      {/* Emoji */}
      <div className="text-[36px] leading-none">{badge.emoji}</div>

      {/* Rarity dot */}
      {earned && (
        <div className={`text-[9px] font-bold uppercase tracking-widest ${rc.color}`}>
          {rc.label}
        </div>
      )}

      {/* Title */}
      <div className="text-[13px] font-bold leading-snug text-white">{badge.title}</div>

      {/* Description */}
      <div className="text-[11px] leading-relaxed text-slate-400">{badge.description}</div>

      {/* Earned date */}
      {earned && badge.earnedAt && (
        <div className="mt-auto text-[10px] text-slate-600">
          {new Date(badge.earnedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </div>
      )}
    </div>
  );
}

function BadgeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-10 rounded-14 border border-slate-700/25 bg-slate-800/20 p-16">
      <div className="h-[36px] w-[36px] animate-pulse rounded-8 bg-slate-700/60" />
      <div className="h-12 w-[70px] animate-pulse rounded-4 bg-slate-700/60" />
      <div className="h-[28px] w-full animate-pulse rounded-4 bg-slate-700/60" />
      <div className="h-9 w-[50px] animate-pulse rounded-4 bg-slate-700/60" />
    </div>
  );
}

export function ArenaBadges() {
  const { account, active } = useWallet();
  const [badges, setBadges] = useState<ArenaBadge[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    setBadges(null);
    arenaClient
      .query({
        query: GET_ARENA_BADGES,
        variables: { address: account.toLowerCase() },
        fetchPolicy: "network-only",
      })
      .then((res) => setBadges(res.data.arenaBadges))
      .catch(() => setBadges(null))
      .finally(() => setLoading(false));
  }, [account]);

  if (!active) {
    return (
      <div className="rounded-12 border border-slate-700/50 bg-slate-800/40 p-20 text-[14px] text-slate-400">
        <Trans>Connect your wallet to view your badges.</Trans>
      </div>
    );
  }

  const earned = badges?.filter((b) => b.earned) ?? [];

  return (
    <div className="flex flex-col gap-16">
      {/* Stats strip */}
      <div className="flex flex-wrap items-center gap-10">
        <div className="flex items-baseline gap-6 rounded-10 border border-slate-700/50 bg-slate-800/60 px-16 py-10">
          <span className="text-[24px] font-extrabold tabular-nums text-white">
            {loading ? "—" : earned.length}
          </span>
          <span className="text-[12px] text-slate-500">
            / {loading ? "—" : badges?.length ?? "—"} earned
          </span>
        </div>

        {badges && (["legendary","epic","rare","uncommon"] as const).map((r) => {
          const count = earned.filter((b) => b.rarity === r).length;
          if (count === 0) return null;
          return (
            <div
              key={r}
              className={`flex items-center gap-5 rounded-8 border px-11 py-6 text-[11px] font-bold ${RARITY[r].chip}`}
            >
              {count}× {RARITY[r].label}
            </div>
          );
        })}
      </div>

      {/* Badge grid */}
      <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 md:grid-cols-5">
        {loading
          ? Array.from({ length: 10 }).map((_, i) => <BadgeSkeleton key={i} />)
          : badges?.map((badge) => <BadgeCard key={badge.key} badge={badge} />)}
      </div>
    </div>
  );
}
