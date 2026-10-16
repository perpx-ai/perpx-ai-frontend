// import { gql } from "@apollo/client";
import cx from "classnames";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BACKEND_URL } from "config/perpx";

// import { getSubsquidGraphClient } from "lib/subgraph";

const WEEKS_TO_SHOW = 52;
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const CELL_SIZE = 13;
const CELL_GAP = 3;
// type TradeActionRaw - removed, no longer needed with REST API

type DayData = {
  date: string;
  count: number;
};

type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  date: string;
  count: number;
};

function getColorForCount(count: number, max: number): string {
  if (count === 0) return "rgba(93, 189, 183, 0.08)";
  const ratio = count / Math.max(max, 1);
  if (ratio <= 0.25) return "rgba(93, 189, 183, 0.3)";
  if (ratio <= 0.5) return "rgba(93, 189, 183, 0.5)";
  if (ratio <= 0.75) return "rgba(15, 222, 141, 0.7)";
  return "#0FDE8D";
}

function formatTooltipDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function generateDateGrid(
  tradeCounts: Record<string, number>,
  year: number
): { weeks: DayData[][]; months: { label: string; col: number }[] } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const isCurrentYear = year === currentYear;

  const endDate = isCurrentYear ? new Date(now) : new Date(year, 11, 31);
  endDate.setHours(0, 0, 0, 0);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (WEEKS_TO_SHOW * 7 - 1) - startDate.getDay());

  const weeks: DayData[][] = [];
  const months: { label: string; col: number }[] = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const currentDate = new Date(startDate);
  let lastMonth = -1;
  let weekIndex = 0;

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();

    if (dayOfWeek === 0) {
      weeks.push([]);
      weekIndex = weeks.length - 1;
    }

    if (weeks.length === 0) {
      weeks.push([]);
      weekIndex = 0;
    }

    const dateStr = currentDate.toISOString().slice(0, 10);
    const month = currentDate.getMonth();
    if (month !== lastMonth) {
      months.push({ label: monthNames[month], col: weekIndex });
      lastMonth = month;
    }

    weeks[weekIndex].push({
      date: dateStr,
      count: tradeCounts[dateStr] || 0,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return { weeks, months };
}

function getAvailableYears(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= currentYear - 3; y--) {
    years.push(y);
  }
  return years;
}

type TradeActivityGraphProps = {
  account?: string | null;
  chainId: number;
  /** Trades per UTC day from the backend (GMX + Hyperliquid); replaces the Subsquid GMX counts when given. */
  dailyCounts?: Record<string, number>;
};

export function TradeActivityGraph({ account, chainId, dailyCounts }: TradeActivityGraphProps) {
  const [gmxTradeCounts, setGmxTradeCounts] = useState<Record<string, number>>({});
  const tradeCounts = useMemo(() => {
    if (!dailyCounts || Object.keys(dailyCounts).length === 0) return gmxTradeCounts;
    return dailyCounts;
  }, [gmxTradeCounts, dailyCounts]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, date: "", count: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const availableYears = useMemo(() => getAvailableYears(), []);

  useEffect(() => {
    console.log("[TradeActivityGraph] useEffect triggered, account:", account, "chainId:", chainId);
    if (!account) {
      console.log("[TradeActivityGraph] No account connected, skipping fetch");
      setGmxTradeCounts({});
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchTradeActivity = async () => {
      setLoading(true);
      try {
        const url = `${BACKEND_URL}/api/admin/orders?address=${account}`;

        console.log("[TradeActivityGraph] Fetching from:", url, "for account:", account);

        const response = await fetch(url);
        console.log("%c Line:178 🍞 response", "color:#4fff4B", response);

        if (!response.ok) {
          console.error("[TradeActivityGraph] Request failed:", response.status);
          if (!cancelled) setGmxTradeCounts({});
          return;
        }

        const result = await response.json();
        console.log("%c Line:149 🍌 result", "color:#ffdd4d", result);
        const orders = result?.data?.orders ?? result?.data ?? result ?? [];

        console.log("[TradeActivityGraph] Total orders fetched:", orders.length);

        const counts: Record<string, number> = {};
        for (const order of orders) {
          // updatedAtTime is in milliseconds, createdAt is ISO string
          const ts = order.updatedAtTime ?? order.createdAt;
          if (!ts) continue;
          const date = typeof ts === "number"
            ? new Date(ts).toISOString().slice(0, 10)
            : new Date(ts).toISOString().slice(0, 10);
          counts[date] = (counts[date] || 0) + 1;
        }
        console.log("[TradeActivityGraph] Date counts:", counts);
        if (!cancelled) setGmxTradeCounts(counts);
      } catch (err) {
        console.error("[TradeActivityGraph] Failed to fetch:", err);
        if (!cancelled) setGmxTradeCounts({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // /** GraphQL setup (commented out) **
    // const fetchTradeActivity = async () => {
    //   setLoading(true);
    //   try {
    //     const client = getSubsquidGraphClient(chainId);
    //     if (!client) { if (!cancelled) setGmxTradeCounts({}); return; }
    //     const query = gql`{ tradeActions(...) { ... } }`;
    //     const result = await client.query({ query, fetchPolicy: "no-cache" });
    //     ...
    //   } catch (err) { ... }
    // };
    // */

    fetchTradeActivity();
    return () => {
      cancelled = true;
    };
  }, [account, chainId]);

  const { weeks, months } = useMemo(() => generateDateGrid(tradeCounts, selectedYear), [tradeCounts, selectedYear]);

  const maxCount = useMemo(() => {
    let max = 0;
    for (const week of weeks) {
      for (const day of week) {
        if (day.count > max) max = day.count;
      }
    }
    return max;
  }, [weeks]);

  const yearTotalTrades = useMemo(() => {
    let total = 0;
    for (const week of weeks) {
      for (const day of week) {
        total += day.count;
      }
    }
    return total;
  }, [weeks]);

  const handleCellMouseEnter = useCallback((e: React.MouseEvent<SVGRectElement>, day: DayData) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    setTooltip({
      visible: true,
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 8,
      date: day.date,
      count: day.count,
    });
  }, []);

  const handleCellMouseLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  const svgWidth = (CELL_SIZE + CELL_GAP) * weeks.length + 40;
  const svgHeight = (CELL_SIZE + CELL_GAP) * 7 + 30;

  if (loading) {
    return (
      <div className="rounded-8 border border-slate-600 bg-slate-800 p-20">
        <div className="mb-12 h-20 w-[260px] animate-pulse rounded-4 bg-slate-700" />
        <div className="h-[130px] animate-pulse rounded-4 bg-slate-700" />
      </div>
    );
  }

  return (
    <div className="rounded-8 border border-slate-600 bg-slate-800 p-20">
      <div className="mb-16 flex items-center justify-between">
        <h3 className="text-16 font-bold text-typography-primary">
          {yearTotalTrades.toLocaleString()} trades in the last year
        </h3>
      </div>

      <div className="flex gap-16">
        {/* Graph area */}
        <div ref={containerRef} className="relative min-w-0 flex-1 overflow-x-auto">
          <svg width={svgWidth} height={svgHeight} className="block">
            {months.map((month, i) => (
              <text
                key={`month-${i}`}
                x={40 + month.col * (CELL_SIZE + CELL_GAP)}
                y={10}
                className="fill-typography-secondary"
                fontSize={11}
              >
                {month.label}
              </text>
            ))}

            {DAY_LABELS.map((label, i) => (
              <text
                key={`day-${i}`}
                x={0}
                y={22 + i * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2 + 4}
                className="fill-typography-secondary"
                fontSize={11}
              >
                {label}
              </text>
            ))}

            {weeks.map((week, wi) =>
              week.map((day, di) => (
                <rect
                  key={day.date}
                  x={40 + wi * (CELL_SIZE + CELL_GAP)}
                  y={20 + di * (CELL_SIZE + CELL_GAP)}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  rx={2}
                  ry={2}
                  fill={getColorForCount(day.count, maxCount)}
                  className="cursor-pointer"
                  onMouseEnter={(e) => handleCellMouseEnter(e, day)}
                  onMouseLeave={handleCellMouseLeave}
                />
              ))
            )}
          </svg>

          {tooltip.visible && (
            <div
              className="pointer-events-none absolute z-50 rounded-6 bg-slate-950 px-10 py-6 text-12 font-medium text-typography-primary shadow-lg"
              style={{
                left: tooltip.x,
                top: tooltip.y,
                transform: "translate(-50%, -100%)",
              }}
            >
              <span className="font-bold">
                {tooltip.count} trade{tooltip.count !== 1 ? "s" : ""}
              </span>{" "}
              on {formatTooltipDate(tooltip.date)}
              <div
                className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2"
                style={{
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: "5px solid var(--color-slate-950)",
                }}
              />
            </div>
          )}
        </div>

        {/* Year filter buttons */}
        <div className="flex flex-col gap-4">
          {availableYears.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => setSelectedYear(year)}
              className={cx(
                "rounded-4 px-12 py-6 text-13 font-medium transition-colors",
                selectedYear === year
                  ? "bg-blue-500 text-white"
                  : "bg-slate-700 text-typography-secondary hover:text-typography-primary"
              )}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-12 flex items-center justify-end gap-4 text-12 text-typography-secondary">
        <span>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
          <span
            key={i}
            className="inline-block rounded-2"
            style={{
              width: CELL_SIZE,
              height: CELL_SIZE,
              backgroundColor: getColorForCount(ratio === 0 ? 0 : Math.ceil(ratio * 10), 10),
            }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
