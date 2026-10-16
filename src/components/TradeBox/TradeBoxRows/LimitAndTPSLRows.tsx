import { t, Trans } from "@lingui/macro";
import { useCallback, useMemo, useRef } from "react";

import { selectSelectedMarketVisualMultiplier } from "context/SyntheticsStateContext/selectors/statsSelectors";
import {
  selectTradeboxAdvancedOptions,
  selectTradeboxSetAdvancedOptions,
  selectTradeboxTradeFlags,
} from "context/SyntheticsStateContext/selectors/tradeboxSelectors";
import { useSelector } from "context/SyntheticsStateContext/utils";
import { SidecarOrderEntryGroup } from "domain/synthetics/sidecarOrders/types";
import { useSidecarEntries } from "domain/synthetics/sidecarOrders/useSidecarEntries";
import { useSidecarOrders } from "domain/synthetics/sidecarOrders/useSidecarOrders";
import { PERCENTAGE_DECIMALS } from "domain/synthetics/sidecarOrders/utils";
import { formatAmount, formatPercentage, formatUsd, formatUsdPrice } from "lib/numbers";

import { ExpandableRow } from "components/ExpandableRow";
import { SyntheticsInfoRow } from "components/SyntheticsInfoRow";
import TooltipWithPortal from "components/Tooltip/TooltipWithPortal";

import PlusIcon from "img/ic_plus.svg?react";

import { EntryButton } from "../components/EntryButton";
import { SideOrderEntries } from "../components/SideOrderEntries";

function SideOrders({ type }: { type: "stopLoss" | "takeProfit" | "limit" }) {
  const { stopLoss, takeProfit, limit } = useSidecarOrders();
  const visualMultiplier = useSelector(selectSelectedMarketVisualMultiplier);
  const containerRef = useRef<HTMLDivElement>(null);

  const isStopLoss = type === "stopLoss";
  const isLimitGroup = type === "limit";

  const entriesInfo: SidecarOrderEntryGroup = {
    stopLoss: stopLoss,
    takeProfit: takeProfit,
    limit: limit,
  }[type];

  const handleAddEntry = useCallback(() => {
    entriesInfo.addEntry();

    requestAnimationFrame(() => {
      const inputs = containerRef.current?.querySelectorAll(".SideOrderInput");
      (inputs && (inputs[inputs.length - 1] as HTMLInputElement))?.focus();
    });
  }, [entriesInfo]);

  if (!entriesInfo || entriesInfo.entries.every((e) => e.txnType === "cancel")) return;

  const label = {
    stopLoss: t`Stop Loss`,
    takeProfit: t`Take Profit`,
    limit: t`Limit`,
  }[type];

  const labelPnl = isStopLoss ? t`Stop Loss PnL` : t`Take Profit PnL`;

  return (
    <>
      <SyntheticsInfoRow
        className="whitespace-nowrap leading-[16px]"
        label={
          <div className="flex items-center gap-6">
            {label}
            {entriesInfo.canAddEntry && (
              <TooltipWithPortal
                as="div"
                className="flex items-center"
                position="left-start"
                disabled={entriesInfo.allowAddEntry}
                content={
                  isStopLoss
                    ? t`Combined stop losses are at maximum (100%). Decrease existing values to add more orders.`
                    : t`Combined take profits are at maximum (100%). Decrease existing values to add more orders.`
                }
              >
                <EntryButton
                  theme="green"
                  onClick={handleAddEntry}
                  disabled={!entriesInfo.allowAddEntry}
                  className="-my-5"
                >
                  <PlusIcon className="size-12" />
                </EntryButton>
              </TooltipWithPortal>
            )}
          </div>
        }
        valueClassName="-my-5"
        value={
          <div className="profit-loss-wrapper" ref={containerRef}>
            <SideOrderEntries entriesInfo={entriesInfo} displayMode={type === "limit" ? "sizeUsd" : "percentage"} />
          </div>
        }
      />
      {(!isLimitGroup && entriesInfo.totalPnL !== undefined && entriesInfo.totalPnLPercentage !== undefined && (
        <SyntheticsInfoRow label={labelPnl} className="leading-[16px]">
          {entriesInfo.totalPnL === 0n ? (
            "-"
          ) : (
            <TooltipWithPortal
              handle={`${formatUsd(entriesInfo.totalPnL)} (${formatPercentage(entriesInfo?.totalPnLPercentage, {
                signed: true,
              })})`}
              position="bottom-end"
              handleClassName={
                entriesInfo.totalPnL !== undefined && entriesInfo.totalPnL < 0
                  ? "text-red-500 !decoration-red-500/50"
                  : "text-green-500 !decoration-green-500/50"
              }
              className="SLTP-pnl-tooltip"
              renderContent={() =>
                entriesInfo?.entries?.map((entry, index) => {
                  if (!entry || !entry.decreaseAmounts || entry.txnType === "cancel") return;

                  const price = formatUsdPrice(entry.price?.value ?? undefined, {
                    visualMultiplier,
                  });
                  const percentage =
                    entry.percentage?.value && formatAmount(entry.percentage.value, PERCENTAGE_DECIMALS, 0);

                  return (
                    <div className="mb-5 flex justify-between whitespace-nowrap" key={index}>
                      {(price && percentage && (
                        <span className="mr-15 whitespace-nowrap">
                          At {price}, {isStopLoss ? "SL" : "TP"} {percentage}%:
                        </span>
                      )) ||
                        null}

                      <span
                        className={
                          entry.decreaseAmounts?.realizedPnl && entry.decreaseAmounts?.realizedPnl < 0
                            ? "text-red-500"
                            : "text-green-500"
                        }
                      >
                        {formatUsd(entry.decreaseAmounts?.realizedPnl)} (
                        {formatPercentage(entry.decreaseAmounts?.realizedPnlPercentage, {
                          signed: true,
                        })}
                        )
                      </span>
                    </div>
                  );
                })
              }
            />
          )}
        </SyntheticsInfoRow>
      )) ||
        null}
    </>
  );
}

export function LimitAndTPSLRows({ hasExistingLimitOrder }: { hasExistingLimitOrder: boolean }) {
  return (
    <div className="flex flex-col gap-14 pt-12">
      <SideOrders type="limit" />
      {hasExistingLimitOrder && <div className="h-[0.5px] bg-slate-600" />}
      <SideOrders type="takeProfit" />
      <div className="h-[0.5px] bg-slate-600" />
      <SideOrders type="stopLoss" />
    </div>
  );
}

export function LimitAndTPSLGroup() {
  // Hide Take Profit / Stop Loss controls
  return null;
}
