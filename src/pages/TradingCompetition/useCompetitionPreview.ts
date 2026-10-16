import { useLocation } from "react-router-dom";

/** Add `?preview=1` to any competition URL to open it during local development. */
const PREVIEW_PARAM = "preview";

/**
 * Whether to show the current competition page regardless of the guards.
 *
 * The section is normally gated twice over — registration, then the start
 * instant — which makes the countdown and the dashboard awkward to work on:
 * seeing either one means registering a wallet or editing the start date. With
 * `?preview=1` the guards step aside and the page renders as-is.
 *
 * Gated on `import.meta.env.DEV`, which Vite replaces with the literal `false`
 * in every build, so the whole bypass is dead code the bundler drops — it cannot
 * be turned on in production. That matters here because `isDevelopment()` and
 * `isLocal()` in config/env are both stubbed to return true unconditionally, so
 * neither would have kept this off the deployed site.
 */
export function useCompetitionPreview(): boolean {
  const { search } = useLocation();

  if (!import.meta.env.DEV) {
    return false;
  }

  return new URLSearchParams(search).get(PREVIEW_PARAM) === "1";
}
