import { Provider } from "ethers";
import { withRetry } from "viem";

import { ContractsChainId } from "config/chains";
import { ExpressTxnParams } from "domain/synthetics/express";
import { buildAndSignExpressBatchOrderTxn } from "domain/synthetics/express/expressOrderUtils";
import { isLimitOrderType, isTriggerDecreaseOrderType } from "domain/synthetics/orders";
import { TokensData } from "domain/tokens";
import { extendError } from "lib/errors";
import { sendExpressTransaction } from "lib/transactions/sendExpressTransaction";
import { sendWalletTransaction } from "lib/transactions/sendWalletTransaction";
import { sendWalletTransactionViaAPI } from "lib/transactions/sendWalletTransactionViaAPI";
import { TxnCallback, TxnEventBuilder } from "lib/transactions/types";
import { BlockTimestampData } from "lib/useBlockTimestampRequest";
import { WalletSigner } from "lib/wallets";
import { getContract } from "sdk/configs/contracts";
import {
  BatchOrderTxnParams,
  getBatchOrderMulticallPayload,
  getIsInvalidBatchReceiver,
  getIsTwapOrderPayload,
} from "sdk/utils/orderTransactions";
import { formatAmount, USD_DECIMALS } from "sdk/utils/numbers";
import { getToken } from "sdk/configs/tokens";

import { signerAddressError } from "components/Errors/errorToasts";

import { getOrdersTriggerPriceOverrides, getSimulationPrices, simulateExecution } from "./simulation";
import { callRelayTransaction } from "../express/callRelayTransaction";

export type BatchSimulationParams = {
  tokensData: TokensData;
  blockTimestampData: BlockTimestampData | undefined;
};

export type BatchOrderTxnCtx = {
  expressParams: ExpressTxnParams | undefined;
  batchParams: BatchOrderTxnParams;
  signer: WalletSigner;
};

const DEFAULT_RUN_SIMULATION = () => Promise.resolve(undefined);

export async function sendBatchOrderTxn({
  chainId,
  signer,
  isGmxAccount,
  provider,
  batchParams,
  expressParams,
  simulationParams,
  callback,
}: {
  chainId: ContractsChainId;
  signer: WalletSigner;
  isGmxAccount: boolean;
  provider: Provider;
  batchParams: BatchOrderTxnParams;
  expressParams: ExpressTxnParams | undefined;
  simulationParams: BatchSimulationParams | undefined;
  callback: TxnCallback<BatchOrderTxnCtx> | undefined;
}) {
  const eventBuilder = new TxnEventBuilder<BatchOrderTxnCtx>({ expressParams, batchParams, signer });

  try {
    if (isGmxAccount && !expressParams) {
      throw new Error("Multichain orders are only supported with express params");
    }

    if (isGmxAccount && !provider) {
      throw new Error("provider is required for multichain txns");
    }
    callback?.(eventBuilder.Submitted());

    let runSimulation: () => Promise<void> = DEFAULT_RUN_SIMULATION;

    if (simulationParams) {
      runSimulation = () => {
        return makeBatchOrderSimulation({
          chainId,
          signer,
          batchParams,
          blockTimestampData: simulationParams.blockTimestampData,
          tokensData: simulationParams.tokensData,
          expressParams,
          provider,
          isGmxAccount,
        });
      };
    }

    if (expressParams) {
      await runSimulation().then(() => callback?.(eventBuilder.Simulated()));
      const txnData = await buildAndSignExpressBatchOrderTxn({
        chainId,
        signer,
        batchParams,
        relayParamsPayload: expressParams.relayParamsPayload,
        relayerFeeTokenAddress: expressParams.gasPaymentParams.relayerFeeTokenAddress,
        relayerFeeAmount: expressParams.gasPaymentParams.relayerFeeAmount,
        subaccount: expressParams.subaccount,
        isGmxAccount,
      });

      callback?.(eventBuilder.Sending());

      const res = withRetry(
        () =>
          sendExpressTransaction({
            chainId,
            txnData,
            isSponsoredCall: expressParams.isSponsoredCall,
          }),
        {
          retryCount: 3,
          delay: 300,
        }
      )
        .then(async (res) => {
          callback?.(
            eventBuilder.Sent({
              type: "relay",
              relayTaskId: res.taskId,
            })
          );

          return res;
        })
        .catch((error) => {
          throw extendError(error, {
            errorContext: "sending",
          });
        });

      return res;
    }

    const { callData, value, encodedMulticall } = getBatchOrderMulticallPayload({ params: batchParams });

    // Extract USD values from order params for backend logging/tracking
    let payAmountUsd = "0";
    let positionSizeUsd = "0";
    let positionType: "LONG" | "SHORT" | undefined;

    if (batchParams.createOrderParams.length > 0) {
      const firstOrder = batchParams.createOrderParams[0];

      // Get the pay amount in USD
      // For increase orders, use payTokenAmount. For decrease orders, calculate from collateralDeltaAmount
      const params = firstOrder.params as any;
      if (params.payTokenAmount && params.payTokenAddress) {
        // This is likely an increase or swap order
        try {
          const payToken = getToken(chainId, params.payTokenAddress);
          // Convert token amount to USD: (amount * price) / 10^tokenDecimals
          // The result is already in USD with 30 decimals, so we need to format it
          const payAmountInTokenDecimals = formatAmount(params.payTokenAmount, payToken.decimals, 2, false, "0");
          // For stablecoins like USDC, the price is ~$1, so payAmountInTokenDecimals ≈ payAmountUsd
          payAmountUsd = payAmountInTokenDecimals;
        } catch (error) {
          console.warn("[SEND_BATCH_ORDER] Could not get pay token info:", error);
        }
      }

      // Get the position size in USD
      // sizeDeltaUsd is already in USD with 30 decimals
      const sizeDeltaUsd = firstOrder.orderPayload.numbers.sizeDeltaUsd;
      if (sizeDeltaUsd && sizeDeltaUsd > 0n) {
        positionSizeUsd = formatAmount(sizeDeltaUsd, USD_DECIMALS, 2, false, "0");
      }

      // Get the position type (LONG or SHORT)
      positionType = firstOrder.orderPayload.isLong ? "LONG" : "SHORT";
    }

    console.log("[SEND_BATCH_ORDER] Pay Amount USD:", payAmountUsd);
    console.log("[SEND_BATCH_ORDER] Position Size USD:", positionSizeUsd);
    console.log("[SEND_BATCH_ORDER] Position Type:", positionType);

    // Use API-based transaction for custody wallet
    return sendWalletTransactionViaAPI({
      chainId,
      signer,
      to: getContract(chainId, "ExchangeRouter"),
      callData,
      value,
      msg: "Create Order",
      contractName: "ExchangeRouter",
      functionName: "multicall",
      args: [encodedMulticall], // Pass the array of encoded function calls
      metadata: {
        payAmountUsd,
        positionSizeUsd,
        type:positionType,
      },
      callback: (event) => {
        callback?.(eventBuilder.extend(event));
      },
    });
  } catch (error) {
    callback?.(eventBuilder.Error(error));

    throw error;
  }
}

export const makeBatchOrderSimulation = async ({
  chainId,
  signer,
  isGmxAccount,
  provider,
  batchParams,
  blockTimestampData,
  tokensData,
  expressParams,
}: {
  chainId: ContractsChainId;
  signer: WalletSigner;
  isGmxAccount: boolean;
  provider: Provider;
  batchParams: BatchOrderTxnParams;
  blockTimestampData: BlockTimestampData | undefined;
  tokensData: TokensData;
  expressParams: ExpressTxnParams | undefined;
}): Promise<void> => {
  try {
    // For custody wallet flow, both receiver validation and simulation must use custody wallet as the effective account.
    const custodyWalletAddress = localStorage.getItem("custodyWallet");
    const validReceiverAddress = custodyWalletAddress || signer.address;

    if (getIsInvalidBatchReceiver(batchParams, validReceiverAddress)) {
      throw extendError(new Error(signerAddressError), {
        errorContext: "simulation",
      });
    }

    if (
      expressParams?.subaccount &&
      expressParams?.subaccountValidations &&
      !expressParams.subaccountValidations.isValid
    ) {
      const { onchainData, signedApproval } = expressParams.subaccount;

      throw extendError(new Error("Invalid subaccount"), {
        data: {
          isExpired: expressParams.subaccountValidations.isExpired,
          isActionsExceeded: expressParams.subaccountValidations.isActionsExceeded,
          isNonceExceeded: expressParams.subaccountValidations.isNonceExpired,
          onchainData: {
            maxAllowedCount: onchainData.maxAllowedCount,
            currentCount: onchainData.currentActionsCount,
            expiresAt: onchainData.expiresAt,
            isActive: onchainData.active,
            nonce: onchainData.approvalNonce,
            multichainNonce: onchainData.multichainApprovalNonce,
            integrationId: onchainData.integrationId,
          },
          signedData: {
            maxAllowedCount: signedApproval.maxAllowedCount,
            expiresAt: signedApproval.expiresAt,
            shouldAdd: signedApproval.shouldAdd,
            nonce: signedApproval.nonce,
            integrationId: signedApproval.integrationId,
          },
        },
      });
    }

    if (expressParams && expressParams.gasPaymentValidations.isOutGasTokenBalance) {
      throw extendError(new Error("Out of gas token balance"), {
        data: {
          gasPaymentTokenAmount: expressParams.gasPaymentParams.gasPaymentTokenAmount,
          gasPaymentTokenAddress: expressParams.gasPaymentParams.gasPaymentTokenAddress,
        },
      });
    }

    if (expressParams && expressParams.gasPaymentValidations.needGasPaymentTokenApproval) {
      throw extendError(new Error("Need gas payment token approval"), {
        data: {
          gasPaymentTokenAmount: expressParams.gasPaymentParams.gasPaymentTokenAmount,
          gasPaymentTokenAddress: expressParams.gasPaymentParams.gasPaymentTokenAddress,
        },
      });
    }

    const isSimulationAllowed = batchParams.createOrderParams.every(
      (co) =>
        !isLimitOrderType(co.orderPayload.orderType) &&
        !isTriggerDecreaseOrderType(co.orderPayload.orderType) &&
        !getIsTwapOrderPayload(co.orderPayload)
    );

    // Simulate execution makes sense only for order creation transactions
    if (batchParams.createOrderParams.length === 0 || !isSimulationAllowed) {
      return Promise.resolve();
    }

    if (isGmxAccount) {
      if (!expressParams) {
        throw new Error("Multichain orders are only supported with express params");
      }

      const { callData, feeAmount, feeToken, to } = await buildAndSignExpressBatchOrderTxn({
        signer,
        chainId,
        relayParamsPayload: expressParams.relayParamsPayload,
        batchParams: batchParams,
        subaccount: expressParams.subaccount,
        emptySignature: true,
        relayerFeeTokenAddress: expressParams.gasPaymentParams.relayerFeeTokenAddress,
        relayerFeeAmount: expressParams.gasPaymentParams.relayerFeeAmount,
        isGmxAccount,
      });

      await callRelayTransaction({
        chainId,
        relayRouterAddress: to,
        gelatoRelayFeeToken: feeToken,
        gelatoRelayFeeAmount: feeAmount,
        provider,
        calldata: callData,
      });
    } else {
      const { encodedMulticall, value } = getBatchOrderMulticallPayload({
        params: {
          ...batchParams,
          createOrderParams: [batchParams.createOrderParams[0]],
        },
      });

      await simulateExecution(chainId, {
        account: validReceiverAddress,
        prices: getSimulationPrices(
          chainId,
          tokensData,
          getOrdersTriggerPriceOverrides([batchParams.createOrderParams[0]])
        ),
        tokenPermits: expressParams?.relayParamsPayload.tokenPermits ?? [],
        createMulticallPayload: encodedMulticall,
        value,
        blockTimestampData,
        isExpress: Boolean(expressParams),
      });
    }
  } catch (error) {
    throw extendError(error, {
      errorContext: "simulation",
    });
  }
};
