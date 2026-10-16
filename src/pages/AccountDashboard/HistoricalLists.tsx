import { Trans, t } from "@lingui/macro";
import cx from "classnames";
import { endOfDay, startOfDay, sub } from "date-fns";
import noop from "lodash/noop";
import { useCallback, useMemo, useState } from "react";
import type { Address } from "viem";

import { getAccountDashboardTabKey } from "config/localStorage";
import { selectPositionsInfoData } from "context/SyntheticsStateContext/selectors/globalSelectors";
import { useSelector } from "context/SyntheticsStateContext/utils";
import { useDateRange } from "lib/dates";
import { useLocalStorageSerializeKey } from "lib/localStorage";
import type { ContractsChainId } from "sdk/configs/chains";

import Badge from "components/Badge/Badge";
import { DateRangeSelect } from "components/DateRangeSelect/DateRangeSelect";
import { PositionList, type PositionListTableVariant } from "components/PositionList/PositionList";
import Tabs from "components/Tabs/Tabs";
import { AccountTradeHistory } from "components/AccountTradeHistory/AccountTradeHistory";

enum TabKey {
  Positions = "Positions",
  Trades = "Trades",
  // Claims = "Claims",
}

type Props = {
  chainId: ContractsChainId;
  account: Address;
};

function useTabLabels(): Record<TabKey, React.ReactNode> {
  const positionsCount = useSelector((s) => Object.keys(selectPositionsInfoData(s) || {}).length);

  const tabLabels = useMemo(
    () => ({
      [TabKey.Positions]: (
        <div className="flex items-center gap-8">
          <Trans>Positions</Trans> <Badge>{positionsCount}</Badge>
        </div>
      ),
      [TabKey.Trades]: t`Trades`,
      // [TabKey.Claims]: t`Claims`,
    }),
    [positionsCount]
  );

  return tabLabels;
}

const TIMEFRAME_DAYS = [null, 7, 14, 30, 90] as const; // null = All
const TIMEFRAME_LABELS: readonly string[] = ["All", "7D", "14D", "30D", "90D"];

export function HistoricalLists({ chainId, account }: Props) {
  const [tabKey, setTabKey] = useLocalStorageSerializeKey(getAccountDashboardTabKey(chainId), TabKey.Positions);

  const tabLabels = useTabLabels();


  const [customStart, customEnd, setCustomDateRange] = useDateRange();
  const [timeframeIndex, setTimeframeIndex] = useState(0); // default All (no date filter)

  const days = TIMEFRAME_DAYS[timeframeIndex];
  const calendarStart = customStart ?? (days != null ? sub(new Date(), { days }) : undefined);
  const calendarEnd = customEnd ?? (days != null ? new Date() : undefined);

  const startDateIso = useMemo(() => {
    if (customStart) return customStart.toISOString();
    if (days == null) return null;
    return startOfDay(sub(new Date(), { days })).toISOString();
  }, [timeframeIndex, customStart, days]);

  const endDateIso = useMemo(() => {
    if (customEnd) return customEnd.toISOString();
    if (days == null) return null;
    return endOfDay(new Date()).toISOString();
  }, [timeframeIndex, customEnd, days]);

  const handleTimeframeClick = useCallback((index: number) => {
    setTimeframeIndex(index);
    setCustomDateRange([undefined, undefined]);
  }, [setCustomDateRange]);

  const timeframeOptions = useMemo(
    () => [0, 1, 2, 3, 4].map((i) => ({ value: i, label: TIMEFRAME_LABELS[i] })),
    []
  );

  const tabsOptions = useMemo(
    () =>
      Object.values(TabKey).map((tab) => ({
        value: tab,
        label: tabLabels[tab],
      })),
    [tabLabels]
  );

  return (
    <div>
      <div className="AccountDashboard__filter-bar mb-12 flex flex-wrap items-center gap-12 rounded-8 border border-slate-600 bg-slate-800 px-16 py-12">
        <div className="flex items-center gap-8">
          <DateRangeSelect
            startDate={calendarStart}
            endDate={calendarEnd}
            onChange={setCustomDateRange}
            handleClassName="!bg-slate-700 hover:!bg-slate-650"
          />
        </div>
        <div className="flex gap-4">
          {timeframeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleTimeframeClick(opt.value)}
              className={cx(
                "rounded-4 px-12 py-8 text-14 font-medium transition-colors",
                timeframeIndex === opt.value && (opt.value === 0 || (!customStart && !customEnd))
                  ? "bg-blue-500 text-white"
                  : "bg-slate-700 text-typography-primary hover:bg-slate-650"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-hide">
        <Tabs
          options={tabsOptions}
          selectedValue={tabKey}
          onChange={setTabKey}
          type="block"
          className={cx("w-[max(100%,600px)] bg-slate-900 max-md:w-[max(100%,420px)]", {
            "max-lg:mb-8 max-lg:rounded-b-8": tabKey === TabKey.Positions,
          })}
          regularOptionClassname={cx({
            "max-lg:first:rounded-l-8 max-lg:last:rounded-r-8": tabKey === TabKey.Positions,
          })}
        />
      </div>

      {tabKey === TabKey.Positions && (
        <PositionList
          onOrdersClick={noop}
          onSelectPositionClick={noop}
          onClosePositionClick={noop}
          openSettings={noop}
          onCancelOrder={noop}
          hideActions
          tableVariant={"accountHistory" as PositionListTableVariant}
        />
      )}
      {tabKey === TabKey.Trades && (
        <AccountTradeHistory
          account={account}
          chainId={chainId}
          startDate={startDateIso}
          endDate={endDateIso}
        />
      )}
      {/* {tabKey === TabKey.Claims && <ClaimsHistory />} */}
    </div>
  );
}
