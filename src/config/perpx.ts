/**
 * Deployment settings, read from VITE_* env vars (see .env.example).
 *
 * None of these have a built-in fallback, so no deployment URL or key ships in
 * the source — a missing value shows up as a broken request, not a silent call
 * to someone else's server.
 */
const env = import.meta.env;

/** Backend base URL, without a trailing slash. */
export const BACKEND_URL: string = (env.VITE_BACKEND_URL ?? "").replace(/\/+$/, "");

/** GraphQL endpoint for leaderboard and arena queries. */
export const BACKEND_GRAPHQL_URL: string = env.VITE_ARENA_GRAPHQL_URI || `${BACKEND_URL}/graphql`;

/** External staking app, linked from the header and side nav. */
export const STAKING_URL: string = env.VITE_STAKING_URL ?? "";

/** Community Telegram group. */
export const TELEGRAM_COMMUNITY_URL: string = env.VITE_TELEGRAM_COMMUNITY_URL ?? "";

/** Telegram bot used for quest "Join" deep links: t.me/<bot>?start=<wallet>. */
export const TELEGRAM_BOT_USERNAME: string = env.VITE_TELEGRAM_BOT_USERNAME ?? "";

/** X (Twitter) profile. */
export const X_URL: string = env.VITE_X_URL ?? "";

/** WalletConnect Cloud project id, required by RainbowKit. */
export const WALLET_CONNECT_PROJECT_ID: string = env.VITE_WALLET_CONNECT_PROJECT_ID ?? "";
