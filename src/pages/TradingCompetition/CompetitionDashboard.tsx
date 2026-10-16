import { Trans, t } from "@lingui/macro";
import { ReactNode, useCallback } from "react";

import { getPageTitle } from "lib/legacy";
import useWallet from "lib/wallets/useWallet";

import AppPageLayout from "components/AppPageLayout/AppPageLayout";
import SEO from "components/Common/SEO";

import CompetitionBackdrop from "./CompetitionBackdrop";
import { getBoardPoolUsd, getEstimatedRewardUsd, LAST_PAID_RANK } from "./competitionRewards";
import CompetitionRules from "./CompetitionRules";
import CompetitionSocialBar from "./CompetitionSocialBar";
import { COMPETITION_PRIZE_POOL_USD, COMPETITION_RULES_ANCHOR, COMPETITION_START_MS } from "./constants";
import { CompetitionEntry, CompetitionMetric, useCompetitionLeaderboard } from "./useCompetitionLeaderboard";

const CARD_CLASS_NAME = `rounded-[clamp(12px,2vw,16px)] border border-white/10 bg-[#0C1E2C]/70
  p-[clamp(14px,3vw,20px)] backdrop-blur-sm`;

const LABEL_CLASS_NAME = "text-[clamp(10px,2.2vw,11px)] font-semibold uppercase tracking-[0.16em] text-[#7a8a9a]";

const GMT_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

/** Volume in USD, compact enough to sit in a stat card without wrapping. */
function formatVolume(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000_000 ? 2 : 0,
  }).format(value);
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Share of total volume, kept to one decimal unless that would round away to 0.0%. */
function formatShare(share: number): string {
  return `${share.toFixed(share >= 1 ? 1 : 2)}%`;
}

/**
 * Realised PnL in USD, always signed so a win and a loss are distinguishable
 * without relying on colour alone. Cents are kept under $1,000, where dropping
 * them would render a real result as a flat $0.
 */
function formatPnl(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    signDisplay: "exceptZero",
    maximumFractionDigits: Math.abs(value) >= 1_000 ? 0 : 2,
  }).format(value);
}

/** Return on traded volume, as a signed percentage of a fraction like 0.184. */
function formatReturn(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    signDisplay: "exceptZero",
    maximumFractionDigits: 2,
  }).format(value);
}

/** Prize money, to the cent — ranks 4-10 land on figures like $196.43. */
function formatReward(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

/** The one number a row is ranked on, formatted for whichever board is active. */
function formatMetric(entry: CompetitionEntry, metric: CompetitionMetric): string {
  if (metric === "volume") {
    return formatVolume(entry.volume);
  }
  if (metric === "pnl") {
    return entry.pnl === 0 ? "—" : formatPnl(entry.pnl);
  }
  return entry.roi === 0 ? "—" : formatReturn(entry.roi);
}

/**
 * The competition dashboard: where a registered visitor lands once the start
 * instant has passed.
 *
 * Three boards run in parallel — volume, realised PnL and return on volume —
 * and they are three sorts of one roster, not three queries: every number they
 * rank on arrives on the same leaderboard row, so switching boards re-sorts
 * what is already loaded and the totals can never disagree between tabs. The
 * published rules sit under the standings, with a button in the header that
 * jumps to them, because the first question a live leaderboard raises is how it
 * is scored.
 */
export default function CompetitionDashboard() {
  const { account } = useWallet();
  const {
    entries,
    me,
    totalVolume,
    myVolume,
    traderCount,
    metric,
    setMetric,
    page,
    pageCount,
    setPage,
    search,
    setSearch,
    period,
    hasStarted,
    isLoading,
    error,
  } = useCompetitionLeaderboard();

  // The window the backend says it counted, not the one we asked for — if the
  // range were ever dropped, the heading would keep claiming a start time the
  // numbers do not honour. Falls back to the competition start when the
  // endpoint reports no window, which is its lifetime-totals answer.
  const countedFromMs = period.fromDate ? Date.parse(period.fromDate) : NaN;
  const startedAtLabel = new Intl.DateTimeFormat("en-GB", GMT_DATE_FORMAT).format(
    Number.isNaN(countedFromMs) ? COMPETITION_START_MS : countedFromMs
  );
  const myShare = totalVolume > 0 ? (myVolume / totalVolume) * 100 : 0;
  const prizePool = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(COMPETITION_PRIZE_POOL_USD);

  return (
    <SEO
      title={getPageTitle(t`Trading Competition`)}
      description={t`Live PerpX trading competition standings — volume, PnL and return leaderboards, plus the full rules.`}
    >
      <AppPageLayout contentClassName="!max-w-none !gap-0 !p-0">
        <section
          className="relative isolate flex min-h-[calc(100vh-68px)] w-full flex-col overflow-hidden bg-[#081420]"
          style={{ minHeight: "calc(100dvh - 68px)" }}
        >
          <CompetitionBackdrop />

          <div
            className="relative z-10 mx-auto flex w-full max-w-[1512px] flex-1 flex-col
              gap-[clamp(20px,3vw,32px)] px-[clamp(16px,4vw,64px)] py-[clamp(24px,4vw,48px)]"
          >
            <header className="flex min-w-0 flex-wrap items-end justify-between gap-[clamp(14px,2.6vw,24px)]">
              <div className="min-w-0">
                {/*
                  One badge, two voices: the section it belongs to reads as a
                  quiet label, and only the live state carries the accent colour,
                  so the eye lands on the fact that matters — this is running now.
                */}
                <span
                  className="inline-flex items-center gap-8 rounded-full border border-white/10 bg-white/[0.04]
                    px-[clamp(10px,2vw,16px)] py-[clamp(5px,1.2vw,9px)] text-[clamp(10px,2.2vw,12px)]
                    font-semibold uppercase tracking-[0.16em] text-[#8296a5]"
                >
                  <Trans>Trading Competition</Trans>
                  <span className="text-white/20" aria-hidden>
                    ·
                  </span>
                  <span className="inline-flex items-center gap-6 text-[#35B9C0]">
                    <span className="size-6 animate-pulse rounded-full bg-[#35B9C0]" aria-hidden />
                    <Trans>Live</Trans>
                  </span>
                </span>

                <h1
                  className="mt-[clamp(12px,2.4vw,20px)] text-[clamp(30px,6vw,52px)] font-bold
                    leading-[1.05] tracking-[-0.02em] text-white"
                >
                  <Trans>
                    Live <span className="text-[#35B9C0]">Leaderboard</span>
                  </Trans>
                </h1>

                <p className="mt-[clamp(8px,1.6vw,12px)] text-[clamp(12px,2.4vw,14px)] text-[#8296a5]">
                  <Trans>
                    Live since {startedAtLabel} GMT · Three boards sharing a {prizePool} USDC pool
                  </Trans>
                </p>
              </div>

              <RulesButton />
            </header>

            <div className="grid gap-[clamp(10px,2vw,16px)] sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label={t`Total Volume`}
                value={formatVolume(totalVolume)}
                caption={<Trans>Across {traderCount} registered traders</Trans>}
                isLoading={isLoading}
              />
              <StatCard
                label={t`Your Volume`}
                value={account ? formatVolume(myVolume) : "—"}
                caption={
                  account ? (
                    <Trans>{formatShare(myShare)} of total volume</Trans>
                  ) : (
                    <Trans>Connect your wallet to see your volume</Trans>
                  )
                }
                isHighlighted
                isLoading={isLoading}
              />
              <StatCard
                label={t`Your Rank`}
                value={me?.rank ? `#${me.rank}` : "—"}
                caption={
                  me?.rank ? (
                    <Trans>On this board, out of {traderCount} traders</Trans>
                  ) : (
                    <Trans>Trade to enter the standings</Trans>
                  )
                }
                isLoading={isLoading}
              />
              <StatCard
                label={t`Your Trades`}
                value={account && me ? String(me.trades) : "—"}
                caption={<Trans>Filled orders counted toward the competition</Trans>}
                isLoading={isLoading}
              />
            </div>

            <StandingsTable
              entries={entries}
              me={me}
              metric={metric}
              onMetricChange={setMetric}
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              search={search}
              onSearchChange={setSearch}
              hasStarted={hasStarted}
              startedAtLabel={startedAtLabel}
              isLoading={isLoading}
              error={error}
            />

            <CompetitionRules />
          </div>

          <CompetitionSocialBar />
        </section>
      </AppPageLayout>
    </SEO>
  );
}

/**
 * Jumps to the rules section further down the page.
 *
 * Scrolls the element rather than setting `location.hash`: the competition
 * pages are client-routed, and a hash change here would be read as navigation.
 * Honours the visitor's reduced-motion setting, since a full-page smooth scroll
 * is exactly the movement that setting exists to stop.
 */
function RulesButton() {
  const scrollToRules = useCallback(() => {
    const target = document.getElementById(COMPETITION_RULES_ANCHOR);

    if (!target) {
      return;
    }

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    // Moves keyboard focus with the view, so tabbing continues from the rules
    // rather than from the button the visitor just left at the top of the page.
    target.focus({ preventScroll: true });
  }, []);

  return (
    <button
      type="button"
      onClick={scrollToRules}
      className="inline-flex shrink-0 items-center gap-8 rounded-full border border-[#35B9C0]/30
        bg-[#35B9C0]/10 px-[clamp(14px,2.6vw,20px)] py-[clamp(8px,1.6vw,12px)]
        text-[clamp(12px,2.4vw,14px)] font-semibold text-[#35B9C0] transition-colors
        hover:border-[#35B9C0]/60 hover:bg-[#35B9C0]/20 focus-visible:outline
        focus-visible:outline-2 focus-visible:outline-[#35B9C0]"
    >
      <Trans>Rules & Structure</Trans>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden>
        <path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function StatCard({
  label,
  value,
  caption,
  isHighlighted = false,
  isLoading,
}: {
  label: string;
  value: string;
  caption: ReactNode;
  isHighlighted?: boolean;
  isLoading: boolean;
}) {
  return (
    <div className={`${CARD_CLASS_NAME} ${isHighlighted ? "!border-[#35B9C0]/30" : ""}`}>
      <div className={LABEL_CLASS_NAME}>{label}</div>

      {isLoading ? (
        <div className="mt-[clamp(8px,1.8vw,12px)] h-[clamp(26px,5vw,36px)] w-2/3 animate-pulse rounded-6 bg-white/10" />
      ) : (
        <div
          className={`mt-[clamp(8px,1.8vw,12px)] text-[clamp(22px,4.4vw,32px)] font-bold leading-[1.1]
            tabular-nums ${isHighlighted ? "text-[#35B9C0]" : "text-white"}`}
        >
          {value}
        </div>
      )}

      <div className="mt-[clamp(6px,1.4vw,10px)] text-[clamp(11px,2.2vw,12px)] text-[#7a8a9a]">{caption}</div>
    </div>
  );
}

/**
 * The board switcher.
 *
 * A segmented control rather than three stacked tables: the three boards rank
 * the same traders, so showing them one at a time keeps a single ranking on
 * screen and makes "am I higher on volume or on return?" a click rather than a
 * scroll between two tables.
 */
function BoardTabs({
  metric,
  onMetricChange,
}: {
  metric: CompetitionMetric;
  onMetricChange: (metric: CompetitionMetric) => void;
}) {
  const boards: { metric: CompetitionMetric; label: string }[] = [
    { metric: "volume", label: t`Highest Volume` },
    { metric: "pnl", label: t`Highest PnL` },
    { metric: "roi", label: t`Best Return` },
  ];

  return (
    <div
      role="tablist"
      aria-label={t`Leaderboard`}
      className="flex items-center gap-4 rounded-full border border-white/10 bg-[#081420]/80 p-4"
    >
      {boards.map((board) => {
        const isActive = board.metric === metric;

        return (
          <button
            key={board.metric}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onMetricChange(board.metric)}
            className={`whitespace-nowrap rounded-full px-[clamp(10px,2vw,16px)] py-[clamp(6px,1.2vw,8px)]
              text-[clamp(11px,2.2vw,13px)] font-semibold transition-colors ${
                isActive ? "bg-[#35B9C0]/15 text-[#35B9C0]" : "text-[#7a8a9a] hover:text-white"
              }`}
          >
            {board.label}
          </button>
        );
      })}
    </div>
  );
}

function StandingsTable({
  entries,
  me,
  metric,
  onMetricChange,
  page,
  pageCount,
  onPageChange,
  search,
  onSearchChange,
  hasStarted,
  startedAtLabel,
  isLoading,
  error,
}: {
  entries: CompetitionEntry[];
  me: CompetitionEntry | null;
  metric: CompetitionMetric;
  onMetricChange: (metric: CompetitionMetric) => void;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  search: string;
  onSearchChange: (search: string) => void;
  hasStarted: boolean;
  startedAtLabel: string;
  isLoading: boolean;
  error: string | null;
}) {
  /** Only pin the caller's row under the table when it is not already in it. */
  const isMeListed = me != null && entries.some((entry) => entry.address === me.address);

  return (
    <div className={`${CARD_CLASS_NAME} !p-0 overflow-hidden`}>
      <div
        className="flex flex-wrap items-center justify-between gap-12
          px-[clamp(14px,3vw,20px)] py-[clamp(12px,2.4vw,16px)]"
      >
        <BoardTabs metric={metric} onMetricChange={onMetricChange} />

        <div className="flex flex-1 items-center justify-end gap-12">
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t`Search name or wallet`}
            aria-label={t`Search the standings`}
            className="w-full max-w-[220px] rounded-8 border border-white/10 bg-[#081420]/80
              px-12 py-8 text-[clamp(11px,2.2vw,13px)] text-white placeholder:text-[#5d6f7e]
              focus:border-[#35B9C0]/40 focus:outline-none"
          />
          <span className="whitespace-nowrap text-[clamp(11px,2.2vw,12px)] text-[#7a8a9a]">
            <Trans>Refreshes every 30s</Trans>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto border-t border-white/10">
        <table className="w-full min-w-[840px] border-collapse">
          <thead>
            <tr className="text-left">
              <HeaderCell className="w-[80px]">
                <Trans>Rank</Trans>
              </HeaderCell>
              <HeaderCell>
                <Trans>Trader</Trans>
              </HeaderCell>
              <HeaderCell className="!text-right" isRankedBy={metric === "volume"}>
                <Trans>Volume</Trans>
              </HeaderCell>
              <HeaderCell className="!text-right" isRankedBy={metric === "pnl"}>
                <Trans>PnL</Trans>
              </HeaderCell>
              <HeaderCell className="!text-right" isRankedBy={metric === "roi"}>
                <Trans>Return</Trans>
              </HeaderCell>
              <HeaderCell className="!text-right">
                <Trans>Trades</Trans>
              </HeaderCell>
              <HeaderCell className="!text-right">
                <Trans>Est. Reward</Trans>
              </HeaderCell>
            </tr>
          </thead>

          <tbody>
            {isLoading && entries.length === 0 ? (
              [0, 1, 2, 3, 4].map((row) => <SkeletonRow key={row} />)
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-[clamp(14px,3vw,20px)] py-40 text-center text-14 text-[#7a8a9a]">
                  {!hasStarted ? (
                    <Trans>Trades count from {startedAtLabel} GMT. Nothing is scored before then.</Trans>
                  ) : error ? (
                    error
                  ) : search ? (
                    <Trans>No registered trader matches “{search}”.</Trans>
                  ) : (
                    <Trans>No trades yet. The first volume through puts you on top.</Trans>
                  )}
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <StandingsRow
                  key={entry.address}
                  entry={entry}
                  metric={metric}
                  isMe={entry.address === me?.address}
                />
              ))
            )}

            {me && !isMeListed && <StandingsRow entry={me} metric={metric} isMe isDetached />}
          </tbody>
        </table>
      </div>

      <div
        className="flex flex-col gap-4 border-t border-white/10 px-[clamp(14px,3vw,20px)]
          py-[clamp(8px,1.6vw,12px)] text-[clamp(11px,2.2vw,12px)] text-[#7a8a9a]"
      >
        {/*
          An estimate is only useful if its terms are on screen with it: which
          ranks are paid at all, out of what, and that today's figure is not a
          promise. Without that line the column reads as money already won.
        */}
        <p>
          <Trans>
            Top {LAST_PAID_RANK} on this board share {formatReward(getBoardPoolUsd(metric))}. Estimated from the
            current standings and confirmed after the post-competition review.
          </Trans>
        </p>

        {/*
          Return is a share of traded volume, not of deposits — saying so next to
          the board is the difference between an honest metric and one a trader
          reads as a claim about what their account made.
        */}
        {metric === "roi" && (
          <p>
            <Trans>
              Return is realised PnL as a share of traded volume. Final % PnL for rewards is calculated net of deposits
              and withdrawals at settlement.
            </Trans>
          </p>
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-12 border-t border-white/10
          px-[clamp(14px,3vw,20px)] py-[clamp(10px,2vw,14px)]"
        >
          <PageButton onClick={() => onPageChange(page - 1)} isDisabled={page <= 1}>
            <Trans>Previous</Trans>
          </PageButton>

          <span className="text-[clamp(11px,2.2vw,12px)] text-[#7a8a9a]">
            <Trans>
              Page {page} of {pageCount}
            </Trans>
          </span>

          <PageButton onClick={() => onPageChange(page + 1)} isDisabled={page >= pageCount}>
            <Trans>Next</Trans>
          </PageButton>
        </div>
      )}
    </div>
  );
}

function PageButton({
  children,
  onClick,
  isDisabled,
}: {
  children: ReactNode;
  onClick: () => void;
  isDisabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className="rounded-8 border border-white/10 px-12 py-6 text-[clamp(11px,2.2vw,12px)]
        font-semibold text-white transition-colors hover:border-[#35B9C0]/40
        disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10"
    >
      {children}
    </button>
  );
}

function HeaderCell({
  children,
  className = "",
  isRankedBy = false,
}: {
  children: ReactNode;
  className?: string;
  /** The column the active board ranks on — marked so the sort is never guessed at. */
  isRankedBy?: boolean;
}) {
  return (
    <th
      aria-sort={isRankedBy ? "descending" : undefined}
      className={`px-[clamp(10px,2vw,16px)] py-[clamp(8px,1.8vw,12px)] text-left text-[clamp(10px,2.2vw,11px)]
        font-semibold uppercase tracking-[0.14em] ${isRankedBy ? "text-[#35B9C0]" : "text-[#7a8a9a]"} ${className}`}
    >
      {children}
      {isRankedBy && (
        <span className="ml-4" aria-hidden>
          ↓
        </span>
      )}
    </th>
  );
}

function StandingsRow({
  entry,
  metric,
  isMe,
  isDetached = false,
}: {
  entry: CompetitionEntry;
  metric: CompetitionMetric;
  isMe: boolean;
  /** The caller's row pinned under the table because their rank falls outside it. */
  isDetached?: boolean;
}) {
  /**
   * What this trader would win on the board being shown, were it to settle now.
   * Zero — rendered as a dash — for an unpaid rank or a trader still under the
   * minimum qualifying volume.
   */
  const rewardUsd = getEstimatedRewardUsd(metric, entry.rank, entry.volume);

  /** The ranked column reads as the headline number; the rest stay secondary. */
  const cellClassName = (isRankedBy: boolean) =>
    `text-[clamp(12px,2.4vw,13px)] tabular-nums ${isRankedBy ? "font-semibold text-white" : "text-[#8296a5]"}`;

  return (
    <tr
      className={`border-t transition-colors ${
        isMe ? "border-[#35B9C0]/20 bg-[#35B9C0]/[0.06]" : "border-white/5 hover:bg-white/[0.03]"
      } ${isDetached ? "!border-t-2 !border-dashed !border-t-white/20" : ""}`}
    >
      <td className="px-[clamp(10px,2vw,16px)] py-[clamp(10px,2vw,14px)]">
        <span
          className={`text-[clamp(12px,2.4vw,14px)] font-bold tabular-nums ${isMe ? "text-[#35B9C0]" : "text-white"}`}
        >
          {entry.rank ? `#${entry.rank}` : "—"}
        </span>
      </td>

      <td className="px-[clamp(10px,2vw,16px)] py-[clamp(10px,2vw,14px)]">
        {/*
          Address only. The registration name is in the payload and renders
          fine, but the standings are a public page and a real name next to a
          wallet deanonymises someone's whole trading history — the address is
          what identifies a trader here.
        */}
        <div className="flex items-center gap-8">
          <span className="font-mono text-[clamp(12px,2.4vw,13px)] text-white">{shortenAddress(entry.address)}</span>
          {isMe && (
            <span className="rounded-full bg-[#35B9C0]/15 px-8 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#35B9C0]">
              <Trans>You</Trans>
            </span>
          )}
        </div>
      </td>

      <td className="px-[clamp(10px,2vw,16px)] py-[clamp(10px,2vw,14px)] text-right">
        <span className={cellClassName(metric === "volume")}>{formatMetric(entry, "volume")}</span>
      </td>

      <td className="px-[clamp(10px,2vw,16px)] py-[clamp(10px,2vw,14px)] text-right">
        <span
          className={`text-[clamp(12px,2.4vw,13px)] font-semibold tabular-nums ${
            entry.pnl > 0 ? "text-green-500" : entry.pnl < 0 ? "text-red-500" : "text-[#8296a5]"
          }`}
        >
          {formatMetric(entry, "pnl")}
        </span>
      </td>

      <td className="px-[clamp(10px,2vw,16px)] py-[clamp(10px,2vw,14px)] text-right">
        <span
          className={`text-[clamp(12px,2.4vw,13px)] font-semibold tabular-nums ${
            entry.roi > 0 ? "text-green-500" : entry.roi < 0 ? "text-red-500" : "text-[#8296a5]"
          }`}
        >
          {formatMetric(entry, "roi")}
        </span>
      </td>

      <td className="px-[clamp(10px,2vw,16px)] py-[clamp(10px,2vw,14px)] text-right">
        <span className={cellClassName(false)}>{entry.trades || "—"}</span>
      </td>

      <td className="px-[clamp(10px,2vw,16px)] py-[clamp(10px,2vw,14px)] text-right">
        <span
          className={`text-[clamp(12px,2.4vw,13px)] font-semibold tabular-nums ${
            rewardUsd > 0 ? "text-[#f7b731]" : "text-[#8296a5]"
          }`}
        >
          {rewardUsd > 0 ? formatReward(rewardUsd) : "—"}
        </span>
      </td>
    </tr>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-t border-white/5">
      {[0, 1, 2, 3, 4, 5, 6].map((cell) => (
        <td key={cell} className="px-[clamp(10px,2vw,16px)] py-[clamp(12px,2.4vw,16px)]">
          <div className="h-12 w-full animate-pulse rounded-4 bg-white/10" />
        </td>
      ))}
    </tr>
  );
}
