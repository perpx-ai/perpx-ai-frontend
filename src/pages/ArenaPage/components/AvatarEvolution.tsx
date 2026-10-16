import cx from "classnames";

const TIER_COLORS = [
  ["#0FDE8D", "#0A8A58"],
  ["#3FB5FF", "#1E6FB8"],
  ["#A277FF", "#5A2EB5"],
  ["#FFB347", "#B8651E"],
  ["#FF6A88", "#A1283F"],
  ["#F5E663", "#A88E1A"],
  ["#00F5D4", "#007A6B"],
  ["#FF00A8", "#7A0055"],
  ["#9EFF00", "#4F8A00"],
  ["#FFFFFF", "#6E7A8A"],
];

type Props = {
  level: number;
  tier: number;
  size?: number;
  className?: string;
};

export function AvatarEvolution({ level, tier, size = 96, className }: Props) {
  const [light, dark] = TIER_COLORS[Math.min(tier, TIER_COLORS.length - 1)];
  const id = `avatar-grad-${tier}`;
  const rings = Math.min(4 + tier, 10);

  return (
    <div className={cx("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} aria-label={`Level ${level} avatar`}>
        <defs>
          <radialGradient id={id} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={light} stopOpacity="1" />
            <stop offset="100%" stopColor={dark} stopOpacity="1" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill={`url(#${id})`} fillOpacity={0.15} />
        {Array.from({ length: rings }).map((_, i) => (
          <circle
            key={i}
            cx="60"
            cy="60"
            r={50 - i * 4}
            fill="none"
            stroke={light}
            strokeOpacity={1 - i * 0.08}
            strokeWidth={1}
          />
        ))}
        <circle cx="60" cy="60" r="24" fill={`url(#${id})`} />
        <polygon
          points="60,42 68,58 60,78 52,58"
          fill="#0b1220"
          opacity="0.7"
        />
        <text
          x="60"
          y="112"
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill={light}
        >
          LV {level}
        </text>
      </svg>
    </div>
  );
}
