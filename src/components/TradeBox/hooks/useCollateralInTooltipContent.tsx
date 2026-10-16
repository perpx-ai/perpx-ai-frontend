import { Trans } from "@lingui/macro";
import { useMemo } from "react";

import {
  selectTradeboxCollateralToken,
  selectTradeboxMarketInfo,
  selectTradeboxTradeType,
} from "context/SyntheticsStateContext/selectors/tradeboxSelectors";
import { useSelector } from "context/SyntheticsStateContext/utils";
import { MarketInfo } from "domain/synthetics/markets";
import { TokenData } from "domain/synthetics/tokens";
import { TradeType } from "sdk/types/trade";

export function useCollateralInTooltipContent() {
  const collateralToken = useSelector(selectTradeboxCollateralToken);
  const marketInfo = useSelector(selectTradeboxMarketInfo);
  const tradeType = useSelector(selectTradeboxTradeType);

  return useMemo(() => {
    if (!collateralToken || !marketInfo) {
      return null;
    }

    return getCollateralInHintText(tradeType, collateralToken, marketInfo);
  }, [collateralToken, marketInfo, tradeType]);
}

export function getCollateralInHintText(tradeType: TradeType, collateralToken: TokenData, marketInfo: MarketInfo) {
  const indexSymbol = marketInfo.indexToken.symbol;
  const collateralSymbol = collateralToken.symbol;

  if (tradeType === TradeType.Long) {
    if (collateralToken.isStable) {
      return <Trans>A long position profits when {indexSymbol} goes up.</Trans>;
    } else if (marketInfo.indexToken.isSynthetic) {
      return (
        <Trans>
          A long position profits when {indexSymbol} goes up. You are also long {collateralSymbol} from your{" "}
          {collateralSymbol} collateral. The liquidation price will vary based on the price of {collateralSymbol}.
        </Trans>
      );
    } else {
      return (
        <Trans>
          A long position profits when {indexSymbol} goes up. You are also long {collateralSymbol} from your{" "}
          {collateralSymbol} collateral. The liquidation price is higher compared to using a stablecoin as collateral
          since the worth of the collateral will change with its price.
        </Trans>
      );
    }
  } else {
    if (collateralToken.isStable) {
      return <Trans>A short position profits when {indexSymbol} goes down.</Trans>;
    } else if (marketInfo.indexToken.isSynthetic) {
      return (
        <Trans>
          A short position profits when {indexSymbol} goes down. You are also long {collateralSymbol} from your{" "}
          {collateralSymbol} collateral. The liquidation price will vary based on the price of {collateralSymbol}.
        </Trans>
      );
    } else {
      return (
        <Trans>
          A short position profits when {indexSymbol} goes down. You are also long {collateralSymbol} from your{" "}
          {collateralSymbol} collateral. This can be useful for delta-neutral strategies to earn funding fees.
        </Trans>
      );
    }
  }
}
