import { Trans, t } from "@lingui/macro";
import { Signer, ethers } from "ethers";
import { Link } from "react-router-dom";

import { getChainName, getExplorerUrl } from "config/chains";
import { AddTokenPermitFn } from "context/TokenPermitsContext/TokenPermitsContextProvider";
import { approveToken as approveTokenViaBackend } from "lib/api/contractExecutor";
import { INVALID_PERMIT_SIGNATURE_ERROR } from "lib/errors/customErrors";
import { helperToast } from "lib/helperToast";
import { metrics } from "lib/metrics";
import TokenAbi from "sdk/abis/Token";
import { getNativeToken, getToken } from "sdk/configs/tokens";
import { InfoTokens, TokenInfo } from "sdk/types/tokens";

import { getInvalidPermitSignatureToastContent } from "components/Errors/errorToasts";
import ExternalLink from "components/ExternalLink/ExternalLink";
import { ToastifyDebug } from "components/ToastifyDebug/ToastifyDebug";

type Params = {
  setIsApproving: (val: boolean) => void;
  signer: Signer | undefined;
  tokenAddress: string;
  spender: string;
  chainId: number;
  userAddress?: string; // User's connected wallet address for custody wallet lookup
  permitParams:
    | {
        addTokenPermit: AddTokenPermitFn;
        setIsPermitsDisabled: (disabled: boolean) => void;
        isPermitsDisabled: boolean;
      }
    | undefined;
  onApproveSubmitted?: ({ isPermit }: { isPermit: boolean }) => void;
  onApproveFail?: (error: Error, { isPermit }: { isPermit: boolean }) => void;
  getTokenInfo?: (infoTokens: InfoTokens, tokenAddress: string) => TokenInfo;
  infoTokens?: InfoTokens;
  pendingTxns?: any[];
  setPendingTxns?: (txns: any[]) => void;
  includeMessage?: boolean;
  approveAmount: bigint | undefined;
};

export async function approveTokens({
  setIsApproving,
  signer,
  tokenAddress,
  spender,
  chainId,
  userAddress,
  onApproveSubmitted,
  onApproveFail,
  getTokenInfo,
  infoTokens,
  pendingTxns,
  setPendingTxns,
  includeMessage,
  approveAmount,
  permitParams,
}: Params): Promise<void> {
  setIsApproving(true);

  if (approveAmount === undefined) {
    approveAmount = ethers.MaxUint256;
  }

  let shouldUsePermit = false;
  try {
    const token = getToken(chainId, tokenAddress);
    shouldUsePermit = Boolean(token?.isPermitSupported && !token.isPermitDisabled);
  } catch (e) {
    // ...ignore in case of glv / gm approval
  }

  if (permitParams?.addTokenPermit && shouldUsePermit && !permitParams.isPermitsDisabled) {
    return await permitParams
      .addTokenPermit(tokenAddress, spender, approveAmount)
      .then(() => {
        onApproveSubmitted?.({ isPermit: true });
        helperToast.success(
          <div>
            <Trans>Permit signed!</Trans>
            <br />
          </div>
        );
      })
      .catch((e) => {
        onApproveFail?.(e, { isPermit: true });
        let failMsg;
        let isUserError = false;

        if (e.message.includes("user rejected")) {
          isUserError = true;
          failMsg = t`Permit signing was cancelled`;
        } else if (e.message.includes(INVALID_PERMIT_SIGNATURE_ERROR)) {
          permitParams.setIsPermitsDisabled(true);
          failMsg = getInvalidPermitSignatureToastContent();
        } else {
          failMsg = (
            <>
              <Trans>Permit signing failed</Trans>
              <br />
              <ToastifyDebug error={String(e)} />
            </>
          );
        }

        if (!isUserError) {
          metrics.pushError(e, "approveTokens.permitError");
        }

        helperToast.error(failMsg);
      })
      .finally(() => {
        setIsApproving(false);
      });
  }

  // Use custody wallet backend API for approval instead of MetaMask
  const nativeToken = getNativeToken(chainId);
  const networkName = getChainName(chainId);

  if (!userAddress) {
    const error = new Error("User address is required for custody wallet approval");
    onApproveFail?.(error, { isPermit: false });
    helperToast.error(t`User address not found. Please reconnect your wallet.`);
    setIsApproving(false);
    return;
  }

  return await approveTokenViaBackend({
    userAddress,
    tokenAddress,
    spenderAddress: spender,
    amount: (approveAmount ?? ethers.MaxUint256).toString(),
    chainId,
  })
    .then(async (result) => {
      const txUrl = getExplorerUrl(chainId) + "tx/" + result.transactionHash;
      helperToast.success(
        <div>
          <Trans>
            Approval submitted via custody wallet! <ExternalLink href={txUrl}>View status.</ExternalLink>
          </Trans>
          <br />
        </div>
      );

      if (onApproveSubmitted) {
        onApproveSubmitted({ isPermit: false });
      }
      if (getTokenInfo && infoTokens && pendingTxns && setPendingTxns) {
        const token = getTokenInfo(infoTokens, tokenAddress);
        const pendingTxn = {
          hash: result.transactionHash,
          message: includeMessage ? t`${token.symbol} Approved!` : false,
        };
        setPendingTxns([...pendingTxns, pendingTxn]);
      }
    })
    .catch((e) => {
      onApproveFail?.(e, { isPermit: false });
      // eslint-disable-next-line no-console
      console.error(e);
      let failMsg;
      if (
        e.message?.includes("not enough funds for gas") ||
        e.message?.includes("InsufficientGasFunds")
      ) {
        failMsg = (
          <div>
            <Trans>
              There is not enough {nativeToken.symbol} in your custody wallet on {networkName} to send this transaction.
              <br />
              <br />
              Please deposit more {nativeToken.symbol} to your custody wallet.
            </Trans>
          </div>
        );
      } else if (e.message?.includes("User denied") || e.message?.includes("cancelled")) {
        failMsg = t`Approval was cancelled.`;
      } else {
        failMsg = (
          <>
            <Trans>Approval failed.</Trans>
            <br />
            <br />
            <ToastifyDebug error={String(e)} />
          </>
        );
      }
      helperToast.error(failMsg);
    })
    .finally(() => {
      setIsApproving(false);
    });
}
