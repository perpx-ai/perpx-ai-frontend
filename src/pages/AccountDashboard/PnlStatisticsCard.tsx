import { Trans, t } from "@lingui/macro";
import cx from "classnames";
import type { Address } from "viem";

import { usePnlSummaryData } from "domain/synthetics/accountStats";
import { formatUsd } from "lib/numbers";

import { AccountPnlSummarySkeleton } from "components/Skeleton/Skeleton";

const PERIOD_KEYS = ["week", "month", "year", "all"] as const;

function getPeriodLabel(key: (typeof PERIOD_KEYS)[number]) {
  switch (key) {
    case "week":
      return t`7 Day PnL`;
    case "month":
      return t`30 Day PnL`;
    case "year":
      return t`90 Day PnL`;
    case "all":
      return t`All Time PnL`;
    default:
      return key;
  }
}

export function PnlStatisticsCard({ chainId, account }: { chainId: number; account: Address }) {
  const { data, loading, error } = usePnlSummaryData(chainId, account);

  const byBucket = data?.reduce(
    (acc, row) => {
      acc[row.bucketLabel] = row;
      return acc;
    },
    {} as Record<string, (typeof data)[0]>
  ) ?? {};

  return (
    <div className="overflow-hidden rounded-8 bg-slate-900">
      <div className="border-b-1/2 border-slate-600 p-20">
        <h2 className="text-20 font-medium">
          <Trans>PnL Statistics</Trans>
        </h2>
        <p className="mt-8 text-14 text-typography-secondary">
          <Trans>Updated hourly • All stats exclude fees</Trans>
        </p>
      </div>
      <div className="p-20">
        {loading && <AccountPnlSummarySkeleton count={4} />}
        {error && (
          <p className="text-14 text-red-400">
            <Trans>Failed to load PnL statistics</Trans>
          </p>
        )}
        {!loading && !error && (
          <div className="flex flex-col gap-12">
            {PERIOD_KEYS.map((key) => {
              const row = byBucket[key];
              const label = getPeriodLabel(key);
              const pnlUsd = row?.pnlUsd ?? 0n;
              const display =
                row !== undefined
                  ? formatUsd(pnlUsd, { signed: true, maxThreshold: null })
                  : "—";
              return (
                <div
                  key={key}
                  className={cx(
                    "flex items-center justify-between py-8",
                    key === "all" && "rounded-4 bg-slate-800 px-12 py-12"
                  )}
                >
                  <span className="text-14 text-typography-secondary">{label}</span>
                  <span
                    className={cx(
                      "text-14 font-medium tabular-nums",
                      pnlUsd > 0n && "text-green-400",
                      pnlUsd < 0n && "text-red-400",
                      pnlUsd === 0n && "text-typography-primary"
                    )}
                  >
                    {display}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
