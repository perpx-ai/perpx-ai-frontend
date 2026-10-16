import { SyntheticsInfoRow } from "components/SyntheticsInfoRow";
import TooltipWithPortal from "components/Tooltip/TooltipWithPortal";

// Platform fee charged on position size (0.3%)
const PLATFORM_FEE_BPS = 30n;

/**
 * Shows the platform fee + estimated network gas as a % of position size,
 * with a breakdown tooltip.
 */
export function GasFeesRow({
  sizeDeltaUsd,
  executionFeeAmount,
  nativeTokenPrices,
}: {
  sizeDeltaUsd: bigint | undefined;
  executionFeeAmount: bigint | undefined;
  nativeTokenPrices: { minPrice: bigint; maxPrice: bigint } | undefined;
}) {
  if (sizeDeltaUsd === undefined || sizeDeltaUsd <= 0n || !nativeTokenPrices) return null;
  const ethMidPrice = (nativeTokenPrices.minPrice + nativeTokenPrices.maxPrice) / 2n;
  if (ethMidPrice === 0n) return null;

  // USD values use 30 decimals, ETH amounts 18
  const sizeUsd = Number(sizeDeltaUsd) / 1e30;
  const platformFeeUsd = Number((sizeDeltaUsd * PLATFORM_FEE_BPS) / 10000n) / 1e30;
  const networkFeeUsd = (Number(executionFeeAmount ?? 0n) / 1e18) * (Number(ethMidPrice) / 1e30);
  const totalUsd = platformFeeUsd + networkFeeUsd;

  const toPct = (usd: number) => `${((usd / sizeUsd) * 100).toFixed(2)}%`;

  return (
    <SyntheticsInfoRow
      label="Gas Fees"
      value={
        <TooltipWithPortal
          handle={
            <span className="numbers">
              {toPct(totalUsd)}
            </span>
          }
          position="bottom-end"
          content={
            <div className="flex flex-col gap-4">
              <div className="flex justify-between gap-16">
                <span>Platform fee</span>
                <span className="numbers">
                  {toPct(platformFeeUsd)}
                </span>
              </div>
              <div className="flex justify-between gap-16">
                <span>Network gas (est.)</span>
                <span className="numbers">
                  ~{toPct(networkFeeUsd)}
                </span>
              </div>
              <div className="pt-4 text-typography-secondary">
                Network gas is an estimate. Only the actual gas used is charged.
              </div>
            </div>
          }
        />
      }
    />
  );
}
