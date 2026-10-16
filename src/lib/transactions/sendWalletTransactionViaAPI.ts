import { writeContract } from "lib/api/contractExecutor";
import { extendError } from "lib/errors";
import { getProvider } from "lib/rpc";
import { WalletSigner } from "lib/wallets";
import { getContractName } from "sdk/configs/contracts";

import { TxnCallback, TxnEventBuilder, TransactionWaiterResult } from "./types";

export type WalletTxnCtx = {};

export type WalletTxnResult = {
  transactionHash: string;
  wait: () => Promise<TransactionWaiterResult>;
};

/**
 * Send a wallet transaction via backend API instead of direct contract call
 * This routes the transaction through the custody wallet system
 */
export async function sendWalletTransactionViaAPI({
  chainId,
  signer,
  to,
  callData,
  value,
  gasLimit,
  msg,
  callback,
  contractName,
  functionName,
  args,
  metadata,
}: {
  chainId: number;
  signer: WalletSigner;
  to: string;
  callData: string;
  value?: bigint | number;
  gasLimit?: bigint | number;
  msg?: string;
  callback?: TxnCallback<WalletTxnCtx>;
  contractName?: string;
  functionName?: string;
  args?: any[];
  metadata?: {
    payAmountUsd?: string;
    positionSizeUsd?: string;
    positionType?: "LONG" | "SHORT";
    [key: string]: any;
  };
}) {
  const from = signer.address;
  const eventBuilder = new TxnEventBuilder<WalletTxnCtx>({});

  try {
    callback?.(eventBuilder.Sending());

    // Get custody wallet address
    const custodyWallet = localStorage.getItem("custodyWallet");
    if (!custodyWallet) {
      throw new Error("Custody wallet address not found. Please connect your wallet.");
    }

    // Determine contract name if not provided
    const finalContractName = contractName || getContractName(chainId, to);

    // Prepare API call params
    const apiParams = {
      userAddress: from,
      contractAddress: to,
      contractName: finalContractName,
      functionName: functionName || "multicall",
      args: args || [callData],
      chainId,
      value: value ? value.toString() : "0",
      ...(gasLimit !== undefined && { gasLimit: gasLimit.toString() }),
      ...(metadata && { metadata }),
    };

    // Call the backend API to execute the transaction
    const result = await writeContract(apiParams).catch((error) => {
      console.error("[WALLET_TXN_API] API call failed:", error);
      throw extendError(error, {
        errorContext: "sending via API",
      });
    });


    callback?.(
      eventBuilder.Sent({
        type: "wallet",
        transactionHash: result.transactionHash,
      })
    );

    return {
      transactionHash: result.transactionHash,
      wait: makeAPITxnResultWaiter(chainId, result.transactionHash, result.status),
    };
  } catch (error) {
    console.error("[WALLET_TXN_API] ❌ Transaction failed:", error);
    callback?.(eventBuilder.Error(error));
    throw error;
  }
}

/**
 * Create a waiter function for API-based transactions
 */
function makeAPITxnResultWaiter(chainId: number, hash: string, status: string) {
  return async (): Promise<TransactionWaiterResult> => {
    // For API-based transactions, the backend already waited for the transaction
    // So we can return the result immediately

    // If we need to verify, we can fetch the receipt from the blockchain
    try {
      const provider = getProvider(undefined, chainId);
      const receipt = await provider.getTransactionReceipt(hash);

      return {
        transactionHash: hash,
        blockNumber: receipt?.blockNumber,
        status: receipt?.status === 1 ? "success" : "failed",
      };
    } catch (error) {
      console.warn("[WALLET_TXN_API] Could not fetch receipt, using backend status:", status);

      // Fall back to backend status
      return {
        transactionHash: hash,
        blockNumber: undefined,
        status: status === "success" || status === "1" ? "success" : "failed",
      };
    }
  };
}
