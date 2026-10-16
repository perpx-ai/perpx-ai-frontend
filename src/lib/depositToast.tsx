import { Trans } from "@lingui/macro";
import { ReactNode } from "react";

import { helperToast } from "lib/helperToast";

import Button from "components/Button/Button";

/**
 * Error toast for "you don't have the funds to place this trade".
 *
 * The deposit modal is deliberately *not* opened for the user — an unrequested
 * modal on top of a failed submit steals focus and hides the reason it failed.
 * The toast states the reason and offers Deposit as an explicit next step; the
 * modal only opens if they take it.
 */
export function showDepositNeededToast(message: ReactNode, onDeposit: () => void) {
  helperToast.error(
    ({ closeToast }: { closeToast?: () => void }) => (
      <div className="flex flex-col items-start gap-10">
        <span>{message}</span>
        <Button
          variant="primary"
          size="small"
          onClick={() => {
            closeToast?.();
            onDeposit();
          }}
        >
          <Trans>Deposit</Trans>
        </Button>
      </div>
    ),
    // The toast body holds a button, so a stray click must not dismiss it, and
    // it should stay up long enough to actually be acted on.
    { closeOnClick: false, autoClose: 12000 }
  );
}
