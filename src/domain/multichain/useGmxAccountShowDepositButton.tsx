import { useChainId } from "lib/chains";

import { useAvailableToTradeAssetSettlementChain } from "components/GmxAccountModal/hooks";

export function useGmxAccountShowDepositButton(
  selectedTokenBalance?: bigint,
  requiredAmount?: bigint,
  hasInsufficientBalance?: boolean
) {
  const { srcChainId } = useChainId();
  const { gmxAccountUsd, isGmxAccountLoading } = useAvailableToTradeAssetSettlementChain();

  // Show deposit button if:
  // 1. The selected token has 0 balance, OR
  // 2. The selected token balance is less than required amount, OR
  // 3. There's an insufficient balance error
  // Note: We check specific token balance first. Only fall back to gmxAccountUsd if no specific token is selected
  const hasSpecificTokenSelected = selectedTokenBalance !== undefined;
  const shouldShowDepositButton =
    !isGmxAccountLoading &&
    (hasSpecificTokenSelected
      ? // If a specific token is selected, check its balance
        selectedTokenBalance === 0n ||
        (requiredAmount !== undefined && requiredAmount > 0n && selectedTokenBalance < requiredAmount) ||
        hasInsufficientBalance === true
      : // If no specific token selected, check overall account balance
        gmxAccountUsd === 0n);


  return { shouldShowDepositButton };
}
