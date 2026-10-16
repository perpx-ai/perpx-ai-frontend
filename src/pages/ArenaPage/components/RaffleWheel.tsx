import { Trans } from "@lingui/macro";
import { useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { useArena } from "context/ArenaContext/ArenaContext";
import Button from "components/Button/Button";

const DEFAULT_WHEEL = [2.5, 5, 10, 17.5, 25, 50, 0, 1];
const COLORS = [
  "#0FDE8D",
  "#3FB5FF",
  "#A277FF",
  "#FFB347",
  "#FF6A88",
  "#F5E663",
  "#6E7A8A",
  "#00F5D4",
];

export function RaffleWheel() {
  const { state, spinRaffle, blockStatus } = useArena();
  const raffleEnabled = blockStatus?.raffleEnabled ?? false;
  const [lastPrize, setLastPrize] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const controls = useAnimation();
  const wheel = DEFAULT_WHEEL;
  const tickets = state?.raffleTickets ?? 0;
  const segments = wheel.length;
  const segAngle = 360 / segments;

  const onSpin = async () => {
    if (tickets <= 0 || spinning) return;
    setSpinning(true);
    setLastPrize(null);
    const result = await spinRaffle();
    if (!result) {
      setSpinning(false);
      return;
    }
    // Align so the winning segment stops under the top pointer
    const target = 360 * 6 - (result.segmentIndex * segAngle + segAngle / 2);
    await controls.start({
      rotate: target,
      transition: { duration: 4, ease: [0.17, 0.67, 0.21, 0.99] },
    });
    setLastPrize(result.prizeUsdc);
    setSpinning(false);
    // Reset rotation mod-360 so next spin animates fresh
    controls.set({ rotate: target % 360 });
  };

  return (
    <div className="flex flex-col items-center gap-16 rounded-8 border-1/2 border-slate-600 bg-slate-800 p-20">
      <div className="flex w-full items-start justify-between gap-12">
        <div>
          <h3 className="text-h2 font-bold text-white">
            <Trans>Raffle Wheel</Trans>
          </h3>
          <p className="text-body-small text-slate-100 opacity-70">
            <Trans>Spend a ticket, win instant USDC credit.</Trans>
          </p>
        </div>
        <div className="text-right">
          <div className="text-caption uppercase text-slate-100 opacity-60">
            <Trans>Tickets</Trans>
          </div>
          <div className="text-h1 font-bold text-green-500">{tickets}</div>
        </div>
      </div>

      <div className="relative" style={{ width: 280, height: 280 }}>
        <div className="absolute left-1/2 top-[-8px] z-10 -translate-x-1/2">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <polygon points="12,22 2,4 22,4" fill="#0FDE8D" />
          </svg>
        </div>
        <motion.svg
          viewBox="0 0 200 200"
          width="280"
          height="280"
          animate={controls}
          style={{ originX: 0.5, originY: 0.5 }}
        >
          {wheel.map((p, i) => {
            const start = (i * 360) / segments;
            const end = ((i + 1) * 360) / segments;
            const path = describeWedge(100, 100, 95, start, end);
            const midAngle = (start + end) / 2;
            const textPos = polarToCartesian(100, 100, 60, midAngle);
            return (
              <g key={i}>
                <path d={path} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
                <text
                  x={textPos.x}
                  y={textPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill="#0b1220"
                  transform={`rotate(${midAngle - 90} ${textPos.x} ${textPos.y})`}
                >
                  ${p}
                </text>
              </g>
            );
          })}
          <circle cx="100" cy="100" r="20" fill="#132535" stroke="#0FDE8D" strokeWidth="2" />
        </motion.svg>
      </div>

      <Button
        variant="primary-action"
        disabled={tickets <= 0 || spinning || !raffleEnabled}
        onClick={onSpin}
        className="w-full max-w-[280px]"
      >
        {!raffleEnabled ? <Trans>Raffle Disabled</Trans> : spinning ? <Trans>Spinning…</Trans> : <Trans>Spin</Trans>}
      </Button>

      {lastPrize !== null && (
        <div className="text-body-large font-bold text-green-500">
          {lastPrize > 0 ? (
            <Trans>You won ${lastPrize} USDC!</Trans>
          ) : (
            <Trans>No prize this time — try again.</Trans>
          )}
        </div>
      )}
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeWedge(cx: number, cy: number, r: number, start: number, end: number) {
  const a = polarToCartesian(cx, cy, r, end);
  const b = polarToCartesian(cx, cy, r, start);
  const largeArc = end - start <= 180 ? "0" : "1";
  return ["M", cx, cy, "L", b.x, b.y, "A", r, r, 0, largeArc, 0, a.x, a.y, "Z"].join(" ");
}
