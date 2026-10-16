import { useArena } from "context/ArenaContext/ArenaContext";
import useWallet from "lib/wallets/useWallet";
import { ArenaVolumeMilestone } from "domain/arena";

function MilestoneIcon({ m }: { m: ArenaVolumeMilestone }) {
  if (m.completed) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1de9b6] shadow-[0_0_8px_rgba(29,233,182,0.4)]">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0a1410" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }
  if (m.isCurrent) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#1de9b6]/80 bg-[#1de9b6]/10 text-[#1de9b6]">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full border border-slate-600 bg-slate-700 text-slate-500">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12v10H4V12" />
        <path d="M22 7H2v5h20V7z" />
        <path d="M12 22V7" />
        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
      </svg>
    </div>
  );
}

export function VolumeProgressBar() {
  const { volumeProgress } = useArena();
  const { account } = useWallet();

  if (!account || !volumeProgress || !volumeProgress.enabled) return null;

  const { title, description, monthlyVolumeUsd, targetVolumeUsd, percentage, milestones } = volumeProgress;

  const fmtUsd = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}K` : `$${v}`;
  const fmtUsdFull = (v: number) =>
    `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  const pct = Math.min(percentage, 100);

  return (
    <div className="mt-4 border-t border-slate-700/60 pt-16">
      {/* Label row */}
      <div className="mb-10 flex items-center gap-8">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-6 bg-blue-500/10 text-blue-400">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6"  y1="20" x2="6"  y2="14" />
          </svg>
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Monthly Challenge · </span>
          <span className="text-[12px] font-semibold text-slate-300">{title}</span>
        </div>
        {description && (
          <span className="ml-auto text-[11px] text-slate-500 hidden sm:block">{description}</span>
        )}
      </div>

      {/* Bar + milestones (flex-1) alongside stats (fixed right) */}
      <div className="flex items-start gap-20">

        {/* Left: bar track + milestone dots+labels — all relative to this div's width */}
        <div className="relative min-w-0 flex-1">
          {/* Bar */}
          <div className="h-[7px] w-full overflow-hidden rounded-full bg-slate-700/80">
            <div
              className="relative h-full rounded-full bg-gradient-to-r from-blue-600 via-blue-400 to-[#1de9b6] transition-[width] duration-700"
              style={{ width: `${pct}%` }}
            >
              <div className="absolute inset-0 animate-pulse rounded-full bg-white/10" />
            </div>
          </div>
          {pct > 5 && (
            <div
              className="absolute -bottom-3 h-[7px] rounded-full bg-[#1de9b6]/15 blur-sm transition-[width] duration-700"
              style={{ width: `${pct}%` }}
            />
          )}
          {/* Tick marks on bar */}
          {milestones.map((m) => {
            const pos = (m.threshold / targetVolumeUsd) * 100;
            return (
              <div
                key={m.threshold}
                className="absolute top-0 h-[7px] w-[1px] bg-slate-900/70"
                style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
              />
            );
          })}

          {/* Milestone icons + labels — positioned relative to this same div */}
          <div className="relative mt-10" style={{ height: 52 }}>
            {milestones.map((m) => {
              const pos = (m.threshold / targetVolumeUsd) * 100;
              return (
                <div
                  key={m.threshold}
                  className="absolute flex flex-col items-center gap-4"
                  style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
                >
                  <MilestoneIcon m={m} />
                  <div className="text-center leading-tight">
                    <div className="text-[10px] font-bold text-slate-200">{fmtUsd(m.threshold)}</div>
                    <div
                      className={`text-[9px] font-bold leading-snug ${
                        m.rewardDisplay.toLowerCase().includes("usdc") || m.rewardDisplay.includes("$")
                          ? "text-[#f7b731]"
                          : "text-[#1de9b6]"
                      }`}
                    >
                      {m.rewardDisplay}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: stats fixed beside bar */}
        <div className="flex shrink-0 items-start gap-16 pt-0">
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-widest text-slate-500">Volume</div>
            <div className="text-[14px] font-bold leading-tight text-white tabular-nums">{fmtUsdFull(monthlyVolumeUsd)}</div>
          </div>
          <div className="mt-2 h-24 w-[1px] bg-slate-700" />
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-widest text-slate-500">Target</div>
            <div className="text-[14px] font-bold leading-tight text-slate-300 tabular-nums">{fmtUsdFull(targetVolumeUsd)}</div>
          </div>
          <div className="mt-2 h-24 w-[1px] bg-slate-700" />
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-widest text-slate-500">Done</div>
            <div className="text-[14px] font-bold leading-tight text-[#f7b731] tabular-nums">{pct}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
