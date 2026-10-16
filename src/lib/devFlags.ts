/**
 * Local-only escape hatches. Each flag requires the Vite dev server, so a
 * production build ignores it even if the env var leaks into the build env.
 */

/**
 * Show the extra position actions — GMX edit collateral / increase size / TP-SL menu and the
 * Hyperliquid limit close (set VITE_SHOW_POSITION_ACTIONS=true in .env.local).
 */
export const SHOW_POSITION_ACTIONS = import.meta.env.DEV && import.meta.env.VITE_SHOW_POSITION_ACTIONS === "true";
