import { Trans } from "@lingui/macro";
import { AvatarEvolution } from "./AvatarEvolution";
import { VolumeProgressBar } from "./VolumeProgressBar";
import { ArenaUserState } from "domain/arena";

export function LevelCard({ state }: { state: ArenaUserState | null }) {
  const level = state?.level ?? 1;
  const tier = state?.tier ?? 0;
  const xpInto = state?.xpIntoLevel ?? 0;
  const xpPer = state?.xpPerLevel ?? 100;
  const pct = Math.min(100, Math.round((xpInto / xpPer) * 100));

  return (
    <div className="flex flex-col gap-16 rounded-8 border-1/2 border-slate-600 bg-slate-800 p-20">
      {/* Avatar + XP row */}
      <div className="flex flex-col gap-16 md:flex-row md:items-center">
        <AvatarEvolution level={level} tier={tier} size={120} />
        <div className="flex grow flex-col gap-12">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-caption uppercase text-slate-100 opacity-70">
                <Trans>Arena Level</Trans>
              </div>
              <div className="text-h1 font-bold text-white">
                <Trans>Level {level}</Trans>
              </div>
            </div>
            <div className="text-right">
              <div className="text-caption uppercase text-slate-100 opacity-70">
                <Trans>Total XP</Trans>
              </div>
              <div className="text-h2 font-bold text-green-500">{state?.totalXP ?? 0}</div>
            </div>
          </div>

          <div>
            <div className="mb-4 flex justify-between text-body-small text-slate-100 opacity-70">
              <span>
                {xpInto} / {xpPer} XP
              </span>
              <span>
                <Trans>Next: Level {level + 1}</Trans>
              </span>
            </div>
            <div className="h-10 w-full overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-500 to-[#3FB5FF] transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-16 pt-4 text-body-small">
            <Stat label={<Trans>Tier</Trans>} value={`${tier + 1} / 10`} />
            <Stat label={<Trans>Raffle Tickets</Trans>} value={String(state?.raffleTickets ?? 0)} />
            <Stat
              label={<Trans>USDC Credit</Trans>}
              value={`$${(state?.raffleCreditUsdc ?? 0).toFixed(2)}`}
              accent
            />
            <Stat label={<Trans>Season</Trans>} value={state?.season ?? "—"} />
          </div>
        </div>
      </div>

      {/* Volume challenge bar — full width below XP content */}
      <VolumeProgressBar />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: React.ReactNode;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-caption uppercase text-slate-100 opacity-60">{label}</div>
      <div className={accent ? "font-bold text-green-500" : "font-semibold text-white"}>{value}</div>
    </div>
  );
}
