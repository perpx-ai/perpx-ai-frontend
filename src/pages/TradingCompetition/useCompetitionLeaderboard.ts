import { useCallback, useEffect, useMemo, useState } from "react";

import { CompetitionLeaderboardItem, fetchCompetitionLeaderboardPage } from "lib/api/userContact";
import useWallet from "lib/wallets/useWallet";

import { COMPETITION_VOLUME_FROM_ISO } from "./constants";
import { useCompetitionStarted } from "./useCompetitionStarted";

/** How often the standings refresh while the dashboard is open. */
const REFRESH_INTERVAL_MS = 30_000;

/** Rows the backend will return at once — it clamps `limit` to 100. */
const API_PAGE_SIZE = 100;

/**
 * Ceiling on how many pages are pulled to build one board.
 *
 * The endpoint returns registration order, so a correct ranking needs every
 * registered user, not the first page. At competition scale that is a handful
 * of requests, but it has to be bounded rather than trusting the count to stay
 * small — past this, the tail is left off and the board says so.
 */
const MAX_PAGES = 25;

/** Rows shown per page in the table. */
export const COMPETITION_PAGE_SIZE = 25;

/** How long typing settles before a search narrows the table. */
const SEARCH_DEBOUNCE_MS = 350;

/**
 * The three boards the competition runs in parallel. One fetch backs all
 * three — every number they rank on is on the same row — so switching boards
 * re-sorts what is already in memory rather than going back to the network.
 */
export type CompetitionMetric = "pnl" | "volume" | "roi";

/** A standings row, with the string-typed stats already parsed into numbers. */
export type CompetitionEntry = {
  /** Position on the active board, 1-based. */
  rank: number;
  address: string;
  /** The name given at registration. */
  name: string;
  /** Traded volume over the competition window, in USD. */
  volume: number;
  /** Volume traded in the current UTC day, in USD. */
  todayVolume: number;
  /** Realised PnL over the competition window, in USD. */
  pnl: number;
  /**
   * Return on traded volume, as a fraction — `pnl / volume`.
   *
   * Not the deposit-net % PnL the published rules settle on: the leaderboard
   * endpoint returns no deposits or account equity, so there is no denominator
   * here to compute that from. Volume traded is the one capital-at-risk figure
   * the row does carry, which is why the board is labelled "Return on Volume"
   * rather than ROI — it must not read as a claim about deposit-net return.
   * Swap this one expression when the endpoint carries net deposits.
   */
  roi: number;
  trades: number;
  /**
   * When the trader registered, as epoch ms — the tie-breaker for every board.
   *
   * Unknown registration times sort last among equals rather than throwing the
   * comparison off, so a missing timestamp costs that trader the tie instead of
   * scrambling the order around them.
   */
  registeredAtMs: number;
};

export type CompetitionLeaderboard = {
  /** The visible page of the active board, best first. */
  entries: CompetitionEntry[];
  /** The connected wallet's own row, present even when it falls outside `entries`. */
  me: CompetitionEntry | null;
  /** Summed volume of every registered trader, in USD. */
  totalVolume: number;
  /** Summed realised PnL of every registered trader, in USD. */
  totalPnl: number;
  /** The connected wallet's volume in USD; 0 before they have traded. */
  myVolume: number;
  /** Every registered trader, including those who have not traded yet. */
  traderCount: number;
  /** Which board is being shown, and how to change it. */
  metric: CompetitionMetric;
  setMetric: (metric: CompetitionMetric) => void;
  /**
   * Whether the counting window has opened. False means there is nothing to
   * show yet by design, not that anything failed.
   */
  hasStarted: boolean;
  /**
   * The window the numbers cover, as the backend reports it. Nulls mean it
   * returned lifetime totals — the standings are showing more than the
   * competition if that happens unexpectedly.
   */
  period: { fromDate: string | null; toDate: string | null };
  page: number;
  pageCount: number;
  setPage: (page: number) => void;
  search: string;
  setSearch: (search: string) => void;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
};

/** A row as it arrives, before any board has ranked it. */
type ParsedEntry = Omit<CompetitionEntry, "rank">;

/** `"12500.5"` and `null` alike have to come out as a usable number. */
function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Drops `email` on the way in — it is never needed to render a standings row. */
function toEntry(item: CompetitionLeaderboardItem): ParsedEntry {
  const volume = toNumber(item.stats?.totalVolume);
  const pnl = toNumber(item.stats?.pnl);
  const registeredAtMs = Date.parse(item.registeredAt ?? "");

  return {
    address: String(item.address ?? "").toLowerCase(),
    name: item.name,
    volume,
    todayVolume: toNumber(item.stats?.todayVolume),
    pnl,
    // A trader with no volume has no return rather than an infinite one.
    roi: volume > 0 ? pnl / volume : 0,
    trades: toNumber(item.stats?.noOfTrades),
    registeredAtMs: Number.isFinite(registeredAtMs) ? registeredAtMs : Number.MAX_SAFE_INTEGER,
  };
}

/**
 * Ranks a board by one metric, best first, giving every trader a distinct rank.
 *
 * Ties break on who registered first, which is the published rule. That choice
 * does more work than it looks: without it, every trader who has not traded yet
 * is tied on zero and shares one rank, so a board opens as a wall of identical
 * positions — #10 repeated down the page — and no one below the traded rows can
 * tell where they stand or what it would take to move. Registration time is
 * already known for everyone, never ties in practice, and rewards showing up
 * early, so the board reads 1, 2, 3… all the way down from the first render.
 */
function rankBy(entries: ParsedEntry[], metric: CompetitionMetric): CompetitionEntry[] {
  const sorted = [...entries].sort(
    (a, b) => b[metric] - a[metric] || a.registeredAtMs - b.registeredAtMs
  );

  return sorted.map((entry, index) => ({ rank: index + 1, ...entry }));
}

/**
 * Pulls every page of the leaderboard endpoint.
 *
 * Ranking is left to the caller because three boards rank the same rows three
 * ways. What cannot be left alone is parsing: `stats.totalVolume` and
 * `stats.pnl` arrive as strings, and sorted as text "9" outranks "10000".
 */
async function fetchBoard(signal: AbortSignal): Promise<{
  entries: ParsedEntry[];
  period: { fromDate: string | null; toDate: string | null };
  isTruncated: boolean;
}> {
  const firstPage = await fetchCompetitionLeaderboardPage({
    page: 1,
    limit: API_PAGE_SIZE,
    fromDate: COMPETITION_VOLUME_FROM_ISO,
    signal,
  });

  const pageCount = Math.max(firstPage.pagination?.pages ?? 1, 1);
  const pagesToFetch = Math.min(pageCount, MAX_PAGES);

  const rest = await Promise.all(
    Array.from({ length: pagesToFetch - 1 }, (_, index) =>
      fetchCompetitionLeaderboardPage({
        page: index + 2,
        limit: API_PAGE_SIZE,
        fromDate: COMPETITION_VOLUME_FROM_ISO,
        signal,
      })
    )
  );

  const entries = [firstPage, ...rest].flatMap((response) => response.items ?? []).map(toEntry);

  return { entries, period: firstPage.period, isTruncated: pageCount > pagesToFetch };
}

/**
 * Competition standings, from `GET /api/user-contact/leaderboard`.
 *
 * That endpoint starts from the registrations and joins trading stats onto
 * them, so the board is the competition's own roster: someone who signed up and
 * has not traded yet still appears, at the bottom, rather than being invisible
 * until their first fill.
 *
 * The whole board is held here and both ranked and paged locally. Ranking
 * cannot be done a page at a time — the endpoint orders by registration date,
 * not by any of the three metrics — so once every row has been pulled, sorting
 * and paging the copy in memory is both cheaper and the only way `rank`, the
 * totals and the caller's own row stay consistent as the table moves between
 * pages and boards.
 */
export function useCompetitionLeaderboard(initialMetric: CompetitionMetric = "volume"): CompetitionLeaderboard {
  const { account } = useWallet();
  const hasStarted = useCompetitionStarted();

  const [parsed, setParsed] = useState<ParsedEntry[] | null>(null);
  const [period, setPeriod] = useState<{ fromDate: string | null; toDate: string | null }>({
    fromDate: null,
    toDate: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<CompetitionMetric>(initialMetric);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  /** Bumped by `refresh` and by the poll below to re-run the query. */
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [search]);

  /** A new search, or a different board, is a different list — start at page 1. */
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, metric]);

  useEffect(() => {
    // Before the window opens there is nothing to ask for: `fromDate` would be
    // in the future, which the endpoint rejects outright. That rejection is
    // correct but it is not a failure — showing its message as an error would
    // tell the visitor something broke when the competition simply has not
    // started. `useCompetitionStarted` flips exactly at the start instant, so
    // the fetch below runs the moment there is a window to count.
    if (!hasStarted) {
      setParsed([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let isStale = false;

    // Only the first load blanks the dashboard; a poll leaves the current
    // standings on screen while the next answer is in flight.
    setIsLoading((wasLoading) => wasLoading || parsed === null);

    fetchBoard(controller.signal)
      .then((board) => {
        if (isStale) {
          return;
        }
        setParsed(board.entries);
        setPeriod(board.period);
        setError(null);
      })
      .catch((fetchError: any) => {
        // An abort is this effect tearing itself down, not a failure to show.
        if (isStale || fetchError?.name === "AbortError") {
          return;
        }
        setError(fetchError?.message || "Could not load the standings");
      })
      .finally(() => {
        if (!isStale) {
          setIsLoading(false);
        }
      });

    return () => {
      isStale = true;
      controller.abort();
    };
    // `parsed` is read above only to decide whether to show the loading state;
    // depending on it would re-query on every answer. `metric` is absent on
    // purpose — switching boards re-sorts what is already here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted, reloadToken]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [refresh]);

  /** Re-sorting the whole roster is the cost of a board switch — do it once. */
  const board = useMemo(() => rankBy(parsed ?? [], metric), [parsed, metric]);

  /**
   * Search narrows the ranked board rather than the fetch: ranking only the
   * matches would put any lone hit at #1 with #1's reward. The totals and the
   * caller's own row stay on the whole board, so the stat cards hold still while
   * typing.
   */
  const visible = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) {
      return board;
    }
    return board.filter(
      (entry) => entry.address.includes(query) || (entry.name ?? "").toLowerCase().includes(query)
    );
  }, [board, debouncedSearch]);

  const normalizedAccount = account?.toLowerCase();
  const me = normalizedAccount ? (board.find((entry) => entry.address === normalizedAccount) ?? null) : null;
  const pageCount = Math.max(Math.ceil(visible.length / COMPETITION_PAGE_SIZE), 1);
  /** A board that shrank under the current page — after a search — snaps back. */
  const safePage = Math.min(page, pageCount);

  return {
    entries: visible.slice((safePage - 1) * COMPETITION_PAGE_SIZE, safePage * COMPETITION_PAGE_SIZE),
    me,
    totalVolume: board.reduce((sum, entry) => sum + entry.volume, 0),
    totalPnl: board.reduce((sum, entry) => sum + entry.pnl, 0),
    myVolume: me?.volume ?? 0,
    traderCount: board.length,
    metric,
    setMetric,
    hasStarted,
    period,
    page: safePage,
    pageCount,
    setPage,
    search,
    setSearch,
    isLoading,
    error,
    refresh,
  };
}
