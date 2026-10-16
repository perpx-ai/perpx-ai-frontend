import { Link } from "react-router-dom";

const MESSAGES = [
  "🔥 Phase 2 PerpX Arena now live",
  "✦ Daily quests · Level 1→100 · Letter collection · Raffle wheel",
  "💰 Real USDC payouts — not fake points",
  "🎯 Complete daily missions to earn XP",
];

export function HelloBar() {
  const text = MESSAGES.join("     •     ");
  return (
    <Link
      to="/arena"
      className="block w-full overflow-hidden border-b-1/2 border-slate-600 bg-gradient-to-r from-[#0FDE8D]/10 via-slate-800 to-[#3FB5FF]/10"
    >
      <div className="relative flex h-32 items-center whitespace-nowrap">
        <div className="arena-marquee flex shrink-0 animate-[arena-marquee_28s_linear_infinite] gap-40 pl-[100%] text-body-small font-semibold text-green-500">
          <span>{text}</span>
          <span aria-hidden>{text}</span>
        </div>
      </div>
      <style>{`
        @keyframes arena-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </Link>
  );
}
