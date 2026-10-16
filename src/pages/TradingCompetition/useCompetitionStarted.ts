import { useEffect, useState } from "react";

import { COMPETITION_START_MS } from "./constants";

/** setTimeout saturates past ~24.8 days, firing immediately; re-arm instead. */
const MAX_TIMEOUT_MS = 2_000_000_000;

/**
 * Whether the competition has started, flipping to true the moment it does.
 *
 * Sleeps until the start instant rather than polling, so the routes that hang
 * off this — coming-soon before, dashboard after — swap over on their own
 * without the visitor reloading, and nothing ticks in the meantime.
 */
export function useCompetitionStarted(): boolean {
  const [hasStarted, setHasStarted] = useState(() => Date.now() >= COMPETITION_START_MS);

  useEffect(() => {
    if (hasStarted) {
      return;
    }

    const msLeft = COMPETITION_START_MS - Date.now();

    if (msLeft <= 0) {
      setHasStarted(true);
      return;
    }

    const timeoutId = setTimeout(
      () => setHasStarted(Date.now() >= COMPETITION_START_MS),
      Math.min(msLeft, MAX_TIMEOUT_MS)
    );

    return () => clearTimeout(timeoutId);
  }, [hasStarted]);

  return hasStarted;
}
