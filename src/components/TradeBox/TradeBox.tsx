import { Trans, t } from "@lingui/macro";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import cx from "classnames";
import { ChangeEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKey, useLatest, usePrevious } from "react-use";

import { ARBITRUM } from "config/chains";
import { BASIS_POINTS_DIVISOR, USD_DECIMALS } from "config/factors";
import { isSettlementChain } from "config/multichain";
import { useOpenMultichainDepositModal } from "context/GmxAccountContext/useOpenMultichainDepositModal";
import { useSettings } from "context/SettingsContext/SettingsContextProvider";
import { useTokensData } from "context/SyntheticsStateContext/hooks/globalsHooks";
import { useCustodyWallet } from "context/CustodyWalletContext/CustodyWalletContextProvider";
import { selectChartHeaderInfo } from "context/SyntheticsStateContext/selectors/chartSelectors";
import {
  selectChainId,
  selectMarketsInfoData,
  selectSrcChainId,
  selectSubaccountState,
} from "context/SyntheticsStateContext/selectors/globalSelectors";
import {
  selectExpressOrdersEnabled,
  selectSetExpressOrdersEnabled,
  selectSettingsWarningDotVisible,
  selectShowDebugValues,
} from "context/SyntheticsStateContext/selectors/settingsSelectors";
import {
  selectTradeboxAllowedSlippage,
  selectTradeboxAvailableTokensOptions,
  selectTradeboxChooseSuitableMarket,
  selectTradeboxDecreasePositionAmounts,
  selectTradeboxExecutionFee,
  selectTradeboxFees,
  selectTradeboxFromToken,
  selectTradeboxIncreasePositionAmounts,
  selectTradeboxIsWrapOrUnwrap,
  selectTradeboxKeepLeverage,
  selectTradeboxLeverage,
  selectTradeboxLeverageSliderMarks,
  selectTradeboxMarkPrice,
  selectTradeboxMaxLeverage,
  selectTradeboxNextPositionValues,
  selectTradeboxSelectedPosition,
  selectTradeboxSelectedPositionKey,
  selectTradeboxSetDefaultAllowedSwapSlippageBps,
  selectTradeboxSetKeepLeverage,
  selectTradeboxSetSelectedAllowedSwapSlippageBps,
  selectTradeboxState,
  selectTradeboxSwapAmounts,
  selectTradeboxTradeFlags,
  selectTradeboxTradeRatios,
} from "context/SyntheticsStateContext/selectors/tradeboxSelectors";
import { selectTradeboxTradeTypeError } from "context/SyntheticsStateContext/selectors/tradeboxSelectors/selectTradeboxTradeErrors";
import { useSelector } from "context/SyntheticsStateContext/utils";
import { toastEnableExpress } from "domain/multichain/toastEnableExpress";
import { useGmxAccountShowDepositButton } from "domain/multichain/useGmxAccountShowDepositButton";
import { getMinResidualGasPaymentTokenAmount } from "domain/synthetics/express/expressOrderUtils";
import { MarketInfo, getMarketIndexName } from "domain/synthetics/markets";
import { formatLeverage, formatLiquidationPrice } from "domain/synthetics/positions";
import { convertToUsd, useTokenBalances } from "domain/synthetics/tokens";
import { useMaxAutoCancelOrdersState } from "domain/synthetics/trade/useMaxAutoCancelOrdersState";
import { usePriceImpactWarningState } from "domain/synthetics/trade/usePriceImpactWarningState";
import { MissedCoinsPlace } from "domain/synthetics/userFeedback";
import { Token } from "domain/tokens";
import { useMaxAvailableAmount } from "domain/tokens/useMaxAvailableAmount";
import { CHAIN_ID_TO_TX_URL_BUILDER } from "lib/chains/blockExplorers";
import { showDepositNeededToast } from "lib/depositToast";
import { helperToast } from "lib/helperToast";
import { shortenAddress } from "lib/legacy";
import { useLocalizedMap } from "lib/i18n";
import { throttleLog } from "lib/logging";
import {
  calculateDisplayDecimals,
  formatAmount,
  formatAmountFree,
  formatBalanceAmount,
  formatDeltaUsd,
  formatPercentage,
  formatTokenAmountWithUsd,
  formatUsd,
  formatUsdPrice,
  parseValue,
} from "lib/numbers";
import { EMPTY_ARRAY, getByKey } from "lib/objects";
import { useCursorInside } from "lib/useCursorInside";
import { sendTradeBoxInteractionStartedEvent } from "lib/userAnalytics";
import { useWalletIconUrls } from "lib/wallets/getWalletIconUrls";
import { useIsNonEoaAccountOnAnyChain } from "lib/wallets/useAccountType";
import useWallet from "lib/wallets/useWallet";
import { NATIVE_TOKEN_ADDRESS } from "sdk/configs/tokens";
import { TradeMode } from "sdk/types/trade";

import { VenueSelector } from "components/VenueSelector/VenueSelector";
import { useVenue } from "context/VenueContext/VenueContextProvider";
import { useAuth } from "context/AuthContext/AuthContextProvider";
import {
  depositToHyperliquid,
  getCustodyUSDCBalance,
  getHlBalances,
  isHlDepositCredited,
  placeHlOrder,
} from "lib/api/hyperliquid";
import { useHyperliquidSetup } from "lib/useHyperliquidSetup";
import { SHOW_POSITION_ACTIONS } from "lib/devFlags";
import { sleep } from "lib/sleep";
import { useSmartRouter } from "lib/useSmartRouter";
import { useVenueAvailability } from "lib/useVenueAvailability";
import { getHlLeverageSliderMarks, useHlMaxLeverage } from "lib/useHlMaxLeverage";
import { AlertInfoCard } from "components/AlertInfo/AlertInfoCard";
import Button from "components/Button/Button";
import ExternalLink from "components/ExternalLink/ExternalLink";
import { GasFeesRow } from "components/GasFeesRow/GasFeesRow";
import SpinnerIcon from "img/ic_spinner.svg?react";
import BuyInputSection from "components/BuyInputSection/BuyInputSection";
import { CustodyWalletModal } from "components/CustodyWallet/CustodyWalletModal";
import { LeverageSlider } from "components/LeverageSlider/LeverageSlider";
import { MarketSelector } from "components/MarketSelector/MarketSelector";
import SuggestionInput from "components/SuggestionInput/SuggestionInput";
import { SyntheticsInfoRow } from "components/SyntheticsInfoRow";
import Tabs from "components/Tabs/Tabs";
import ToggleSwitch from "components/ToggleSwitch/ToggleSwitch";
import TokenIcon from "components/TokenIcon/TokenIcon";
import TokenWithIcon from "components/TokenIcon/TokenWithIcon";
import { MultichainTokenSelector } from "components/TokenSelector/MultichainTokenSelector";
import TokenSelector from "components/TokenSelector/TokenSelector";
import Tooltip from "components/Tooltip/Tooltip";
import { ValueTransition } from "components/ValueTransition/ValueTransition";

import ArrowDownIcon from "img/ic_arrow_down.svg?react";
import SettingsIcon from "img/ic_settings.svg?react";

import { useIsCurtainOpen } from "./Curtain";
import { ExpressTradingWarningCard } from "./ExpressTradingWarningCard";
import { useMultichainTokensRequest } from "../GmxAccountModal/hooks";
import { HighPriceImpactOrFeesWarningCard } from "../HighPriceImpactOrFeesWarningCard/HighPriceImpactOrFeesWarningCard";
import TradeInfoIcon from "../TradeInfoIcon/TradeInfoIcon";
import TwapRows from "../TwapRows/TwapRows";
import { useDecreaseOrdersThatWillBeExecuted } from "./hooks/useDecreaseOrdersThatWillBeExecuted";
import { useShowHighLeverageWarning } from "./hooks/useShowHighLeverageWarning";
import { useExpressTradingWarnings } from "./hooks/useShowOneClickTradingInfo";
import { useTradeboxAcceptablePriceImpactValues } from "./hooks/useTradeboxAcceptablePriceImpactValues";
import { useTradeboxTPSLReset } from "./hooks/useTradeboxTPSLReset";
import { useTradeboxButtonState } from "./hooks/useTradeButtonState";
import { MarketPoolSelectorRow } from "./MarketPoolSelectorRow";
import { tradeModeLabels, tradeTypeLabels } from "./tradeboxConstants";
import { TradeBoxAdvancedGroups } from "./TradeBoxRows/AdvancedDisplayRows";
import { CollateralSelectorRow } from "./TradeBoxRows/CollateralSelectorRow";
import { LimitAndTPSLGroup } from "./TradeBoxRows/LimitAndTPSLRows";
import { MinReceiveRow } from "./TradeBoxRows/MinReceiveRow";
import { PriceImpactFeesRow } from "./TradeBoxRows/PriceImpactFeesRow";

import "./TradeBox.scss";
import Loader from "components/Loader/Loader";

/**
 * Raised when the deposit is confirmed on Arbitrum but Hyperliquid has not
 * credited it within the wait window. This is emphatically *not* an order
 * failure: the transfer succeeded, nothing was submitted, and the balance will
 * show up shortly — so the caller reports it differently.
 */
class HlDepositPendingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HlDepositPendingError";
  }
}

/**
 * Polls HL balance until it reaches `requiredUsd` or `timeoutMs` elapses.
 *
 * With `deposit` given, it also stops once HL's ledger shows that deposit
 * credited. Open positions hold back margin, so a credited deposit can leave
 * `free` short of `requiredUsd` for good, and balance alone would then wait out
 * the whole window and report a landed deposit as missing.
 *
 * Deposits normally credit about a minute after the bridge transfer confirms,
 * but the tail is long, so the window is generous. Polling starts tight and
 * backs off: a deposit that lands early shouldn't sit waiting out a coarse
 * interval, and a slow one shouldn't hammer the endpoint for eight minutes.
 */
async function waitForHlBalance(
  custodyAddr: string,
  requiredUsd: number,
  timeoutMs = 480_000,
  onTick?: () => void,
  deposit?: { txHash: string; sentAt: number },
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let consecutiveFailures = 0;
  let firstFailureAt = 0;

  for (;;) {
    let fetchFailed = false;
    const bals = await getHlBalances(custodyAddr).catch(() => {
      fetchFailed = true;
      return [] as any[];
    });

    if (fetchFailed) {
      // A balance endpoint that is down reads exactly like a deposit that never
      // lands, and the old code waited out the entire window before saying so.
      // Bail out early on a sustained outage and name the real cause — but
      // require it to persist, so a brief blip is just retried.
      consecutiveFailures++;
      if (consecutiveFailures === 1) firstFailureAt = Date.now();
      if (consecutiveFailures >= 5 && Date.now() - firstFailureAt >= 30_000) {
        throw new HlDepositPendingError(
          t`Can't reach Hyperliquid to confirm your deposit. Your funds are on their way and no order was placed — check your balance in a minute.`,
        );
      }
    } else {
      consecutiveFailures = 0;
      firstFailureAt = 0;
      const usdc = (bals as any[]).find((b: any) => b.asset === "USDC" || b.asset === "usdc");
      if (parseFloat(usdc?.free ?? "0") >= requiredUsd) return;
      if (deposit) {
        // A ledger miss is just retried next tick; balance remains the primary check.
        const credited = await isHlDepositCredited(
          custodyAddr,
          deposit.txHash,
          deposit.sentAt - 60_000,
        ).catch(() => false);
        if (credited) return;
      }
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    onTick?.();
    const elapsed = timeoutMs - remaining;
    const interval = elapsed < 20_000 ? 2_000 : elapsed < 90_000 ? 5_000 : 10_000;
    // Never sleep past the deadline — that guarantees one last check on it.
    await sleep(Math.min(interval, remaining));
  }

  throw new HlDepositPendingError(
    t`Deposit confirmed on-chain, but Hyperliquid hasn't credited it yet. Your funds are safe and no order was placed — try again once your balance updates.`,
  );
}

/**
 * Rough wall-clock estimates for the two-step Hyperliquid submit, shown in the
 * stepper so a long bridge wait doesn't read as a hang. The deposit figure is
 * the typical Arbitrum→HL bridge time, well inside waitForHlBalance's 8 min cap.
 *
 * Passing the step-1 estimate is also what triggers the "taking longer" notice, so
 * it is a user-facing threshold, not just a label.
 */
const HL_STEP_ESTIMATE_SECONDS: Record<1 | 2, number> = { 1: 120, 2: 5 };

/** "1:05" for anything a minute or over, "12s" below that. */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Right-aligned timing for one stepper row: a live counter against the estimate
 * while the step runs, just the estimate before it starts, nothing once it is
 * done — the checkmark already says so.
 */
function HlStepTiming({ step, activeStep, elapsed }: { step: 1 | 2; activeStep: 1 | 2; elapsed: number }) {
  const estimate = HL_STEP_ESTIMATE_SECONDS[step];

  if (step < activeStep) return null;

  if (step > activeStep) {
    return <span className="ml-auto text-body-small text-typography-secondary">~{formatDuration(estimate)}</span>;
  }

  return (
    <span
      className={`ml-auto text-body-small numbers ${elapsed > estimate ? "text-yellow-500" : "text-typography-secondary"}`}
    >
      {formatDuration(elapsed)} / ~{formatDuration(estimate)}
    </span>
  );
}

export function TradeBox({ isMobile }: { isMobile: boolean }) {
  const localizedTradeModeLabels = useLocalizedMap(tradeModeLabels);
  const localizedTradeTypeLabels = useLocalizedMap(tradeTypeLabels);
  const [loading, setLoading] = useState(false);
  const [isHlSubmitting, setIsHlSubmitting] = useState(false);
  const [hlSubmitStatus, setHlSubmitStatus] = useState("");
  const [hlSubmitStep, setHlSubmitStep] = useState<1 | 2>(1);
  const [hlNeedsDeposit, setHlNeedsDeposit] = useState(false);
  /** Seconds the current HL step has been running, for the live counter in the stepper. */
  const [hlStepElapsed, setHlStepElapsed] = useState(0);
  /** Arbitrum tx that moved USDC to the HL bridge, so the user can verify it mid-flow. */
  const [hlDepositTxHash, setHlDepositTxHash] = useState<string | null>(null);
  /** Latches the "taking longer" toast so the per-second tick can't fire it repeatedly. */
  const hlSlowWarnedRef = useRef(false);
  const setDefaultAllowedSwapSlippageBps = useSelector(selectTradeboxSetDefaultAllowedSwapSlippageBps);
  const setSelectedAllowedSwapSlippageBps = useSelector(selectTradeboxSetSelectedAllowedSwapSlippageBps);

  const availableTokenOptions = useSelector(selectTradeboxAvailableTokensOptions);
  const chartHeaderInfo = useSelector(selectChartHeaderInfo);
  const formRef = useRef<HTMLFormElement>(null);
  const isCursorInside = useCursorInside(formRef);
  const showDebugValues = useSelector(selectShowDebugValues);

  const allowedSlippage = useSelector(selectTradeboxAllowedSlippage);

  const { swapTokens, infoTokens, sortedLongAndShortTokens, sortedAllMarkets } = availableTokenOptions;
  const tokensData = useTokensData();
  const { tokenChainDataArray: multichainTokens } = useMultichainTokensRequest();
  const marketsInfoData = useSelector(selectMarketsInfoData);
  const tradeFlags = useSelector(selectTradeboxTradeFlags);
  const { isLong, isSwap, isIncrease, isPosition, isLimit, isTrigger, isMarket, isTwap } = tradeFlags;
  const isWrapOrUnwrap = useSelector(selectTradeboxIsWrapOrUnwrap);

  const chainId = useSelector(selectChainId);
  const srcChainId = useSelector(selectSrcChainId);
  const { account, active } = useWallet();
  const { openConnectModal } = useConnectModal();
  const { venue, setVenue } = useVenue();
  const { token: authToken, ensureAuthenticated } = useAuth();

  const walletIconUrls = useWalletIconUrls();

  const { shouldDisableValidationForTesting: shouldDisableValidation } = useSettings();

  const onDepositTokenAddress = useOpenMultichainDepositModal();

  const nativeToken = getByKey(tokensData, NATIVE_TOKEN_ADDRESS);

  const [_, setExternalIsCurtainOpen] = useIsCurtainOpen();

  const {
    fromTokenInputValue,
    setFromTokenInputValue: setFromTokenInputValueRaw,
    toTokenInputValue,
    setToTokenInputValue: setToTokenInputValueRaw,
    setCollateralAddress: onSelectCollateralAddress,
    setFromTokenAddress: onSelectFromTokenAddress,
    isFromTokenGmxAccount,
    setIsFromTokenGmxAccount,
    setTradeMode: onSelectTradeMode,
    focusedInput,
    setFocusedInput,
    closeSizeInputValue,
    setCloseSizeInputValue,
    triggerPriceInputValue,
    setTriggerPriceInputValue,
    triggerRatioInputValue,
    setTriggerRatioInputValue,
    leverageInputValue,
    setLeverageInputValue,
    leverageOption,
    setLeverageOption,
    isSwitchTokensAllowed,
    switchTokenAddresses,
    tradeMode,
    tradeType,
    collateralToken,
    fromTokenAddress,
    marketInfo,
    toTokenAddress,
    availableTradeModes,
    duration,
    numberOfParts,
    setNumberOfParts,
    setDuration,
  } = useSelector(selectTradeboxState);

  const fromToken = useSelector(selectTradeboxFromToken);
  const toToken = getByKey(tokensData, toTokenAddress);

  const routingSide = isLong ? "BUY" : ("SELL" as const);
  const { routing } = useSmartRouter(
    toToken?.symbol,
    routingSide,
    isIncrease && isPosition && !isTrigger && !isTwap,
  );

  const { isOnGmx, isOnHl } = useVenueAvailability(toToken?.symbol);

  const resolvedVenue = venue === "auto" && routing?.recommended ? routing.recommended : venue;
  const isHlVenue = resolvedVenue === "hyperliquid" && isIncrease && isPosition && !isTrigger && !isTwap;

  const { custodyWalletAddress } = useCustodyWallet();

  const { isReady: hlAgentReady, isLoading: hlAgentLoading, setup: setupHlAgent } = useHyperliquidSetup();

  const [hlBalanceRefreshKey, setHlBalanceRefreshKey] = useState(0);
  const [hlUsdcBalance, setHlUsdcBalance] = useState<number | null>(null);
  useEffect(() => {
    if (!isHlVenue || !custodyWalletAddress) { setHlUsdcBalance(null); return; }
    const fetch = () =>
      getHlBalances(custodyWalletAddress)
        .then((bals: any[]) => {
          const usdc = bals.find((b) => b.asset === "USDC" || b.asset === "usdc");
          setHlUsdcBalance(parseFloat(usdc?.free ?? "0"));
        })
        .catch(() => setHlUsdcBalance(0));
    fetch();
    const interval = setInterval(fetch, 15_000);
    return () => clearInterval(interval);
  }, [isHlVenue, custodyWalletAddress, hlBalanceRefreshKey]);

  const [custodyUsdcBalance, setCustodyUsdcBalance] = useState<number | null>(null);
  useEffect(() => {
    if (!isHlVenue || (!authToken && !account)) { setCustodyUsdcBalance(null); return; }
    const fetchBal = () =>
      getCustodyUSDCBalance(account ?? "", authToken ?? undefined)
        .then((bal) => setCustodyUsdcBalance(parseFloat(bal)))
        .catch(() => setCustodyUsdcBalance(0));
    fetchBal();
    const interval = setInterval(fetchBal, 15_000);
    return () => clearInterval(interval);
  }, [isHlVenue, authToken, account, hlBalanceRefreshKey]);

  // Custody wallet ETH balance for gas fee check
  const { balancesData: custodyBalancesData } = useTokenBalances(chainId, {
    overrideAccount: custodyWalletAddress ?? undefined,
    useCustodyWallet: false,
    enabled: Boolean(custodyWalletAddress),
  });
  const custodyEthBalance = custodyBalancesData?.[NATIVE_TOKEN_ADDRESS];
  const isCustodyBalanceLoaded = custodyBalancesData !== undefined;

  // true when the venue was switched by the system (not by the user)
  const venueForcedRef = useRef(false);

  useEffect(() => {
    if (!toToken?.symbol) return;
    if (isOnGmx && isOnHl) {
      // Both available: restore "auto" only if we had previously force-switched
      if (venueForcedRef.current) {
        setVenue("auto");
        venueForcedRef.current = false;
      }
    } else if (!isOnGmx && isOnHl && venue !== "hyperliquid") {
      setVenue("hyperliquid");
      venueForcedRef.current = true;
    } else if (isOnGmx && !isOnHl && venue !== "gmx") {
      setVenue("gmx");
      venueForcedRef.current = true;
    }
  }, [toToken?.symbol, isOnGmx, isOnHl, venue, setVenue]);
  const fromTokenAmount = fromToken ? parseValue(fromTokenInputValue || "0", fromToken.decimals)! : 0n;
  const fromTokenPrice = fromToken?.prices.minPrice;
  const fromUsd = convertToUsd(fromTokenAmount, fromToken?.decimals, fromTokenPrice);

  const closeSizeUsd = parseValue(closeSizeInputValue || "0", USD_DECIMALS)!;

  const markPrice = useSelector(selectTradeboxMarkPrice);
  const swapAmounts = useSelector(selectTradeboxSwapAmounts);
  const increaseAmounts = useSelector(selectTradeboxIncreasePositionAmounts);
  const decreaseAmounts = useSelector(selectTradeboxDecreasePositionAmounts);
  const selectedPositionKey = useSelector(selectTradeboxSelectedPositionKey);
  const selectedPosition = useSelector(selectTradeboxSelectedPosition);
  const leverage = useSelector(selectTradeboxLeverage);
  const nextPositionValues = useSelector(selectTradeboxNextPositionValues);
  const fees = useSelector(selectTradeboxFees);
  const expressOrdersEnabled = useSelector(selectExpressOrdersEnabled);
  const setExpressOrdersEnabled = useSelector(selectSetExpressOrdersEnabled);
  const { subaccount } = useSelector(selectSubaccountState);

  const tradeError = useSelector(selectTradeboxTradeTypeError);
  // Check if there's an insufficient balance error for the selected token
  const hasInsufficientBalance = tradeError[0]?.includes("Insufficient") && tradeError[0]?.includes("balance");

  const { shouldShowDepositButton } = useGmxAccountShowDepositButton(
    fromToken?.balance,
    fromTokenAmount,
    hasInsufficientBalance
  );
  const { setIsSettingsVisible, isLeverageSliderEnabled } = useSettings();

  const executionFee = useSelector(selectTradeboxExecutionFee);
  const { markRatio } = useSelector(selectTradeboxTradeRatios);

  const gmxLeverageSliderMarks = useSelector(selectTradeboxLeverageSliderMarks);
  const maxLeverage = useSelector(selectTradeboxMaxLeverage);

  // GMX market limits don't apply on Hyperliquid — use HL's per-asset max leverage there
  const hlMaxLeverage = useHlMaxLeverage(isHlVenue ? toToken?.symbol : undefined);
  const leverageSliderMarks = useMemo(
    () => (hlMaxLeverage !== undefined ? getHlLeverageSliderMarks(hlMaxLeverage) : gmxLeverageSliderMarks),
    [hlMaxLeverage, gmxLeverageSliderMarks]
  );
  const maxAllowedLeverage =
    hlMaxLeverage !== undefined ? hlMaxLeverage * BASIS_POINTS_DIVISOR : maxLeverage / 2;

  const decreaseOrdersThatWillBeExecuted = useDecreaseOrdersThatWillBeExecuted();

  const priceImpactWarningState = usePriceImpactWarningState({
    collateralNetPriceImpact: fees?.collateralNetPriceImpact,
    positionNetPriceImpact: fees?.positionNetPriceImpact,
    swapPriceImpact: fees?.swapPriceImpact,
    swapProfitFee: fees?.swapProfitFee,
    executionFeeUsd: executionFee?.feeUsd,
    willDecreaseOrdersBeExecuted: decreaseOrdersThatWillBeExecuted.length > 0,
    externalSwapFeeItem: fees?.externalSwapFee,
    tradeFlags,
    payUsd: fromUsd,
  });

  const { showHighLeverageWarning, dismissHighLeverageWarning } = useShowHighLeverageWarning();

  const setIsDismissedRef = useLatest(priceImpactWarningState.setIsDismissed);

  const setFromTokenInputValue = useCallback(
    (value: string, resetPriceImpactAndSwapSlippage?: boolean) => {
      setFromTokenInputValueRaw(value);

      if (resetPriceImpactAndSwapSlippage) {
        setIsDismissedRef.current(false);

        setDefaultAllowedSwapSlippageBps(undefined);
        setSelectedAllowedSwapSlippageBps(undefined);
      }
    },
    [setFromTokenInputValueRaw, setIsDismissedRef, setDefaultAllowedSwapSlippageBps, setSelectedAllowedSwapSlippageBps]
  );

  const setToTokenInputValue = useCallback(
    (value: string, shouldResetPriceImpactAndSwapSlippage: boolean) => {
      setToTokenInputValueRaw(value);
      if (shouldResetPriceImpactAndSwapSlippage) {
        setIsDismissedRef.current(false);

        setDefaultAllowedSwapSlippageBps(undefined);
        setSelectedAllowedSwapSlippageBps(undefined);
      }
    },
    [setIsDismissedRef, setToTokenInputValueRaw, setDefaultAllowedSwapSlippageBps, setSelectedAllowedSwapSlippageBps]
  );

  const { warning: maxAutoCancelOrdersWarning } = useMaxAutoCancelOrdersState({
    positionKey: selectedPositionKey,
    isCreatingNewAutoCancel: isTrigger,
  });

  const submitButtonState = useTradeboxButtonState({
    account,
    setToTokenInputValue,
    isHlVenue,
    hlUsdcBalance,
  });

  const wrappedOnSubmit = useCallback(async () => {

    // ── Gas fee check (0.3% volume fee + execution fee + tx gas) ───────────────
    if (!isHlVenue && isCustodyBalanceLoaded && isIncrease && increaseAmounts?.sizeDeltaUsd && increaseAmounts.sizeDeltaUsd > 0n && nativeToken?.prices) {
      const ethMidPrice = (nativeToken.prices.minPrice + nativeToken.prices.maxPrice) / 2n;
      const walletEth = custodyEthBalance ?? 0n;
      if (ethMidPrice > 0n) {
        const volumeFeeEth = (increaseAmounts.sizeDeltaUsd * 3n / 1000n) * BigInt(1e18) / ethMidPrice;
        const execFeeEth = submitButtonState.totalExecutionFee?.feeTokenAmount ?? 0n;
        const txGasBuffer = BigInt(1e14); // ~0.0001 ETH buffer for tx gas
        const totalRequired = volumeFeeEth + execFeeEth + txGasBuffer;
        if (totalRequired > walletEth) {
          const shortfall = totalRequired - walletEth;
          const shortfallUsd = (Number(shortfall) / 1e18) * (Number(ethMidPrice) / 1e30);
          helperToast.error(`You have low ETH balance in your PerpX wallet, please deposit ~$${shortfallUsd.toFixed(2)} worth of ETH to fulfill this transaction.`);
          return;
        }
      }
    }

    // ── Hyperliquid routing ──────────────────────────────────────────────────
    if (resolvedVenue === "hyperliquid" && isIncrease) {
      // The session can lapse while the screen sits idle — the wallet auto-locks, or the
      // sign-in prompt is left unanswered until its nonce expires. Re-establish it inline
      // instead of dead-ending a trade the user just asked for.
      let sessionToken = authToken;
      if (!sessionToken) {
        sessionToken = await ensureAuthenticated().catch((error) => {
          console.error("TradeBox: sign-in failed", error);
          return null;
        });
      }
      if (!sessionToken) {
        helperToast.error(t`Sign in with your wallet to continue`);
        return;
      }
      if (!toToken) {
        helperToast.error(t`Select a market first`);
        return;
      }
      if (isTrigger || isTwap) {
        helperToast.error(t`Only Market and Limit orders are supported on Hyperliquid`);
        return;
      }
      if (!increaseAmounts?.indexTokenAmount || increaseAmounts.indexTokenAmount === 0n) {
        helperToast.error(t`Enter a size`);
        return;
      }

      // ── Agent setup (first-time) ─────────────────────────────────────────────
      if (!hlAgentReady) {
        try {
          // info, not success: this fires before the await, so a green toast here
          // claimed the setup had worked and was immediately followed by its failure.
          helperToast.info(t`Setting up Hyperliquid agent wallet…`);
          await setupHlAgent(sessionToken);
        } catch (e: any) {
          helperToast.error(e.message ?? t`Hyperliquid setup failed`);
          return;
        }
      }

      setIsHlSubmitting(true);
      setHlSubmitStep(1);
      setHlNeedsDeposit(false);
      // Clear last run's leftovers, or the stepper would show the previous trade's tx
      // link and stay latched against a fresh slow-deposit warning.
      setHlDepositTxHash(null);
      hlSlowWarnedRef.current = false;
      setHlSubmitStatus(t`Checking balance…`);
      try {
        // Always fetch a fresh HL balance — the cached state may be stale after setup/deposits
        const freshBals = await getHlBalances(custodyWalletAddress ?? "").catch(() => [] as any[]);
        const freshUsdc = (freshBals as any[]).find((b: any) => b.asset === "USDC" || b.asset === "usdc");
        const currentHlBalance = parseFloat(freshUsdc?.free ?? "0");
        const requiredUsd = fromUsd ? Number(fromUsd) / 1e30 : 0;

        if (requiredUsd > 0 && currentHlBalance < requiredUsd) {
          const shortfall = requiredUsd - currentHlBalance;
          const HL_MIN_DEPOSIT = 5;
          const depositAmount = Math.max(shortfall, HL_MIN_DEPOSIT);

          // Fetch fresh custody USDC balance instead of relying on stale state
          const freshCustodyUsdc = await getCustodyUSDCBalance("", sessionToken).catch(() => "0");
          const freshCustodyBalance = parseFloat(freshCustodyUsdc);
          setCustodyUsdcBalance(freshCustodyBalance);

          if (freshCustodyBalance < depositAmount) {
            // Not enough in custody to cover the deposit (including HL 5 USDC
            // minimum). Offer the deposit rather than forcing the modal open —
            // see showDepositNeededToast.
            showDepositNeededToast(
              freshCustodyBalance >= shortfall
                ? t`Minimum Hyperliquid deposit is ${HL_MIN_DEPOSIT} USDC. Please add more funds to your PerpX Wallet.`
                : t`Insufficient funds in PerpX Wallet. Please deposit more to continue.`,
              () => submitButtonState.setShowCustodyWalletModal(true)
            );
            return;
          }

          setHlNeedsDeposit(true);
          setHlSubmitStep(1);
          setHlSubmitStatus(t`Depositing to Hyperliquid…`);
          let depositTxHash: string | null = null;
          let depositSentAt = 0;
          try {
            // Keep the hash: it is the user's only way to verify mid-flow that their
            // USDC actually left the PerpX wallet, and the wait that follows can run
            // for minutes with nothing else to show for it.
            depositSentAt = Date.now();
            const deposit = await depositToHyperliquid(depositAmount.toFixed(2), sessionToken);
            depositTxHash = deposit.txHash ?? null;
            setHlDepositTxHash(depositTxHash);
          } catch (e: any) {
            helperToast.error(e.message ?? t`Auto-deposit to Hyperliquid failed`);
            return;
          }

          // Poll until the deposit (or the agent-setup deposit) lands on HL
          setHlSubmitStep(1);
          setHlSubmitStatus(t`Waiting for deposit… (may take ~2 min)`);
          await waitForHlBalance(
            custodyWalletAddress!,
            requiredUsd,
            480_000,
            () => setHlSubmitStatus(t`Waiting for deposit… checking balance`),
            depositTxHash ? { txHash: depositTxHash, sentAt: depositSentAt } : undefined,
          );
        }

        setHlSubmitStep(2);
        setHlSubmitStatus(t`Opening position…`);
        const quantity = formatAmountFree(increaseAmounts.indexTokenAmount, toToken.decimals);
        const lev = leverageOption ? Math.round(leverageOption) : 1;
        const result = await placeHlOrder(
          {
            symbol: toToken.symbol,
            side: isLong ? "BUY" : "SELL",
            type: isMarket ? "MARKET" : "LIMIT",
            quantity,
            price: isLimit ? triggerPriceInputValue || undefined : undefined,
            leverage: lev,
            userAddress: "",
          },
          sessionToken,
        );
        const side = isLong ? "Long" : "Short";
        const msg =
          result.status === "FILLED"
            ? t`${side} ${toToken.symbol} filled: ${result.filledQty} @ $${parseFloat(result.avgPrice ?? "0").toFixed(2)} on Hyperliquid`
            : t`${side} ${toToken.symbol} order placed on Hyperliquid`;
        helperToast.success(msg);
        setFromTokenInputValue("", true);
        setToTokenInputValue("", true);
        setHlBalanceRefreshKey((k) => k + 1);
        if (isMobile) setExternalIsCurtainOpen(false);
      } catch (err: any) {
        // A deposit still in flight is not a failed order — the transfer went
        // through and nothing was submitted, so don't dress it up as one.
        if (err instanceof HlDepositPendingError) {
          helperToast.error(err.message);
        } else {
          helperToast.error(t`${isLong ? "Long" : "Short"} ${toToken?.symbol ?? ""} order failed: ${err.message ?? "Unknown error"}`);
        }
      } finally {
        setIsHlSubmitting(false);
        setHlSubmitStatus("");
      }
      return;
    }
    // ── GMX express gas check ────────────────────────────────────────────────
    if (submitButtonState.expressParams?.gasPaymentValidations?.isOutGasTokenBalance) {
      helperToast.error(t`You have low ETH balance in your PerpX wallet, please deposit more ETH to fulfill this transaction.`);
      return;
    }

    // ── GMX routing (default) ────────────────────────────────────────────────
    try {
      await submitButtonState.onSubmit();

      // Clear input fields after successful order placement
      setFromTokenInputValue("", true);
      setToTokenInputValue("", true);

      if (isMobile) {
        setExternalIsCurtainOpen(false);
      }
    } catch (error) {
      // Don't clear inputs if order failed
      console.error("Order submission failed:", error);
      throw error;
    }
  }, [
    venue, routing, isIncrease, authToken, ensureAuthenticated, toToken, isTrigger, isTwap, increaseAmounts,
    isLong, isMarket, isLimit, leverageOption, triggerPriceInputValue,
    submitButtonState, isMobile, setExternalIsCurtainOpen,
    setFromTokenInputValue, setToTokenInputValue,
    custodyWalletAddress, custodyUsdcBalance, custodyEthBalance, nativeToken, fromUsd, setHlBalanceRefreshKey,
    hlAgentReady, setupHlAgent,
  ]);

  const { formattedMaxAvailableAmount, showClickMax } = useMaxAvailableAmount({
    fromToken,
    nativeToken,
    fromTokenAmount,
    fromTokenInputValue,
    minResidualAmount: getMinResidualGasPaymentTokenAmount({
      expressParams: submitButtonState.expressParams,
      payTokenAddress: fromTokenAddress,
    }),
    isLoading: submitButtonState.isExpressLoading,
  });

  const onMaxClick = useCallback(() => {
    if (formattedMaxAvailableAmount) {
      setFocusedInput("from");
      setFromTokenInputValue(formattedMaxAvailableAmount, true);
    }
  }, [formattedMaxAvailableAmount, setFocusedInput, setFromTokenInputValue]);

  useTradeboxAcceptablePriceImpactValues();
  useTradeboxTPSLReset(priceImpactWarningState.setIsDismissed);

  const prevIsISwap = usePrevious(isSwap);

  useEffect(
    function updateInputAmounts() {
      if (!fromToken || !toToken || (!isSwap && !isIncrease)) {
        return;
      }

      // reset input values when switching between swap and position tabs
      if (prevIsISwap !== undefined && isSwap !== prevIsISwap) {
        setFocusedInput("from");

        setFromTokenInputValue("", true);
        return;
      }

      if (isSwap && swapAmounts) {
        if (focusedInput === "from") {
          setToTokenInputValue(
            swapAmounts.amountOut > 0 ? formatAmountFree(swapAmounts.amountOut, toToken.decimals) : "",
            false
          );
        } else {
          setFromTokenInputValue(
            swapAmounts.amountIn > 0 ? formatAmountFree(swapAmounts.amountIn, fromToken.decimals) : "",
            false
          );
        }
      }

      if (isIncrease && increaseAmounts) {
        const visualMultiplier = BigInt(toToken.visualMultiplier ?? 1);
        if (focusedInput === "from") {
          setToTokenInputValue(
            increaseAmounts.indexTokenAmount > 0
              ? formatAmountFree(increaseAmounts.indexTokenAmount / visualMultiplier, toToken.decimals)
              : "",
            false
          );
        } else {
          setFromTokenInputValue(
            increaseAmounts.initialCollateralAmount > 0
              ? formatAmountFree(increaseAmounts.initialCollateralAmount, fromToken.decimals)
              : "",
            false
          );
        }
      }
    },
    [
      focusedInput,
      fromToken,
      increaseAmounts,
      isIncrease,
      isSwap,
      prevIsISwap,
      setFocusedInput,
      setFromTokenInputValue,
      setToTokenInputValue,
      swapAmounts,
      toToken,
    ]
  );

  const prevIsLong = usePrevious(isLong);

  useEffect(
    function resetPayAmountOnDirectionChange() {
      if (prevIsLong !== undefined && prevIsLong !== isLong) {
        setFromTokenInputValue("", true);
        setToTokenInputValue("", true);
        setFocusedInput("from");
      }
    },
    [isLong, prevIsLong, setFromTokenInputValue, setToTokenInputValue, setFocusedInput]
  );

  useEffect(
    function resetTriggerPrice() {
      setTriggerPriceInputValue("");
    },
    [setTriggerPriceInputValue, toTokenAddress, tradeMode]
  );

  useEffect(
    function validateLeverageOption() {
      if (leverageOption && leverageOption > maxAllowedLeverage / BASIS_POINTS_DIVISOR) {
        setLeverageOption(maxAllowedLeverage / BASIS_POINTS_DIVISOR);
      }
    },
    [leverageOption, maxAllowedLeverage, setLeverageOption]
  );

  useEffect(
    function tradeBoxInteractionStartedEffect() {
      if (fromTokenInputValue.length > 0) {
        let pair = "";

        if (isSwap) {
          pair = `${fromToken?.symbol}/${toToken?.symbol}`;
        } else if (marketInfo) {
          pair = marketInfo.name;
        }

        let sizeDeltaUsd: bigint | undefined = undefined;
        let amountUsd: bigint | undefined = undefined;
        let priceImpactDeltaUsd = 0n;
        let priceImpactPercentage = 0n;

        if (isIncrease && increaseAmounts) {
          sizeDeltaUsd = increaseAmounts.sizeDeltaUsd;
          priceImpactDeltaUsd = increaseAmounts.positionPriceImpactDeltaUsd;
          priceImpactPercentage = fees?.increasePositionPriceImpact?.precisePercentage ?? 0n;
        } else if (isSwap && swapAmounts) {
          amountUsd = swapAmounts.usdOut;
          priceImpactDeltaUsd = swapAmounts.swapStrategy.swapPathStats?.totalSwapPriceImpactDeltaUsd ?? 0n;
          priceImpactPercentage = fees?.swapPriceImpact?.precisePercentage ?? 0n;
        } else if (isTrigger && decreaseAmounts) {
          sizeDeltaUsd = decreaseAmounts.sizeDeltaUsd;
          priceImpactDeltaUsd = decreaseAmounts.totalPendingImpactDeltaUsd;
          priceImpactPercentage = fees?.totalPendingImpact?.precisePercentage ?? 0n;
        }

        const openInterestPercent = isLong
          ? chartHeaderInfo?.longOpenInterestPercentage
          : chartHeaderInfo?.shortOpenInterestPercentage;
        const fundingRate1h = isLong ? chartHeaderInfo?.fundingRateLong : chartHeaderInfo?.fundingRateShort;

        if (!pair) {
          return;
        }

        sendTradeBoxInteractionStartedEvent({
          pair,
          sizeDeltaUsd,
          priceImpactDeltaUsd,
          priceImpactPercentage,
          fundingRate1h,
          isExpress: expressOrdersEnabled,
          isExpress1CT: Boolean(subaccount),
          openInterestPercent,
          tradeType,
          tradeMode,
          amountUsd,
        });
      }
    },
    [
      chartHeaderInfo?.fundingRateLong,
      chartHeaderInfo?.fundingRateShort,
      chartHeaderInfo?.longOpenInterestPercentage,
      chartHeaderInfo?.shortOpenInterestPercentage,
      decreaseAmounts,
      expressOrdersEnabled,
      fees?.increasePositionPriceImpact?.precisePercentage,
      fees?.totalPendingImpact?.precisePercentage,
      fees?.swapPriceImpact?.precisePercentage,
      fromToken?.symbol,
      fromTokenInputValue.length,
      increaseAmounts,
      isIncrease,
      isLong,
      isSwap,
      isTrigger,
      marketInfo,
      subaccount,
      swapAmounts,
      toToken?.symbol,
      tradeMode,
      tradeType,
    ]
  );

  const onSwitchTokens = useCallback(() => {
    setFocusedInput((old) => (old === "from" ? "to" : "from"));
    switchTokenAddresses();
    setFromTokenInputValue(toTokenInputValue || "", true);
    setToTokenInputValue(fromTokenInputValue || "", true);
  }, [
    fromTokenInputValue,
    setFocusedInput,
    setFromTokenInputValue,
    setToTokenInputValue,
    switchTokenAddresses,
    toTokenInputValue,
  ]);

  const onSelectToTokenAddress = useSelector(selectTradeboxChooseSuitableMarket);

  if (showDebugValues) {
    const swapPathStats = swapAmounts?.swapStrategy.swapPathStats || increaseAmounts?.swapStrategy.swapPathStats;

    if (swapPathStats) {
      // eslint-disable-next-line no-console
      throttleLog("Swap Path", {
        steps: swapPathStats.swapSteps,
        path: swapPathStats.swapPath.map((marketAddress) => marketsInfoData?.[marketAddress]?.name).join(" -> "),
        priceImpact: swapPathStats.swapSteps.map((step) => formatDeltaUsd(step.priceImpactDeltaUsd)).join(" -> "),
        usdOut: swapPathStats.swapSteps.map((step) => formatUsd(step.usdOut)).join(" -> "),
      });
    }
  }

  const handleFromInputTokenChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setFocusedInput("from");
      setFromTokenInputValue(event.target.value, true);
    },
    [setFocusedInput, setFromTokenInputValue]
  );
  const handleToInputTokenChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setFocusedInput("to");
      setToTokenInputValue(event.target.value, true);
    },
    [setFocusedInput, setToTokenInputValue]
  );
  const isNonEoaAccountOnAnyChain = useIsNonEoaAccountOnAnyChain();
  const handleSelectFromTokenAddress = useCallback(
    (tokenAddress: string, isGmxAccount: boolean) => {
      if (isGmxAccount && isNonEoaAccountOnAnyChain) {
        helperToast.error(t`Smart wallets are not supported on Express or One-Click Trading.`);
        return;
      }

      if (isGmxAccount && !expressOrdersEnabled) {
        setExpressOrdersEnabled(true);

        toastEnableExpress(() => setIsSettingsVisible(true));
      }

      onSelectFromTokenAddress(tokenAddress);
      setIsFromTokenGmxAccount(isGmxAccount);
    },
    [
      expressOrdersEnabled,
      isNonEoaAccountOnAnyChain,
      onSelectFromTokenAddress,
      setExpressOrdersEnabled,
      setIsFromTokenGmxAccount,
      setIsSettingsVisible,
    ]
  );
  const handleSelectToTokenAddress = useCallback(
    (token: Token) => onSelectToTokenAddress(token.address),
    [onSelectToTokenAddress]
  );
  const handleCloseInputChange = useCallback((e) => setCloseSizeInputValue(e.target.value), [setCloseSizeInputValue]);

  const formattedMaxCloseSize = formatAmount(selectedPosition?.sizeInUsd, USD_DECIMALS, 2);

  const setMaxCloseSize = useCallback(
    () => setCloseSizeInputValue(formattedMaxCloseSize),
    [formattedMaxCloseSize, setCloseSizeInputValue]
  );
  const handleClosePercentageChange = useCallback(
    (percent: number) =>
      setCloseSizeInputValue(
        formatAmount(((selectedPosition?.sizeInUsd ?? 0n) * BigInt(percent)) / 100n, USD_DECIMALS, 2)
      ),
    [selectedPosition?.sizeInUsd, setCloseSizeInputValue]
  );

  const handleTriggerPriceInputChange = useCallback(
    (e) => setTriggerPriceInputValue(e.target.value),
    [setTriggerPriceInputValue]
  );

  const setMarkPriceAsTriggerPrice = useCallback(() => {
    if (markPrice === undefined) {
      return;
    }

    setTriggerPriceInputValue(
      formatAmount(
        markPrice,
        USD_DECIMALS,
        calculateDisplayDecimals(markPrice, undefined, toToken?.visualMultiplier),
        undefined,
        undefined,
        toToken?.visualMultiplier
      )
    );
  }, [markPrice, setTriggerPriceInputValue, toToken?.visualMultiplier]);

  const handleTriggerMarkPriceClick = useCallback(
    () => setTriggerRatioInputValue(formatAmount(markRatio?.ratio, USD_DECIMALS, 10)),
    [markRatio?.ratio, setTriggerRatioInputValue]
  );
  const handleTriggerRatioInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setTriggerRatioInputValue(e.target.value);
    },
    [setTriggerRatioInputValue]
  );

  const handleSelectMarket = useCallback(
    (indexName: string, marketInfo: MarketInfo) => onSelectToTokenAddress(marketInfo.indexToken.address),
    [onSelectToTokenAddress]
  );

  const handleFormSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (!isCursorInside && (!submitButtonState.disabled || shouldDisableValidation)) {
        wrappedOnSubmit();
      }
    },
    [isCursorInside, wrappedOnSubmit, submitButtonState, shouldDisableValidation]
  );

  const handleLeverageInputBlur = useCallback(() => {
    if (leverageOption === 0) {
      setLeverageOption(leverageSliderMarks[0]);
      return;
    }

    if (leverageInputValue === "" && leverageOption !== undefined) {
      setLeverageInputValue(leverageOption.toString());
    }
  }, [leverageInputValue, leverageOption, leverageSliderMarks, setLeverageInputValue, setLeverageOption]);

  const handleLeverageInputKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();

        const isAlt = e.altKey;
        const direction = e.key === "ArrowUp" ? 1 : -1;
        const increment = isAlt ? 0.1 : 1;
        const diff = direction * increment;
        const newValue = Math.round(((leverageOption ?? leverageSliderMarks[0]) + diff) * 10) / 10;
        const clampedValue = Math.min(Math.max(newValue, leverageSliderMarks[0]), leverageSliderMarks.at(-1)!);

        setLeverageOption(clampedValue);
      }
    },
    [leverageOption, leverageSliderMarks, setLeverageOption]
  );

  const payUsd = isIncrease ? increaseAmounts?.initialCollateralUsd : fromUsd;

  function renderTokenInputs() {
    return (
      <>
        <BuyInputSection
          topLeftLabel={t`Pay`}
          bottomLeftValue={payUsd !== undefined ? formatUsd(payUsd) : ""}
          bottomRightValue={
            isHlVenue ? (
              <>
                {(hlUsdcBalance !== null || custodyUsdcBalance !== null) && (
                  <>
                    <span>
                      {((hlUsdcBalance ?? 0) + (custodyUsdcBalance ?? 0)).toFixed(2)}{" "}
                      <span className="text-typography-secondary">USDC</span>
                    </span>
                    {hlUsdcBalance !== null && (
                      <span className="ml-6 text-typography-secondary text-[11px]">
                        HL {hlUsdcBalance.toFixed(2)}
                      </span>
                    )}
                    {custodyUsdcBalance !== null && (
                      <span className="ml-4 text-typography-secondary text-[11px]">
                        +{custodyUsdcBalance.toFixed(2)} PerpX
                      </span>
                    )}
                  </>
                )}
              </>
            ) : fromToken && fromToken.balance !== undefined && fromToken.balance > 0n ? (
              <>
                {formatBalanceAmount(fromToken.balance, fromToken.decimals, undefined, {
                  isStable: fromToken.isStable,
                })}{" "}
                <span className="text-typography-secondary">{fromToken.symbol}</span>
              </>
            ) : undefined
          }
          inputValue={fromTokenInputValue}
          onInputValueChange={handleFromInputTokenChange}
          onClickMax={isHlVenue ? undefined : (showClickMax ? onMaxClick : undefined)}
          isDisabled={isHlVenue ? false : !fromToken || fromToken.balance === 0n}
          qa="pay"
        >
          {fromTokenAddress &&
            (!isSettlementChain(chainId) || isNonEoaAccountOnAnyChain ? (
              <TokenSelector
                label={t`Pay`}
                chainId={chainId}
                tokenAddress={fromTokenAddress}
                onSelectToken={(token) => {
                  handleSelectFromTokenAddress(token.address, false);
                }}
                tokens={swapTokens}
                infoTokens={infoTokens}
                showSymbolImage={true}
                showTokenImgInDropdown={true}
                missedCoinsPlace={MissedCoinsPlace.payToken}
                extendedSortSequence={sortedLongAndShortTokens}
                qa="collateral-selector"
              />
            ) : (
              <MultichainTokenSelector
                isConnected={active}
                openConnectModal={openConnectModal}
                walletIconUrls={walletIconUrls}
                chainId={chainId}
                srcChainId={srcChainId}
                label={t`Pay`}
                tokenAddress={fromTokenAddress}
                isGmxAccount={isFromTokenGmxAccount}
                onSelectTokenAddress={handleSelectFromTokenAddress}
                extendedSortSequence={sortedLongAndShortTokens}
                qa="collateral-selector"
                tokensData={tokensData}
                multichainTokens={multichainTokens}
                onDepositTokenAddress={onDepositTokenAddress}
              />
            ))}
        </BuyInputSection>

        {isSwap && (
          <>
            <div className="relative">
              {!isTwap && (
                <button
                  type="button"
                  disabled={!isSwitchTokensAllowed}
                  className={cx(
                    `absolute -top-19 left-1/2 flex size-36 -translate-x-1/2 cursor-pointer
                    items-center justify-center rounded-full bg-slate-600 text-typography-secondary`,
                    {
                      "hover:bg-[var(--color-fill-surfaceHover)] hover:bg-[linear-gradient(0deg,var(--color-slate-600),var(--color-slate-600))] hover:bg-blend-overlay":
                        isSwitchTokensAllowed,
                    }
                  )}
                  onClick={onSwitchTokens}
                  data-qa="swap-ball"
                >
                  <ArrowDownIcon className="block" />
                </button>
              )}
              <BuyInputSection
                topLeftLabel={isTwap ? t`Receive (Approximate)` : t`Receive`}
                bottomLeftValue={
                  !isTwap && swapAmounts?.usdOut !== undefined ? formatUsd(swapAmounts?.usdOut) : undefined
                }
                bottomRightValue={
                  !isTwap && toToken && toToken.balance !== undefined && toToken.balance > 0n
                    ? formatBalanceAmount(toToken.balance, toToken.decimals, toToken.symbol, {
                      isStable: toToken.isStable,
                    })
                    : undefined
                }
                inputValue={toTokenInputValue}
                onInputValueChange={handleToInputTokenChange}
                qa="swap-receive"
                isDisabled={isTwap}
              >
                {toTokenAddress && (
                  <TokenSelector
                    label={t`Receive`}
                    chainId={chainId}
                    tokenAddress={toTokenAddress}
                    onSelectToken={handleSelectToTokenAddress}
                    tokens={swapTokens}
                    infoTokens={infoTokens}
                    showSymbolImage={true}
                    showBalances={true}
                    showTokenImgInDropdown={true}
                    extendedSortSequence={sortedLongAndShortTokens}
                    qa="receive-selector"
                  />
                )}
              </BuyInputSection>
            </div>
          </>
        )}

        {isIncrease && (
          <BuyInputSection
            topLeftLabel={localizedTradeTypeLabels[tradeType!]}
            bottomLeftValue={
              increaseAmounts?.sizeDeltaUsd !== undefined
                ? formatUsd(increaseAmounts?.sizeDeltaUsd, { fallbackToZero: true })
                : ""
            }
            bottomRightLabel={t`Leverage`}
            bottomRightValue={
              formatLeverage(isLeverageSliderEnabled ? leverage : increaseAmounts?.estimatedLeverage) || "-"
            }
            inputValue={toTokenInputValue}
            onInputValueChange={handleToInputTokenChange}
            isDisabled={isHlVenue ? false : !fromToken || fromToken.balance === 0n}
            qa="buy"
          >
            {toTokenAddress && (
              <MarketSelector
                chainId={chainId}
                label={localizedTradeTypeLabels[tradeType!]}
                selectedIndexName={toToken ? getMarketIndexName({ indexToken: toToken, isSpotOnly: false }) : undefined}
                selectedMarketLabel={
                  toToken && (
                    <div className="flex items-center">
                      <TokenIcon className="mr-4" symbol={toToken.symbol} displaySize={20} />
                      <span>{getMarketIndexName({ indexToken: toToken, isSpotOnly: false })}</span>
                    </div>
                  )
                }
                markets={sortedAllMarkets ?? EMPTY_ARRAY}
                isSideMenu
                missedCoinsPlace={MissedCoinsPlace.marketDropdown}
                onSelectMarket={(_indexName, marketInfo) => onSelectToTokenAddress(marketInfo.indexToken.address)}
              />
            )}
          </BuyInputSection>
        )}
      </>
    );
  }

  function renderDecreaseSizeInput() {
    const showMaxButton = Boolean(
      selectedPosition?.sizeInUsd && selectedPosition.sizeInUsd > 0 && closeSizeInputValue !== formattedMaxCloseSize
    );

    return (
      <BuyInputSection
        topLeftLabel={t`Close`}
        bottomRightValue={selectedPosition?.sizeInUsd ? formatUsd(selectedPosition.sizeInUsd) : undefined}
        bottomLeftValue={formatUsd(closeSizeUsd)}
        inputValue={closeSizeInputValue}
        onInputValueChange={handleCloseInputChange}
        onClickBottomRightLabel={setMaxCloseSize}
        onClickMax={showMaxButton ? setMaxCloseSize : undefined}
        showPercentSelector={selectedPosition?.sizeInUsd ? selectedPosition.sizeInUsd > 0 : false}
        onPercentChange={handleClosePercentageChange}
        qa="close"
      >
        USD
      </BuyInputSection>
    );
  }

  function renderTriggerPriceInput() {
    const priceLabel = isLimit ? (tradeMode === TradeMode.Limit ? t`Limit Price` : t`Stop Price`) : t`Trigger Price`;

    return (
      <BuyInputSection
        topLeftLabel={priceLabel}
        topRightLabel={t`Mark`}
        topRightValue={formatUsdPrice(markPrice, {
          visualMultiplier: toToken?.visualMultiplier,
        })}
        onClickTopRightLabel={setMarkPriceAsTriggerPrice}
        inputValue={triggerPriceInputValue}
        onInputValueChange={handleTriggerPriceInputChange}
        qa="trigger-price"
      >
        USD
      </BuyInputSection>
    );
  }

  function renderTriggerRatioInput() {
    return (
      <BuyInputSection
        topLeftLabel={t`Limit Price`}
        topRightLabel={t`Mark`}
        topRightValue={formatAmount(markRatio?.ratio, USD_DECIMALS, 4)}
        onClickTopRightLabel={handleTriggerMarkPriceClick}
        inputValue={triggerRatioInputValue}
        onInputValueChange={handleTriggerRatioInputChange}
        qa="trigger-price"
      >
        {markRatio && (
          <>
            <TokenWithIcon symbol={markRatio.smallestToken.symbol} displaySize={20} /> per{" "}
            <TokenWithIcon symbol={markRatio.largestToken.symbol} displaySize={20} />
          </>
        )}
      </BuyInputSection>
    );
  }

  useKey(
    "Enter",
    () => {
      if (isCursorInside && (!submitButtonState.disabled || shouldDisableValidation)) {
        wrappedOnSubmit();
      }
    },
    {},
    [submitButtonState.disabled, shouldDisableValidation, isCursorInside, wrappedOnSubmit]
  );

  // Restart the counter whenever a step begins (and when the whole flow starts),
  // so each row shows time spent on *that* step rather than on the run as a whole.
  useEffect(() => {
    if (!isHlSubmitting) {
      setHlStepElapsed(0);
      return;
    }
    setHlStepElapsed(0);
    const startedAt = Date.now();
    const id = setInterval(() => setHlStepElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isHlSubmitting, hlSubmitStep]);

  // Past the step-1 estimate the deposit is slow but healthy: waitForHlBalance keeps
  // polling for a full 8 minutes. Left unexplained that reads as a hang, and the one
  // thing that actually loses the user their progress view is refreshing — so say both.
  // The ref latches it to a single toast; this effect runs on every one-second tick.
  const isHlDepositSlow =
    isHlSubmitting && hlNeedsDeposit && hlSubmitStep === 1 && hlStepElapsed > HL_STEP_ESTIMATE_SECONDS[1];

  useEffect(() => {
    if (!isHlDepositSlow || hlSlowWarnedRef.current) return;
    hlSlowWarnedRef.current = true;
    helperToast.info(
      t`Still working — Hyperliquid deposits can take a few minutes. Don't refresh the page. You can track this transfer in your PerpX Wallet history.`
    );
  }, [isHlDepositSlow]);

  const hlStepsIndicator = isHlVenue && isHlSubmitting && hlNeedsDeposit && (
    <div className="mb-8 flex flex-col gap-6 rounded-8 border border-slate-600 bg-slate-800 p-12">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-8">
          <div className={`flex size-20 items-center justify-center rounded-full text-[11px] font-bold ${
            hlSubmitStep === 1 ? "animate-pulse bg-blue-500 text-white" : "bg-green-500 text-white"
          }`}>
            {hlSubmitStep > 1 ? "✓" : "1"}
          </div>
          <span className={`text-body-small ${hlSubmitStep === 1 ? "text-typography-primary" : "text-green-500"}`}>
            {t`Deposit USDC to Hyperliquid`}
          </span>
          <HlStepTiming step={1} activeStep={hlSubmitStep} elapsed={hlStepElapsed} />
          {hlSubmitStep === 1 && <SpinnerIcon className="size-14 animate-spin text-blue-400" />}
        </div>

        {/* The one piece of hard evidence during a long wait: the transfer really happened.
            Indented to line up under the step label, and stopped from bubbling so opening
            the explorer never counts as a click on the form behind it. */}
        {hlDepositTxHash && (
          <div className="pl-28 text-body-small" onClick={(e) => e.stopPropagation()}>
            <ExternalLink
              href={CHAIN_ID_TO_TX_URL_BUILDER[ARBITRUM](hlDepositTxHash)}
              variant="icon"
              className="text-typography-secondary"
            >
              {t`View on Arbiscan`}: {shortenAddress(hlDepositTxHash, 13)}
            </ExternalLink>
          </div>
        )}

        {/* Survives the toast auto-closing, so a user who looks back still finds the reason. */}
        {isHlDepositSlow && (
          <div className="pl-28 text-body-small text-yellow-500">
            {t`Taking longer than usual. Don't refresh — you can track this transfer in your PerpX Wallet history.`}
          </div>
        )}
      </div>

      <div className="flex items-center gap-8">
        <div className={`flex size-20 items-center justify-center rounded-full text-[11px] font-bold ${
          hlSubmitStep === 2 ? "animate-pulse bg-blue-500 text-white" : "bg-slate-600 text-slate-400"
        }`}>
          2
        </div>
        <span className={`text-body-small ${hlSubmitStep === 2 ? "text-typography-primary" : "text-typography-secondary"}`}>
          {t`Place order on Hyperliquid`}
        </span>
        <HlStepTiming step={2} activeStep={hlSubmitStep} elapsed={hlStepElapsed} />
        {hlSubmitStep === 2 && <SpinnerIcon className="size-14 animate-spin text-blue-400" />}
      </div>
    </div>
  );

  const buttonContent = (
    <Button
      qa="confirm-trade-button"
      variant="primary-action"
      className="w-full [text-decoration:inherit]"
      onClick={wrappedOnSubmit}
      disabled={(submitButtonState.disabled && !shouldDisableValidation) || (isHlVenue && (hlAgentLoading || isHlSubmitting))}
    >
      {isHlVenue && hlAgentLoading
        ? t`Setting up Hyperliquid…`
        : isHlVenue && isHlSubmitting
          ? (hlSubmitStatus || t`Opening position…`)
          : submitButtonState.text}
    </Button>
  );
  const button = submitButtonState.tooltipContent ? (
    <Tooltip
      className="w-full"
      content={submitButtonState.tooltipContent}
      handle={buttonContent}
      isHandlerDisabled
      handleClassName="w-full"
      position="bottom"
      variant="none"
      contentClassName="w-full"
    />
  ) : (
    buttonContent
  );

  let nextLiqPriceFormatted = useMemo(() => {
    if (isTrigger && decreaseAmounts?.isFullClose) {
      return "-";
    }

    if (isIncrease && (increaseAmounts === undefined || increaseAmounts.sizeDeltaUsd === 0n)) {
      if (selectedPosition) {
        return undefined;
      } else {
        return "-";
      }
    }

    return formatLiquidationPrice(nextPositionValues?.nextLiqPrice, {
      visualMultiplier: toToken?.visualMultiplier,
    });
  }, [
    isTrigger,
    decreaseAmounts?.isFullClose,
    isIncrease,
    increaseAmounts,
    nextPositionValues?.nextLiqPrice,
    toToken?.visualMultiplier,
    selectedPosition,
  ]);

  const keepLeverage = useSelector(selectTradeboxKeepLeverage);
  const keepLeverageChecked = decreaseAmounts?.isFullClose ? false : keepLeverage ?? false;
  const setKeepLeverage = useSelector(selectTradeboxSetKeepLeverage);
  const settingsWarningDotVisible = useSelector(selectSettingsWarningDotVisible);

  const { shouldShowWarning: shouldShowOneClickTradingWarning } = useExpressTradingWarnings({
    expressParams: submitButtonState.expressParams,
    payTokenAddress: fromTokenAddress,
    isWrapOrUnwrap,
    isGmxAccount: isFromTokenGmxAccount,
  });

  const showSectionBetweenInputsAndButton =
    isPosition ||
    priceImpactWarningState.shouldShowWarning ||
    (!isTrigger && !isSwap) ||
    (isSwap && isLimit) ||
    isTwap ||
    maxAutoCancelOrdersWarning ||
    shouldShowOneClickTradingWarning;

  const tabsOptions = useMemo(() => {
    const modeToOptions = (mode: TradeMode) => ({
      value: mode,
      label: localizedTradeModeLabels[mode],
    });

    return availableTradeModes.map((mode) =>
      Array.isArray(mode)
        ? {
          label: t`More`,
          options: mode.map(modeToOptions),
        }
        : modeToOptions(mode)
    );
  }, [availableTradeModes, localizedTradeModeLabels]);

  return (
    <form className="flex w-full flex-col gap-8 overflow-x-hidden" onSubmit={handleFormSubmit} ref={formRef}>
      <div className="flex w-full flex-col gap-12 rounded-b-8 bg-slate-900 py-12 pb-16">
        <div className="px-12">
          <VenueSelector
            routing={routing}
            showRouting={isIncrease && isPosition}
            isOnGmx={isOnGmx}
            isOnHl={isOnHl}
            onUserChange={() => { venueForcedRef.current = false; }}
          />
        </div>
        {SHOW_POSITION_ACTIONS && !isSwap && (
          <div className="px-12">
            <Tabs options={tabsOptions} selectedValue={tradeMode} onChange={onSelectTradeMode} type="inline" />
          </div>
        )}
        <div className="flex w-full flex-col gap-12 px-12">
          <div className="text-body-medium flex grow flex-col gap-14">
            <div className="flex flex-col gap-4">
              {(isSwap || isIncrease) && renderTokenInputs()}
              {isTrigger && renderDecreaseSizeInput()}
              {isSwap && isLimit && renderTriggerRatioInput()}
              {isPosition && (isLimit || isTrigger) && renderTriggerPriceInput()}
            </div>
            {loading && (
              <div className="absolute grid size-full place-items-center">
                <Loader />
              </div>
            )}
            {showSectionBetweenInputsAndButton && (
              <div className="flex flex-col gap-14">
                {maxAutoCancelOrdersWarning}
                {isSwap && isLimit && !isTwap && (
                  <AlertInfoCard key="showHasBetterOpenFeesAndNetFeesWarning">
                    <Trans>
                      The actual execution price may differ from the set limit price due to fees and price impact. This
                      ensures that you receive at least the minimum receive amount.
                    </Trans>
                  </AlertInfoCard>
                )}

                {isPosition && (
                  <>
                    {isIncrease && isLeverageSliderEnabled && (
                      <div className="flex items-start gap-12">
                        <LeverageSlider
                          className="grow"
                          marks={leverageSliderMarks}
                          value={leverageOption}
                          onChange={setLeverageOption}
                          isPositive={isLong}
                          isSlim
                        />
                        <SuggestionInput
                          className="w-48 !rounded-8 py-5"
                          inputClassName="text-clip"
                          value={leverageInputValue}
                          setValue={setLeverageInputValue}
                          onBlur={handleLeverageInputBlur}
                          onKeyDown={handleLeverageInputKeyDown}
                          symbol="x"
                        />
                      </div>
                    )}
                    {showHighLeverageWarning && (
                      <AlertInfoCard type="info" onClose={dismissHighLeverageWarning}>
                        <Trans>Using high leverage increases the risk of liquidation.</Trans>
                      </AlertInfoCard>
                    )}
                    {isTrigger && (
                      <SyntheticsInfoRow
                        label={t`Market`}
                        value={
                          <MarketSelector
                            chainId={chainId}
                            label={t`Market`}
                            selectedIndexName={
                              toToken ? getMarketIndexName({ indexToken: toToken, isSpotOnly: false }) : undefined
                            }
                            markets={sortedAllMarkets ?? EMPTY_ARRAY}
                            isSideMenu
                            onSelectMarket={handleSelectMarket}
                          />
                        }
                      />
                    )}

                    <MarketPoolSelectorRow />

                    <CollateralSelectorRow
                      selectedMarketAddress={marketInfo?.marketTokenAddress}
                      onSelectCollateralAddress={onSelectCollateralAddress}
                      isMarket={isMarket}
                    />
                  </>
                )}

                {isTwap && (
                  <TwapRows
                    duration={duration}
                    numberOfParts={numberOfParts}
                    setNumberOfParts={setNumberOfParts}
                    setDuration={setDuration}
                    sizeUsd={isSwap ? payUsd : increaseAmounts?.sizeDeltaUsd}
                    marketInfo={marketInfo}
                    type={isSwap ? "swap" : "increase"}
                    isLong={isLong}
                  />
                )}
              </div>
            )}
            <div className="flex flex-col gap-14">
              {isPosition && isTrigger && selectedPosition && selectedPosition?.leverage !== undefined && (
                <ToggleSwitch
                  isChecked={keepLeverageChecked}
                  setIsChecked={setKeepLeverage}
                  disabled={decreaseAmounts?.isFullClose}
                >
                  <span className="text-14 text-typography-secondary">
                    <Trans>Keep leverage at {formatLeverage(selectedPosition.leverage)}</Trans>
                  </span>
                </ToggleSwitch>
              )}

              {!isTrigger && !isSwap && !isTwap && <LimitAndTPSLGroup />}

              {priceImpactWarningState.shouldShowWarning && (
                <HighPriceImpactOrFeesWarningCard
                  priceImpactWarningState={priceImpactWarningState}
                  collateralImpact={fees?.collateralNetPriceImpact}
                  positionImpact={fees?.positionNetPriceImpact}
                  swapPriceImpact={fees?.swapPriceImpact}
                  swapProfitFee={fees?.swapProfitFee}
                  executionFeeUsd={executionFee?.feeUsd}
                  externalSwapFeeItem={fees?.externalSwapFee}
                />
              )}

              {hlStepsIndicator}
              <div>{button}</div>
              {!isHlVenue && (
                <ExpressTradingWarningCard
                  expressParams={submitButtonState.expressParams}
                  payTokenAddress={!tradeFlags.isTrigger ? fromTokenAddress : undefined}
                  isWrapOrUnwrap={!tradeFlags.isTrigger && isWrapOrUnwrap}
                  disabled={shouldShowDepositButton}
                  isGmxAccount={isFromTokenGmxAccount}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-14 rounded-8 bg-slate-900 p-12 pb-16">
        {isSwap && !isTwap && <MinReceiveRow allowedSlippage={allowedSlippage} />}
        {isTrigger && selectedPosition && decreaseAmounts?.receiveUsd !== undefined && (
          <SyntheticsInfoRow
            label={t`Receive`}
            value={formatTokenAmountWithUsd(
              decreaseAmounts.receiveTokenAmount,
              decreaseAmounts.receiveUsd,
              collateralToken?.symbol,
              collateralToken?.decimals
            )}
            valueClassName="numbers"
          />
        )}

        {isTrigger && (
          <SyntheticsInfoRow
            label={t`PnL`}
            value={
              <ValueTransition
                from={
                  <>
                    {formatDeltaUsd(decreaseAmounts?.estimatedPnl)} (
                    {formatPercentage(decreaseAmounts?.estimatedPnlPercentage, { signed: true })})
                  </>
                }
                to={
                  decreaseAmounts?.sizeDeltaUsd && decreaseAmounts.sizeDeltaUsd > 0 ? (
                    <>
                      {formatDeltaUsd(nextPositionValues?.nextPnl)} (
                      {formatPercentage(nextPositionValues?.nextPnlPercentage, { signed: true })})
                    </>
                  ) : undefined
                }
              />
            }
          />
        )}
        {!(isTrigger && !selectedPosition) && !isSwap && !isTwap && (
          <SyntheticsInfoRow
            label={t`Liquidation Price`}
            value={
              <ValueTransition
                from={
                  selectedPosition
                    ? formatLiquidationPrice(selectedPosition?.liquidationPrice, {
                      visualMultiplier: toToken?.visualMultiplier,
                    })
                    : undefined
                }
                to={nextLiqPriceFormatted}
              />
            }
          />
        )}
        {!isTwap && <PriceImpactFeesRow />}
        <GasFeesRow
          sizeDeltaUsd={isIncrease ? increaseAmounts?.sizeDeltaUsd : undefined}
          executionFeeAmount={submitButtonState.totalExecutionFee?.feeTokenAmount}
          nativeTokenPrices={nativeToken?.prices}
        />
        <TradeBoxAdvancedGroups
          slippageInputId={submitButtonState.slippageInputId}
          gasPaymentParams={submitButtonState.expressParams?.gasPaymentParams}
          totalExecutionFee={submitButtonState.totalExecutionFee}
        />
      </div>

      {/* Custody Wallet Modal for deposits */}
      {submitButtonState.showCustodyWalletModal && submitButtonState.setShowCustodyWalletModal && (
        <CustodyWalletModal
          isVisible={submitButtonState.showCustodyWalletModal}
          setIsVisible={submitButtonState.setShowCustodyWalletModal}
          custodyWalletAddress={localStorage.getItem("custodyWallet") || ""}
        />
      )}
    </form>
  );
}
