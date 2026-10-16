import {
  COMPETITION_MIN_QUALIFYING_VOLUME_USD,
  COMPETITION_PRIZE_POOL_USD,
} from "./constants";
import type { CompetitionMetric } from "./useCompetitionLeaderboard";

/**
 * The confirmed reward structure, from the "Reward Structure" tab of the
 * competition plan.
 *
 * The sheet publishes a table of dollar amounts, but those amounts are
 * themselves derived from the pool and four percentages — so the percentages
 * are what live here and every figure on the page is computed from them. Typing
 * the dollar amounts in instead would mean a changed pool silently leaves a
 * stale prize table on a live page, which is the one failure mode a rewards
 * page cannot have.
 */

/**
 * Share of the total prize pool each board pays out. Sums to 1.
 *
 * `roi` is the board the plan calls "% PnL" — see `CompetitionEntry.roi` for
 * why the UI labels it "Return" while the rules and this split keep the
 * plan's name.
 */
export const BOARD_POOL_SHARE: Record<CompetitionMetric, number> = {
  volume: 0.5,
  pnl: 0.3,
  roi: 0.2,
};

/** Share of a board's own pool taken by ranks 1, 2 and 3. */
const TOP_RANK_SHARES = [0.2, 0.15, 0.1];

/** The last rank that is paid anything. */
export const LAST_PAID_RANK = 10;

/** Total prize money on one board, in USD. */
export function getBoardPoolUsd(metric: CompetitionMetric): number {
  return COMPETITION_PRIZE_POOL_USD * BOARD_POOL_SHARE[metric];
}

/**
 * What one rank wins on one board, in USD. Zero past `LAST_PAID_RANK`.
 *
 * The top three take a fixed share each and ranks 4–10 split whatever is left
 * evenly, which is what makes every board's payouts add back up to its pool
 * exactly regardless of how the pool is sliced.
 */
export function getRankRewardUsd(metric: CompetitionMetric, rank: number): number {
  if (!Number.isFinite(rank) || rank < 1 || rank > LAST_PAID_RANK) {
    return 0;
  }

  const pool = getBoardPoolUsd(metric);

  if (rank <= TOP_RANK_SHARES.length) {
    return pool * TOP_RANK_SHARES[rank - 1];
  }

  const remainder = pool * (1 - TOP_RANK_SHARES.reduce((sum, share) => sum + share, 0));
  return remainder / (LAST_PAID_RANK - TOP_RANK_SHARES.length);
}

/**
 * What a trader is currently in line to win on a board, in USD.
 *
 * A paying rank is not enough on its own: the published rules set a minimum
 * traded volume before an account can be paid at all, and early in a
 * competition the tail of the board is traders who registered and have not
 * traded. Quoting them a prize they cannot be paid is the kind of number people
 * plan around, so volume is checked here rather than only at settlement.
 */
export function getEstimatedRewardUsd(
  metric: CompetitionMetric,
  rank: number,
  volumeUsd: number
): number {
  if (volumeUsd < COMPETITION_MIN_QUALIFYING_VOLUME_USD) {
    return 0;
  }

  return getRankRewardUsd(metric, rank);
}
