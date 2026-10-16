import { Trans, t } from "@lingui/macro";
import cx from "classnames";
import { sub } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMedia } from "react-use";

import { getChainName } from "config/chains";
import { getIcon } from "config/icons";
import {
  useLeaderboardChainId,
  useLeaderboardDataTypeState,
  useLeaderboardIsCompetition,
  useLeaderboardPageKey,
  useLeaderboardPositions,
  useLeaderboardTimeframeTypeState,
  useLeaderboardTiming,
} from "context/SyntheticsStateContext/hooks/leaderboardHooks";
import { CompetitionType } from "domain/synthetics/leaderboard";
import { LEADERBOARD_PAGES } from "domain/synthetics/leaderboard/constants";
import { useChainId } from "lib/chains";
import { useDateRange } from "lib/dates";
import { mustNeverExist } from "lib/types";
import { switchNetwork } from "lib/wallets";
import useWallet from "lib/wallets/useWallet";

import { DateRangeSelect } from "components/DateRangeSelect/DateRangeSelect";
import ExternalLink from "components/ExternalLink/ExternalLink";
import SearchInput from "components/SearchInput/SearchInput";
import Tabs from "components/Tabs/Tabs";

import { CompetitionCountdown } from "./CompetitionCountdown";
import { CompetitionPrizes } from "./CompetitionPrizes";
import { LeaderboardAccountsTable } from "./LeaderboardAccountsTable";
import { MyQuestsPanel } from "./MyQuestsPanel";
import { LeaderboardNavigation } from "./LeaderboardNavigation";
import { LeaderboardPositionsTable } from "./LeaderboardPositionsTable";

import { selectLeaderboardIsLoading } from "context/SyntheticsStateContext/selectors/leaderboardSelectors";
import { useSelector } from "context/SyntheticsStateContext/utils";
import { BACKEND_URL } from "config/perpx";

const competitionsTabs = [0, 1];
const leaderboardTimeframeTabs = [0, 1, 2];
const leaderboardDataTypeTabs = [0, 1];

export function LeaderboardContainer() {
  const isCompetition = useLeaderboardIsCompetition();

  const [activeLeaderboardTimeframeIndex, setActiveLeaderboardTimeframeIndex] = useState(0);
  const [activeLeaderboardDataTypeIndex, setActiveLeaderboardDataTypeIndex] = useState(0);
  const [activeCompetitionIndex, setActiveCompetitionIndex] = useState(0);

  const leaderboardPageKey = useLeaderboardPageKey();

  const { chainId } = useChainId();
  const { active } = useWallet();

  const page = LEADERBOARD_PAGES[leaderboardPageKey];

  const [, setLeaderboardTimeframeType] = useLeaderboardTimeframeTypeState();
  const [leaderboardDataType, setLeaderboardDataType] = useLeaderboardDataTypeState();

  const competitionLabels = useMemo(() => [t`Top PnL ($)`, t`Top PnL (%)`], []);
  const leaderboardTimeframeLabels = useMemo(() => [t`Total`, t`Last 30 days`, t`Last 7 days`], []);
  const leaderboardDataTypeLabels = useMemo(() => [t`Top Addresses`, t`Top Positions`], []);

  const activeCompetition: CompetitionType | undefined = isCompetition
    ? activeCompetitionIndex === 0
      ? "notionalPnl"
      : "pnlPercentage"
    : undefined;

  const handleLeaderboardTimeframeTabChange = useCallback(
    (index: number) => setActiveLeaderboardTimeframeIndex(index),
    [setActiveLeaderboardTimeframeIndex]
  );
  const handleCompetitionTabChange = useCallback(
    (index: number) => setActiveCompetitionIndex(index),
    [setActiveCompetitionIndex]
  );

  const handleLeaderboardDataTypeTabChange = useCallback(
    (index: number) => setActiveLeaderboardDataTypeIndex(index),
    []
  );

  const pageKey = useLeaderboardPageKey();
  const leaderboardChainId = useLeaderboardChainId();

  useEffect(() => {
    setActiveLeaderboardTimeframeIndex(0);
    setActiveCompetitionIndex(0);
  }, [pageKey]);

  useEffect(() => {
    if (activeLeaderboardTimeframeIndex === 0) {
      setLeaderboardTimeframeType("all");
    } else if (activeLeaderboardTimeframeIndex === 1) {
      setLeaderboardTimeframeType("30days");
    } else {
      setLeaderboardTimeframeType("7days");
    }
  }, [activeLeaderboardTimeframeIndex, setLeaderboardTimeframeType]);

  useEffect(() => {
    if (activeLeaderboardDataTypeIndex === 0) {
      setLeaderboardDataType("accounts");
    } else {
      setLeaderboardDataType("positions");
    }
  }, [activeLeaderboardDataTypeIndex, setLeaderboardDataType]);

  const title = useMemo(() => {
    switch (leaderboardPageKey) {
      case "leaderboard":
        return t`Leaderboard`;

      case "march_13-20_2024":
        return t`EIP-4844 Competition`;

      case "march_20-27_2024":
        return t`EIP-4844 Competition`;

      default:
        throw mustNeverExist(leaderboardPageKey);
    }
  }, [leaderboardPageKey]);

  const handleSwitchNetworkClick = useCallback(() => {
    switchNetwork(leaderboardChainId, active);
  }, [active, leaderboardChainId]);

  const wrongNetworkSwitcher = useMemo(() => {
    if (leaderboardPageKey === "leaderboard") return null;
    if (chainId === leaderboardChainId) return null;
    if (!page.isCompetition) return null;

    return (
      <div className="Leaderboard__another-network">
        <Trans>
          This competition is held on the {getChainName(page.chainId)} network.{" "}
          <span className="link-underline" onClick={handleSwitchNetworkClick}>
            Change your network
          </span>{" "}
          to participate.
        </Trans>
      </div>
    );
  }, [chainId, handleSwitchNetworkClick, leaderboardChainId, leaderboardPageKey, page]);

  const isMobile = useMedia("(max-width: 1000px)");

  const description = useMemo(() => {
    switch (leaderboardPageKey) {
      case "leaderboard":
        return t`Leaderboard for traders on GMX V2.`;

      case "march_13-20_2024":
      case "march_20-27_2024":
        return (
          <>
            Powered by the Arbitrum DAO STIP.&nbsp;
            <ExternalLink href="https://open.substack.com/pub/gmxio/p/the-gmx-eip4844-trading-competition">
              <Trans>Read the rules</Trans>
            </ExternalLink>
            .{wrongNetworkSwitcher}{" "}
            {isMobile && (
              <>
                <CompetitionCountdown size="mobile" />
              </>
            )}
          </>
        );

      default:
        throw mustNeverExist(leaderboardPageKey);
    }
  }, [isMobile, leaderboardPageKey, wrongNetworkSwitcher]);

  const leaderboardDataTypeTabsOptions = useMemo(() => {
    return leaderboardDataTypeTabs.map((value) => ({
      value,
      label: leaderboardDataTypeLabels[value],
    }));
  }, [leaderboardDataTypeLabels]);

  const leaderboardTimeframeTabsOptions = useMemo(() => {
    return leaderboardTimeframeTabs.map((value) => ({
      value,
      label: leaderboardTimeframeLabels[value],
    }));
  }, [leaderboardTimeframeLabels]);

  const competitionsTabsOptions = useMemo(() => {
    return competitionsTabs.map((value) => ({
      value,
      label: competitionLabels[value],
    }));
  }, [competitionLabels]);

  const [searchAddress, setSearchAddress] = useState("");
  const [timeframeIndex, setTimeframeIndex] = useState(3); // 0=7D, 1=14D, 2=30D, 3=90D
  const [customStart, customEnd, setCustomDateRange] = useDateRange();
  const timeframeLabels = useMemo(() => [t`7D`, t`14D`, t`30D`, t`90D`], []);
  const timeframeOptions = useMemo(
    () =>
      [0, 1, 2, 3].map((value) => ({
        value,
        label: timeframeLabels[value],
      })),
    [timeframeLabels]
  );
  const handleTimeframeTabClick = useCallback(
    (value: number) => {
      setTimeframeIndex(value);
      setCustomDateRange([undefined, undefined]);
    },
    [setCustomDateRange]
  );
  const calendarStart = customStart ?? sub(new Date(), { days: [7, 14, 30, 90][timeframeIndex] ?? 90 });
  const calendarEnd = customEnd ?? new Date();

  return (
    <div className="GlobalLeaderboards mx-auto max-w-[1440px] px-16 py-32">
      <div className="Leaderboard-Title mb-32">
        <div>
          <h1 className="text-[42px] font-bold tracking-tight" data-qa="leaderboard-page">
            {title}
          </h1>
        </div>
      </div>

      <div className="LeaderboardPage__filter-bar flex flex-wrap items-center justify-between gap-16 rounded-t-8 border-b border-slate-600 bg-slate-800 px-20 py-16">
        <div className="LeaderboardPage__date-range flex items-center gap-8">
          <DateRangeSelect
            startDate={calendarStart}
            endDate={calendarEnd}
            onChange={setCustomDateRange}
            handleClassName="hover:!bg-slate-650 !bg-slate-700"
          />
        </div>
        <div className="LeaderboardPage__timeframe-tabs flex gap-4">
          {timeframeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleTimeframeTabClick(opt.value)}
              className={cx(
                "rounded-4 px-12 py-8 text-14 font-medium transition-colors",
                timeframeIndex === opt.value && !customStart && !customEnd
                  ? "bg-blue-500 text-white"
                  : "hover:bg-slate-650 bg-slate-700 text-typography-primary"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="LeaderboardPage__search min-w-[200px] max-w-[280px]">
          <SearchInput
            placeholder={t`Search address`}
            className="w-full *:!text-14"
            value={searchAddress}
            setValue={setSearchAddress}
            size="s"
          />
        </div>
      </div>

      {/* {!isCompetition && (
        <>
          <div className="LeaderboardContainer__competition-tabs default-container">
            <Tabs
              selectedValue={activeLeaderboardDataTypeIndex}
              onChange={handleLeaderboardDataTypeTabChange}
              options={leaderboardDataTypeTabsOptions}
            />
          </div>
        </>
      )} */}
      {/* {!isCompetition && (
        <Tabs
          selectedValue={activeLeaderboardTimeframeIndex}
          onChange={handleLeaderboardTimeframeTabChange}
          type="inline"
          options={leaderboardTimeframeTabsOptions}
          className={cx("LeaderboardContainer__leaderboard-tabs default-container", {
            "LeaderboardContainer__leaderboard-tabs_positions": leaderboardDataType === "positions",
          })}
        />
      )}

      {isCompetition && (
        <>
          <div className="LeaderboardContainer__competition-tabs default-container">
            <Tabs
              selectedValue={activeCompetitionIndex}
              onChange={handleCompetitionTabChange}
              options={competitionsTabsOptions}
            />
            {!isMobile && <CompetitionCountdown className="default-container" size="desktop" />}
          </div>
          <br />
          <br />
        </>
      )}
      {isCompetition && activeCompetition && (
        <CompetitionPrizes leaderboardPageKey={leaderboardPageKey} competitionType={activeCompetition} />
      )} */}

      <Table
        activeCompetition={activeCompetition}
        searchAddress={searchAddress}
        timeframeIndex={timeframeIndex}
        chainId={chainId}
        customStart={customStart}
        customEnd={customEnd}
      />
    </div>
  );
}

function Table({
  activeCompetition,
  searchAddress,
  timeframeIndex,
  chainId,
  customStart,
  customEnd,
}: {
  activeCompetition: CompetitionType | undefined;
  searchAddress: string;
  timeframeIndex: number;
  chainId: number;
  customStart?: Date;
  customEnd?: Date;
}) {
  const { isStartInFuture } = useLeaderboardTiming();
  const leaderboardPageKey = useLeaderboardPageKey();
  const leaderboardDataType = useLeaderboardDataTypeState()[0];
  if (isStartInFuture) return null;
  const table =
    leaderboardPageKey === "leaderboard" && leaderboardDataType === "positions" ? (
      <PositionsTable />
    ) : (
      <AccountsTable
        activeCompetition={activeCompetition}
        searchAddress={searchAddress}
        timeframeIndex={timeframeIndex}
        chainId={chainId}
        customStart={customStart}
        customEnd={customEnd}
      />
    );

  return <div className="w-full">{table}</div>;
}

/** Normalize a single leaderboard entry from the backend (handles MongoDB shape) */
function normalizeLeaderboardEntry(entry: any, index: number) {
  if (!entry) return null;
  const address = entry.address ?? entry.account ?? "";
  return {
    ...entry,
    address: String(address),
    account: String(address),
    volume: entry.volume != null ? String(entry.volume) : "0",
    // Left undefined when the endpoint doesn't return it, so the table falls back
    // to the `getLeaderboards` GraphQL query for today's volume.
    todayVolume: entry.todayVolume != null ? String(entry.todayVolume) : undefined,
    pnl: entry.pnl != null ? String(entry.pnl) : "0",
    rank: typeof entry.rank === "number" ? entry.rank : index + 1,
  };
}

function formatDateForApi(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function AccountsTable({
  activeCompetition,
  searchAddress,
  timeframeIndex,
  chainId,
  customStart,
  customEnd,
}: {
  activeCompetition: CompetitionType | undefined;
  searchAddress: string;
  timeframeIndex: number;
  chainId: number;
  customStart?: Date;
  customEnd?: Date;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => [7, 14, 30, 90][timeframeIndex] ?? 90, [timeframeIndex]);
  const useCustomRange = Boolean(customStart && customEnd);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: "1",
        limit: "100",
        sortOrder: "desc",
      });
      if (useCustomRange && customStart && customEnd) {
        params.set("fromDate", formatDateForApi(customStart));
        params.set("toDate", formatDateForApi(customEnd));
      } else {
        params.set("days", String(days));
      }
      const url = `${BACKEND_URL}/api/admin/leaderboard/combined?${params.toString()}`;

      try {
        const response = await fetch(url);
        const text = await response.text();
        let result: any;
        try {
          result = text ? JSON.parse(text) : {};
        } catch {
          setError("Invalid response from server");
          setData([]);
          return;
        }

        if (!response.ok) {
          setError(result?.message || `Request failed (${response.status})`);
          setData([]);
          return;
        }

        const rawList =
          result?.data?.leaderboards ?? result?.leaderboards ?? (Array.isArray(result?.data) ? result.data : []);

        const list = Array.isArray(rawList)
          ? rawList.map((entry: any, i: number) => normalizeLeaderboardEntry(entry, i)).filter(Boolean)
          : [];

        setData(list);
      } catch (err: any) {
        console.error("Error fetching leaderboard:", err);
        setError(err?.message || "Failed to load leaderboard");
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [days, timeframeIndex, useCustomRange, customStart, customEnd]);

  const accountsStruct = useMemo(
    () => ({
      isLoading: loading,
      data,
      error,
      updatedAt: 0,
    }),
    [data, loading, error]
  );

  return (
    <div className="flex flex-col gap-16">
      <LeaderboardAccountsTable
        activeCompetition={activeCompetition}
        accounts={accountsStruct}
        searchAddress={searchAddress}
        timeframeIndex={timeframeIndex}
      />
      <div className="flex justify-end">
        <MyQuestsPanel />
      </div>
    </div>
  );
}

function PositionsTable() {
  const positions = useLeaderboardPositions();
  const isLoading = useSelector(selectLeaderboardIsLoading);
  const positionsStruct = useMemo(
    () => ({
      isLoading,
      data: positions ? positions : [],
      error: null,
      updatedAt: 0,
    }),
    [positions, isLoading]
  );
  return <LeaderboardPositionsTable positions={positionsStruct} />;
}
