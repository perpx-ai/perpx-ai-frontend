import { Trans } from "@lingui/macro";
import cx from "classnames";
import { motion } from "framer-motion";
import { useHistory } from "react-router-dom";
import { ArenaContextProvider, useArena } from "context/ArenaContext/ArenaContext";

const WORD = "QUEST";

function Inner() {
  const { state, quests, claimQuest } = useArena();
  const history = useHistory();
  const level = state?.level ?? 1;
  const xpInto = state?.xpIntoLevel ?? 0;
  const xpPer = state?.xpPerLevel ?? 100;
  const pct = Math.min(100, Math.round((xpInto / xpPer) * 100));

  const dailyCheckin = quests.find((q) => q.kind === "DAILY_CHECKIN");
  const timeAttack = quests.find((q) => q.kind === "TIME_ATTACK");
  const levelUp = quests.find((q) => q.kind === "LEVEL_UP");

  const collected = new Set(state?.letters ?? []);
  const nextLetter = WORD.split("").find((l) => !collected.has(l)) ?? "✓";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-[360px] rounded-8 border-1/2 border-slate-600 bg-slate-800 p-16 shadow-[0_4px_24px_rgba(0,0,0,0.25)]"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-h2 font-bold text-white">
          <Trans>MY QUESTS</Trans>
        </h3>
        <button
          onClick={() => history.push("/arena")}
          className="text-caption text-[#3FB5FF] hover:underline"
        >
          <Trans>Open ↗</Trans>
        </button>
      </div>

      <div className="mt-8">
        <div className="text-caption text-slate-100 opacity-70">
          Level {level} • {xpInto}/{xpPer} XP
        </div>
        <div className="mt-4 h-6 w-full overflow-hidden rounded-full bg-slate-700">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-green-500 to-[#3FB5FF]"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
      </div>

      <div className="mt-14 flex flex-col gap-12">
        {dailyCheckin && (
          <QuestRow
            icon="✓"
            title={dailyCheckin.title}
            subtitle={`${dailyCheckin.reward.xp} pts`}
            claimed={dailyCheckin.status === "CLAIMED"}
            onClaim={() => claimQuest(dailyCheckin.key)}
          />
        )}
        {timeAttack && (
          <ProgressRow
            icon="⏱"
            iconColor="text-[#FFB347]"
            title={timeAttack.title}
            subtitle={timeAttack.description}
            percent={timeAttack.progress ?? 0}
            barFrom="from-[#FFB347]"
            barTo="to-[#FF6A88]"
          />
        )}
        {levelUp && (
          <ProgressRow
            icon="🎯"
            iconColor="text-[#3FB5FF]"
            title={levelUp.title}
            subtitle={`${levelUp.description} · +${levelUp.reward.xp} pts + 🎟 Ticket`}
            percent={levelUp.progress ?? 0}
            barFrom="from-[#3FB5FF]"
            barTo="to-[#A277FF]"
          />
        )}
      </div>

      <div className="mt-14 border-t-1/2 border-slate-600 pt-10 text-caption text-slate-100 opacity-80">
        <Trans>Next Letter: Unlock “{nextLetter}” 🔒</Trans>
      </div>
    </motion.div>
  );
}

function QuestRow({
  icon,
  title,
  subtitle,
  claimed,
  onClaim,
}: {
  icon: string;
  title: string;
  subtitle: string;
  claimed: boolean;
  onClaim: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-10">
      <div className="min-w-0">
        <div className="flex items-center gap-6 text-body-small font-semibold text-white">
          <span className="text-green-500">{icon}</span>
          <span className="truncate">{title}</span>
        </div>
        <div className="text-caption text-slate-100 opacity-70">{subtitle}</div>
      </div>
      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        whileHover={!claimed ? { scale: 1.04 } : undefined}
        disabled={claimed}
        onClick={onClaim}
        className={cx(
          "shrink-0 rounded-full px-10 py-4 text-caption font-semibold uppercase tracking-wide transition-colors",
          claimed
            ? "bg-slate-700 text-slate-100 opacity-60"
            : "bg-green-500 text-slate-900 shadow-[0_0_10px_rgba(15,222,141,0.35)] hover:bg-[#2ff2a3]"
        )}
      >
        {claimed ? "✓" : "Claim"}
      </motion.button>
    </div>
  );
}

function ProgressRow({
  icon,
  iconColor,
  title,
  subtitle,
  percent,
  barFrom,
  barTo,
}: {
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  percent: number;
  barFrom: string;
  barTo: string;
}) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div>
      <div className="flex items-center justify-between text-body-small">
        <span className="flex items-center gap-6 font-semibold text-white">
          <span className={iconColor}>{icon}</span>
          <span className="truncate">{title}</span>
        </span>
        <span className="text-caption text-slate-100 opacity-70">{p}%</span>
      </div>
      <div className="mt-4 h-6 overflow-hidden rounded-full bg-slate-700">
        <motion.div
          className={cx("h-full rounded-full bg-gradient-to-r", barFrom, barTo)}
          initial={{ width: 0 }}
          animate={{ width: `${p}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <div className="mt-2 text-caption text-slate-100 opacity-70">{subtitle}</div>
    </div>
  );
}

export function MyQuestsPanel() {
  return (
    <ArenaContextProvider>
      <Inner />
    </ArenaContextProvider>
  );
}
