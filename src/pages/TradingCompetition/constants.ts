import { TELEGRAM_COMMUNITY_URL, X_URL } from "config/perpx";

/**
 * Trading competition start — 18:00 IST on 18 September 2026.
 *
 * Stored as an explicit UTC instant so the countdown and the phase switch are
 * identical for every visitor regardless of their local timezone; the page
 * renders it as 12:30 GMT, which is the same moment. Change this one line to
 * move the competition; everything else (countdown, displayed date, which of
 * the three competition routes a visitor lands on) derives from it.
 */
export const COMPETITION_START_ISO = "2026-09-18T12:30:00Z";

export const COMPETITION_START_MS = Date.parse(COMPETITION_START_ISO);

/**
 * Start of the window the standings count volume over, sent to the leaderboard
 * endpoint as `fromDate` — 18:00 IST, the competition start itself.
 *
 * The same instant as `COMPETITION_START_ISO` rather than a second copy of it,
 * so moving the competition moves what the standings count and the two can
 * never drift apart. Sent as `…T12:30:00Z`, which the endpoint parses to the
 * same moment as the `+05:30` form.
 *
 * Without a range the endpoint returns lifetime totals, which would credit
 * trades made long before the competition — so this is always sent.
 */
export const COMPETITION_VOLUME_FROM_ISO = COMPETITION_START_ISO;

/**
 * The three competition routes. A visitor moves between them on two facts
 * alone — whether they have registered, and whether the start instant above has
 * passed — so every guard in the section reads from here.
 */
export const COMPETITION_ROUTES = {
  /** Hero + registration gate. Where an unregistered visitor always ends up. */
  landing: "/trading-competition",
  /** Registered, not started yet: the countdown. */
  comingSoon: "/trading-competition/coming-soon",
  /** Registered, started: volume stats and the standings table. */
  dashboard: "/trading-competition/dashboard",
} as const;

export const COMPETITION_SOCIALS = {
  x: X_URL,
  telegram: TELEGRAM_COMMUNITY_URL,
};

/**
 * Anchor id for the rules section, and the target of the "Rules & Structure"
 * button at the top of the dashboard. Shared so the button and the section it
 * scrolls to can never drift apart.
 */
export const COMPETITION_RULES_ANCHOR = "competition-rules";

/**
 * The confirmed prize pool, in USD.
 *
 * Confirmed by marketing as fixed at $5,000 USDC. Deliberately a number rather
 * than a formatted string so the one place it is rendered controls the
 * formatting, and every mention on the page moves together if it changes.
 */
export const COMPETITION_PRIZE_POOL_USD = 5_000;

/** Competition length in days, as stated in the published rules. */
export const COMPETITION_DURATION_DAYS = 30;

/** USDC balance required at registration. */
export const COMPETITION_MIN_DEPOSIT_USD = 50;

/** Notional volume below which an account scores but cannot be paid. */
export const COMPETITION_MIN_QUALIFYING_VOLUME_USD = 100;
