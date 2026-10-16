import { Trans, t } from "@lingui/macro";
import cx from "classnames";
import { ReactNode, memo, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useHistory } from "react-router-dom";

import {
  CompetitionType,
  LeaderboardAccount,
  RemoteData,
  parseUsdStringToE30,
  useLeaderboardTodayVolumes,
} from "domain/synthetics/leaderboard";
import { arenaClient, GET_ARENA_BATCH, ArenaBatchState } from "domain/arena";
import { useDebounce } from "lib/debounce/useDebounce";
import { formatUsd } from "lib/numbers";
import { fetchRangeStats } from "lib/api/trades";
import { buildAccountDashboardUrl } from "pages/AccountDashboard/buildAccountDashboardUrl";

import { BottomTablePagination } from "components/Pagination/BottomTablePagination";
import { CellSkeleton, TopAccountsSkeleton } from "components/Skeleton/Skeleton";
import { TableTd, TableTh, TableTheadTr, TableTr } from "components/Table/Table";
import { TooltipPosition } from "components/Tooltip/Tooltip";
import TooltipWithPortal from "components/Tooltip/TooltipWithPortal";

import rank1Svg from "img/rank1.svg";
import rank2Svg from "img/rank2.svg";
import rank3Svg from "img/rank3.svg";

const PER_PAGE = 20;

type SortKey = "rank" | "volume" | "todayVolume" | "pnl";

/**
 * Today's volume comes from the backend leaderboard API as a USD string.
 * It is on the row when the REST leaderboard already returns it, otherwise it
 * is looked up in the `getLeaderboards` map. Returns null when unknown.
 */
function resolveTodayVolume(account: any, todayVolumeByAddress: Record<string, bigint>): bigint | null {
  if (account?.todayVolume != null && account.todayVolume !== "") {
    return parseUsdStringToE30(account.todayVolume);
  }
  const address = (account?.address || account?.account || "").toLowerCase();
  const mapped = address ? todayVolumeByAddress[address] : undefined;
  return mapped ?? null;
}

export function LeaderboardAccountsTable({
  accounts,
  activeCompetition,
  searchAddress = "",
  timeframeIndex = 3,
}: {
  accounts: RemoteData<LeaderboardAccount>;
  activeCompetition: CompetitionType | undefined;
  searchAddress?: string;
  timeframeIndex?: number;
}) {
  const { isLoading, data, error } = accounts;
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statsByAddress, setStatsByAddress] = useState<Record<string, { volumeE30: bigint; pnlE30: bigint }>>({});
  const [pnlLoading, setPnlLoading] = useState(false);
  const [arenaByAddress, setArenaByAddress] = useState<Record<string, ArenaBatchState>>({});
  const { todayVolumeByAddress, isLoading: todayVolumeLoading } = useLeaderboardTodayVolumes();
  const term = useDebounce(searchAddress, 300);
  // Map leaderboard timeframeIndex to the stats window in days
  const statsDays = [7, 14, 30, 365][timeframeIndex] ?? 365;

  useEffect(() => {
    setPage(1);
  }, [term]);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const aAny = a as any;
      const bAny = b as any;
      const mult = sortDir === "asc" ? 1 : -1;
      if (sortKey === "rank") {
        const aRank = Number(aAny.rank) || 0;
        const bRank = Number(bAny.rank) || 0;
        return mult * (aRank > bRank ? 1 : aRank < bRank ? -1 : 0);
      }
      if (sortKey === "todayVolume") {
        const aToday = Number(resolveTodayVolume(aAny, todayVolumeByAddress) ?? 0n);
        const bToday = Number(resolveTodayVolume(bAny, todayVolumeByAddress) ?? 0n);
        return mult * (aToday > bToday ? 1 : aToday < bToday ? -1 : 0);
      }
      const addrA = (aAny.address || aAny.account || "").toLowerCase();
      const addrB = (bAny.address || bAny.account || "").toLowerCase();
      const statsA = statsByAddress[addrA];
      const statsB = statsByAddress[addrB];
      if (sortKey === "volume") {
        const aVol = Number(statsA?.volumeE30 ?? 0n);
        const bVol = Number(statsB?.volumeE30 ?? 0n);
        return mult * (aVol > bVol ? 1 : aVol < bVol ? -1 : 0);
      }
      const aPnl = Number(statsA?.pnlE30 ?? 0n);
      const bPnl = Number(statsB?.pnlE30 ?? 0n);
      return mult * (aPnl > bPnl ? 1 : aPnl < bPnl ? -1 : 0);
    });
  }, [data, sortKey, sortDir, statsByAddress, todayVolumeByAddress]);

  const filteredStats = useMemo(() => {
    const q = term.toLowerCase().trim();
    if (!q) return sorted;
    return sorted.filter((a) => {
      const addr = (a as any).address || a.account || "";
      return String(addr).toLowerCase().indexOf(q) >= 0;
    });
  }, [sorted, term]);

  const indexFrom = (page - 1) * PER_PAGE;
  const rowsData = useMemo(
    () => filteredStats.slice(indexFrom, indexFrom + PER_PAGE),
    [filteredStats, indexFrom]
  );
  const pageCount = Math.ceil(filteredStats.length / PER_PAGE);

  const addresses = useMemo(
    () => rowsData.map((r) => ((r as any).address || (r as any).account || "").toLowerCase()).filter(Boolean),
    [rowsData]
  );

  // Competition stats from the backend: GMX (custody wallet) + Hyperliquid + manual
  // corrections, so rows match the competition page and the account dashboard.
  useEffect(() => {
    if (addresses.length === 0) {
      setStatsByAddress({});
      return;
    }
    let cancelled = false;
    setPnlLoading(true);
    fetchRangeStats(addresses, statsDays)
      .then((data) => {
        if (cancelled) return;
        const next: Record<string, { volumeE30: bigint; pnlE30: bigint }> = {};
        for (const [addr, stats] of Object.entries(data)) {
          next[addr.toLowerCase()] = {
            // Convert USD float → 1e30 bigint (same formula as useAccountTradeStats)
            volumeE30: BigInt(Math.round((stats.volume ?? 0) * 1_000_000)) * 10n ** 24n,
            pnlE30: BigInt(Math.round((stats.pnl ?? 0) * 1_000_000)) * 10n ** 24n,
          };
        }
        setStatsByAddress(next);
      })
      .catch(() => !cancelled && setStatsByAddress({}))
      .finally(() => !cancelled && setPnlLoading(false));
    return () => {
      cancelled = true;
    };
  }, [addresses.join(","), statsDays]);

  useEffect(() => {
    if (addresses.length === 0) {
      setArenaByAddress({});
      return;
    }
    arenaClient
      .query({
        query: GET_ARENA_BATCH,
        variables: { addresses },
        fetchPolicy: "network-only",
      })
      .then((res: any) => {
        const map: Record<string, ArenaBatchState> = {};
        (res?.data?.arenaBatchStates ?? []).forEach((s: ArenaBatchState) => {
          map[s.address] = s;
        });
        setArenaByAddress(map);
      })
      .catch(() => setArenaByAddress({}));
  }, [addresses.join(",")]);

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      else {
        setSortKey(key);
        setSortDir(key === "rank" ? "asc" : "desc");
      }
      setPage(1);
    },
    [sortKey, sortDir]
  );

  const content = isLoading ? (
    <TopAccountsSkeleton count={PER_PAGE} />
  ) : error ? (
    <TableTr hoverable={false} className="h-47">
      <TableTd colSpan={9} className="align-middle py-24 text-center">
        <p className="text-typography-secondary">
          <Trans>Failed to load leaderboard</Trans>: {typeof error === "string" ? error : error?.message}
        </p>
        <p className="mt-8 text-14 text-slate-500">
          <Trans>Check that the backend is running and VITE_BACKEND_URL is correct.</Trans>
        </p>
      </TableTd>
    </TableTr>
  ) : (
    <>
      {rowsData.length ? (
        rowsData.map((account, index) => {
          const rank = (account as any).rank ?? indexFrom + index + 1;
          const address = ((account as any).address || account.account || "").toLowerCase();
          const stats = statsByAddress[address];
          const pnlUsd = stats && stats.pnlE30 !== 0n ? stats.pnlE30 : null;
          const volumeUsd = stats && stats.volumeE30 !== 0n ? stats.volumeE30 : null;
          return (
            <TableRow
              key={(account as any).address || account.account}
              account={account}
              index={indexFrom + index}
              rank={rank}
              activeCompetition={activeCompetition}
              pnlUsd={pnlUsd}
              volumeUsd={volumeUsd}
              todayVolumeUsd={resolveTodayVolume(account, todayVolumeByAddress)}
              todayVolumeLoading={todayVolumeLoading}
              pnlLoading={pnlLoading}
              arena={arenaByAddress[address]}
            />
          );
        })
      ) : (
        <EmptyRow />
      )}
    </>
  );

  return (
    <div className="rounded-b-8 overflow-hidden bg-slate-800 TableBox">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] table-fixed LeaderboardPage__table">
          <thead>
            <TableTheadTr bordered className="text-[16px] font-semibold">
              <TableHeaderCell
              title={t`Rank`}
              width={7}
              tooltipPosition="bottom-start"
              sortable
              sortDirection={sortKey === "rank" ? sortDir : undefined}
              onSort={() => toggleSort("rank")}
            />
              <TableHeaderCell title={t`Trader`} width={20} tooltipPosition="bottom-end" />
              <TableHeaderCell title={t`Address`} width={13} tooltipPosition="bottom-end" />
              <TableHeaderCell
                title={t`Volume`}
                width={14}
                tooltipPosition="bottom-end"
                textAlign="right"
                sortable
                sortDirection={sortKey === "volume" ? sortDir : undefined}
                onSort={() => toggleSort("volume")}
              />
              <TableHeaderCell
                title={t`Today's Volume`}
                tooltip={<Trans>Volume traded since 00:00 UTC. Resets daily.</Trans>}
                width={15}
                tooltipPosition="bottom-end"
                textAlign="right"
                sortable
                sortDirection={sortKey === "todayVolume" ? sortDir : undefined}
                onSort={() => toggleSort("todayVolume")}
              />
              <TableHeaderCell
                title={t`PnL`}
                width={13}
                tooltipPosition="bottom-end"
                textAlign="right"
                sortable
                sortDirection={sortKey === "pnl" ? sortDir : undefined}
                onSort={() => toggleSort("pnl")}
              />
              <TableHeaderCell title={t`Letters`} width={10} textAlign="center" />
              <TableHeaderCell title={t`Raffle`} width={8} textAlign="right" />
            </TableTheadTr>
          </thead>
          <tbody>{content}</tbody>
        </table>
      </div>
      <BottomTablePagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}

const SortArrow = ({ direction }: { direction: "asc" | "desc" }) => (
  <span className="ml-4 inline-block text-12 text-slate-400">
    {direction === "asc" ? "↑" : "↓"}
  </span>
);

const TableHeaderCell = memo(
  ({
    breakpoint,
    title,
    tooltip,
    tooltipPosition,
    width,
    textAlign = "left",
    sortable,
    sortDirection,
    onSort,
  }: {
    title: string;
    tooltip?: ReactNode;
    tooltipPosition?: TooltipPosition;
    width?: number | ((breakpoint?: string) => number);
    breakpoint?: string;
    textAlign?: "left" | "center" | "right";
    sortable?: boolean;
    sortDirection?: "asc" | "desc";
    onSort?: () => void;
  }) => {
    const style =
      width !== undefined
        ? {
            width: `${typeof width === "function" ? width(breakpoint) : width}%`,
            textAlign,
            verticalAlign: "middle" as const,
          }
        : { textAlign, verticalAlign: "middle" as const };

    const stopPropagation = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

    const alignClass = textAlign === "right" ? "text-right justify-end" : textAlign === "center" ? "text-center justify-center" : "text-left justify-start";

    if (sortable && onSort) {
      return (
        <TableTh style={style} className={alignClass}>
          <div
            className="inline-flex cursor-pointer items-center font-bold text-white hover:text-blue-300"
            onClick={onSort}
          >
            {tooltip ? (
              <TooltipWithPortal
                handle={
                  <span className="whitespace-nowrap">
                    {title}
                    {sortDirection && <SortArrow direction={sortDirection} />}
                  </span>
                }
                position={tooltipPosition || "bottom"}
                content={<div onClick={stopPropagation}>{tooltip}</div>}
              />
            ) : (
              <span className="whitespace-nowrap">
                {title}
                {sortDirection && <SortArrow direction={sortDirection} />}
              </span>
            )}
          </div>
        </TableTh>
      );
    }

    return (
      <TableTh style={style} className={alignClass}>
        {tooltip ? (
          <TooltipWithPortal
            handle={<span className="whitespace-nowrap font-bold text-white">{title}</span>}
            position={tooltipPosition || "bottom"}
            content={<div onClick={stopPropagation}>{tooltip}</div>}
          />
        ) : (
          <span className="whitespace-nowrap font-bold text-white">{title}</span>
        )}
      </TableTh>
    );
  }
);


const Rank1Icon = () => <img src={rank1Svg} alt="" className="LeaderboardPage__rank-icon LeaderboardPage__rank-icon--1" />;
const Rank2Icon = () => <img src={rank2Svg} alt="" className="LeaderboardPage__rank-icon LeaderboardPage__rank-icon--2" />;
const Rank3Icon = () => <img src={rank3Svg} alt="" className="LeaderboardPage__rank-icon LeaderboardPage__rank-icon--3" />;

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

function TraderAvatar({ address, level, tier }: { address: string; level: number; tier: number }) {
  const [light, dark] = TIER_COLORS[Math.min(Math.max(tier, 0), TIER_COLORS.length - 1)];
  const initial = (address || "?").slice(2, 3).toUpperCase();
  return (
    <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
      <svg viewBox="0 0 40 40" width={36} height={36}>
        <defs>
          <radialGradient id={`av-${address}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={light} />
            <stop offset="100%" stopColor={dark} />
          </radialGradient>
        </defs>
        <circle cx="20" cy="20" r="18" fill={`url(#av-${address})`} />
        <circle cx="20" cy="20" r="18" fill="none" stroke={light} strokeOpacity="0.6" strokeWidth="1.5" />
        <text
          x="20"
          y="24"
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          fill="#0b1220"
        >
          {initial}
        </text>
      </svg>
      <span className="absolute -bottom-2 -right-2 rounded-full border border-slate-800 bg-slate-900 px-4 text-[9px] font-bold text-green-500">
        {level}
      </span>
    </div>
  );
}

const TableRow = memo(
  ({
    account,
    rank,
    activeCompetition,
    index,
    pnlUsd,
    volumeUsd,
    todayVolumeUsd,
    todayVolumeLoading,
    pnlLoading,
    arena,
  }: {
    account: LeaderboardAccount;
    index: number;
    rank: number;
    activeCompetition: CompetitionType | undefined;
    pnlUsd: bigint | null;
    volumeUsd: bigint | null;
    todayVolumeUsd: bigint | null;
    todayVolumeLoading: boolean;
    pnlLoading: boolean;
    arena?: ArenaBatchState;
  }) => {
    const accountData = account as any;
    const address = accountData.address || account.account || "";
    const isTopThree = rank <= 3;

    // Volume + PnL: subsquid only
    const pnlNum = pnlUsd !== null ? Number(pnlUsd) : null;
    const pnlDisplay =
      pnlLoading ? (
        <CellSkeleton width={70} />
      ) : pnlUsd !== null ? (
        formatUsd(pnlUsd, { maxThreshold: null, displayPlus: true })
      ) : (
        "—"
      );
    const pnlPositive = pnlNum != null && pnlNum > 0;
    const pnlNegative = pnlNum != null && pnlNum < 0;

    const volumeDisplay = pnlLoading ? (
      <CellSkeleton width={90} />
    ) : volumeUsd !== null ? (
      formatUsd(volumeUsd, { maxThreshold: null })
    ) : (
      "—"
    );

    // "0" is a normal value here: the trader simply hasn't traded since 00:00 UTC.
    const todayVolumeDisplay =
      todayVolumeUsd !== null ? (
        formatUsd(todayVolumeUsd, { maxThreshold: null })
      ) : todayVolumeLoading ? (
        <CellSkeleton width={80} />
      ) : (
        "—"
      );

    const handleCopyAddress = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (address && navigator.clipboard) navigator.clipboard.writeText(address);
      },
      [address]
    );

    const history = useHistory();
    const accountUrl = address ? buildAccountDashboardUrl(address, undefined, 2) : "#";

    const handleRowClick = useCallback(
      (e: React.MouseEvent) => {
        if (!address) return;
        const target = e.target as HTMLElement;
        if (target.closest("button") || target.closest("a")) return;
        history.push(accountUrl);
      },
      [address, accountUrl, history]
    );

    const rankCell = (
      <div className="LeaderboardPage__rank-cell flex items-center gap-8">
        {rank === 1 ? <span className="ml-3"><Rank1Icon /></span> : rank === 2 ? <span className="ml-3"><Rank2Icon /></span> : rank === 3 ? <span className="ml-3"><Rank3Icon /></span> : (
          <span className="LeaderboardPage__rank-num">{rank}</span>
        )}
      </div>
    );

    return (
      <TableTr
        key={address}
        role={address ? "button" : undefined}
        tabIndex={address ? 0 : undefined}
        onClick={address ? handleRowClick : undefined}
        onKeyDown={
          address
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  history.push(accountUrl);
                }
              }
            : undefined
        }
        className={cx(
          "LeaderboardPage__row",
          rank === 1 && "LeaderboardPage__row--rank-1",
          rank === 2 && "LeaderboardPage__row--rank-2",
          rank === 3 && "LeaderboardPage__row--rank-3",
          address && "cursor-pointer"
        )}
      >
        <TableTd className="align-middle text-left LeaderboardPage__cell-rank">
          {rankCell}
        </TableTd>
        <TableTd className="align-middle text-left">
          <div className="flex items-center gap-10">
            <TraderAvatar address={address} level={arena?.level ?? 1} tier={arena?.tier ?? 0} />
            <div className="min-w-0">
              <div className="text-body-small font-bold text-white">
                Lv. {arena?.level ?? 1}
              </div>
              <div className="font-mono text-caption text-slate-100 opacity-70">
                Trader{address ? address.slice(0, 6) : ""}
              </div>
            </div>
          </div>
        </TableTd>
        <TableTd className="align-middle text-left">
          <div className="flex items-center gap-8">
            {address ? (
              <Link
                to={accountUrl}
                className="font-mono text-14 text-typography-primary hover:text-blue-400 hover:underline"
              >
                {address.length > 14 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address}
              </Link>
            ) : (
              <span className="font-mono text-14 text-typography-primary">—</span>
            )}
            <button
              type="button"
              onClick={handleCopyAddress}
              className="rounded-full p-4 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              aria-label={t`Copy address`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>
        </TableTd>
        <TableTd className="align-middle text-right font-medium tabular-nums text-typography-primary">
          {volumeDisplay}
        </TableTd>
        <TableTd
          className={cx(
            "align-middle text-right font-medium tabular-nums",
            todayVolumeUsd !== null && todayVolumeUsd > 0n
              ? "text-typography-primary"
              : "text-typography-secondary"
          )}
        >
          {todayVolumeDisplay}
        </TableTd>
        <TableTd
          className={cx(
            "align-middle text-right font-medium tabular-nums",
            pnlPositive && "text-green-400",
            pnlNegative && "text-red-400",
            (pnlNum == null || pnlNum === 0) && "text-typography-secondary"
          )}
        >
          {pnlDisplay}
        </TableTd>
        <TableTd className="align-middle text-center">
          {arena?.letters?.length ? (
            <span className="font-mono text-body-small font-bold text-green-500">
              {arena.letters.join("-")}
            </span>
          ) : (
            <span className="text-slate-100 opacity-40">—</span>
          )}
        </TableTd>
        <TableTd className="align-middle text-right">
          <span
            className={cx(
              "inline-flex items-center gap-4 rounded-full px-8 py-2 text-caption font-semibold",
              arena?.raffleTickets
                ? "bg-[#FFB347]/15 text-[#FFB347]"
                : "bg-slate-700 text-slate-100 opacity-60"
            )}
          >
            🎟 ×{arena?.raffleTickets ?? 0}
          </span>
        </TableTd>
      </TableTr>
    );
  }
);

const EmptyRow = memo(() => (
  <TableTr hoverable={false} className="h-47">
    <TableTd colSpan={9} className="align-top text-slate-100">
      <Trans>No results found</Trans>
    </TableTd>
  </TableTr>
));

