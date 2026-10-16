import { useEffect, useState } from "react";
import { getHlMaxLeverages } from "./api/hyperliquid";

const LEVERAGE_STEPS = [0.1, 1, 2, 5, 10, 25, 50, 100];

let cachedMaxLeverages: Record<string, number> | null = null;
let pendingRequest: Promise<Record<string, number>> | null = null;

function loadMaxLeverages() {
  if (!pendingRequest) {
    pendingRequest = getHlMaxLeverages()
      .then((data) => {
        cachedMaxLeverages = data;
        return data;
      })
      .catch((e) => {
        pendingRequest = null;
        throw e;
      });
  }
  return pendingRequest;
}

/** HL max leverage for `symbol`, or undefined when not on HL / not loaded yet. */
export function useHlMaxLeverage(symbol: string | undefined): number | undefined {
  const [maxLeverages, setMaxLeverages] = useState(cachedMaxLeverages);

  useEffect(() => {
    if (!symbol || cachedMaxLeverages) return;
    loadMaxLeverages().then(setMaxLeverages).catch(() => {});
  }, [symbol]);

  if (!symbol || !maxLeverages) return undefined;
  return maxLeverages[symbol.toUpperCase()];
}

export function getHlLeverageSliderMarks(maxLeverage: number) {
  return [...LEVERAGE_STEPS.filter((step) => step < maxLeverage), maxLeverage];
}
