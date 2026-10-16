import { useEffect, useState } from "react";
import { useArena } from "context/ArenaContext/ArenaContext";

function useCountdown(endsAt: string | undefined) {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, ended: false });
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setTime({ days: 0, hours: 0, minutes: 0, ended: true }); return; }
      setTime({
        days: Math.floor(diff / 86_400_000),
        hours: Math.floor((diff % 86_400_000) / 3_600_000),
        minutes: Math.floor((diff % 3_600_000) / 60_000),
        ended: false,
      });
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [endsAt]);
  return time;
}

function countdownLabel(t: { days: number; hours: number; minutes: number; ended: boolean }) {
  if (t.ended) return "Ended";
  if (t.days > 0) return `${t.days}d ${t.hours}h left`;
  if (t.hours > 0) return `${t.hours}h ${t.minutes}m left`;
  return `${t.minutes}m left`;
}

export function SeasonBanner() {
  const { seasonInfo } = useArena();
  const countdown = useCountdown(seasonInfo?.endsAt);

  if (!seasonInfo) return null;

  const hasPrize = seasonInfo.prizePool > 0;
  const endDate = new Date(seasonInfo.endsAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div className="relative overflow-hidden rounded-14 border border-slate-700/50 bg-slate-900">
      {/* Top accent */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#1de9b6]/40 to-transparent" />

      <div className="px-20 py-16">
        {/* Row 1: Season name + countdown pill */}
        <div className="flex flex-wrap items-center justify-between gap-10">
          <div className="flex items-center gap-10">
            {/* Season icon */}
            <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-8 bg-[#1de9b6]/10">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1de9b6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
              </svg>
            </div>

            <div>
              <div className="text-[17px] font-bold leading-tight text-white">{seasonInfo.label}</div>
              <div className="text-[12px] text-slate-500">Ends {endDate}</div>
            </div>
          </div>

          {/* Countdown pill */}
          <div className={`flex items-center gap-6 rounded-full border px-14 py-6 text-[13px] font-semibold ${
            countdown.ended
              ? "border-slate-600/40 bg-slate-800 text-slate-500"
              : "border-[#1de9b6]/20 bg-[#1de9b6]/8 text-[#1de9b6]"
          }`}>
            {!countdown.ended && (
              <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-[#1de9b6]" />
            )}
            {countdownLabel(countdown)}
          </div>
        </div>

        {/* Prize pool — only shown when set */}
        {hasPrize && (
          <>
            <div className="my-14 border-t border-slate-800" />
            <div className="flex items-center gap-8">
              <span className="text-[13px] text-slate-500">Prize Pool</span>
              <span className="text-[15px] font-bold text-[#f7b731]">
                ${seasonInfo.prizePool.toLocaleString()} USDC
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
