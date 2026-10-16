import { ReactNode } from "react";
import { Redirect, Route, Switch } from "react-router-dom";

import CompetitionComingSoon from "./CompetitionComingSoon";
import CompetitionDashboard from "./CompetitionDashboard";
import { CompetitionRegistrationProvider, useCompetitionRegistration } from "./CompetitionRegistrationContext";
import { COMPETITION_ROUTES } from "./constants";
import TradingCompetition from "./TradingCompetition";
import { useCompetitionPreview } from "./useCompetitionPreview";
import { useCompetitionStarted } from "./useCompetitionStarted";

/**
 * The competition section, and the two facts that route within it.
 *
 * A visitor's page is decided by whether they have registered and whether the
 * start instant has passed — nothing else — so the guards live here, once, over
 * a shared registration lookup:
 *
 *   not registered            -> the landing page, to register
 *   registered, not started   -> the countdown
 *   registered, started       -> the dashboard
 *
 * Both facts change while the page is open — registering, and the clock
 * reaching the start — and both are live here, so a visitor is carried forward
 * without touching the address bar.
 *
 * During local development `?preview=1` on any of these URLs steps past both
 * guards, so the countdown and the dashboard can be worked on without
 * registering a wallet or moving the start date. See useCompetitionPreview.
 */
export default function TradingCompetitionRoutes() {
  return (
    <CompetitionRegistrationProvider>
      <PreviewBadge />

      <Switch>
        <Route exact path={COMPETITION_ROUTES.comingSoon}>
          <RegisteredOnly>
            <BeforeStartOnly>
              <CompetitionComingSoon />
            </BeforeStartOnly>
          </RegisteredOnly>
        </Route>

        <Route exact path={COMPETITION_ROUTES.dashboard}>
          <RegisteredOnly>
            <AfterStartOnly>
              <CompetitionDashboard />
            </AfterStartOnly>
          </RegisteredOnly>
        </Route>

        <Route exact path={COMPETITION_ROUTES.landing}>
          <LandingOrOnwards />
        </Route>

        {/* Anything else under /trading-competition starts at the top. */}
        <Redirect to={COMPETITION_ROUTES.landing} />
      </Switch>
    </CompetitionRegistrationProvider>
  );
}

/**
 * Marks the page as bypassing its guards, so a dashboard reached at 11am on a
 * competition that starts at 6pm is never mistaken for the real thing.
 */
function PreviewBadge() {
  const isPreview = useCompetitionPreview();

  if (!isPreview) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed bottom-16 left-16 z-50 rounded-full border border-[#f7b731]/40
        bg-[#f7b731]/15 px-12 py-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f7b731]
        backdrop-blur-sm"
    >
      Preview — guards bypassed
    </div>
  );
}

/**
 * The landing page, until the visitor turns out to be registered — then on to
 * whichever page the clock says.
 */
function LandingOrOnwards() {
  const { isRegistered } = useCompetitionRegistration();
  const hasStarted = useCompetitionStarted();
  const isPreview = useCompetitionPreview();

  if (isRegistered && !isPreview) {
    return <Redirect to={hasStarted ? COMPETITION_ROUTES.dashboard : COMPETITION_ROUTES.comingSoon} />;
  }

  return <TradingCompetition />;
}

/**
 * Holds the registered-only pages back for unregistered visitors.
 *
 * While the lookup is still in flight the answer is unknown, so it renders the
 * page rather than bouncing — a registered visitor reloading on the dashboard
 * should not be flung back to the landing page for the split second the check
 * takes.
 */
function RegisteredOnly({ children }: { children: ReactNode }) {
  const { isRegistered, isChecking } = useCompetitionRegistration();
  const isPreview = useCompetitionPreview();

  if (!isRegistered && !isChecking && !isPreview) {
    return <Redirect to={COMPETITION_ROUTES.landing} />;
  }

  return <>{children}</>;
}

/** Sends a visitor on to the dashboard the moment the competition starts. */
function BeforeStartOnly({ children }: { children: ReactNode }) {
  const hasStarted = useCompetitionStarted();
  const isPreview = useCompetitionPreview();

  if (hasStarted && !isPreview) {
    return <Redirect to={COMPETITION_ROUTES.dashboard} />;
  }

  return <>{children}</>;
}

/** Keeps the dashboard shut until the competition starts. */
function AfterStartOnly({ children }: { children: ReactNode }) {
  const hasStarted = useCompetitionStarted();
  const isPreview = useCompetitionPreview();

  if (!hasStarted && !isPreview) {
    return <Redirect to={COMPETITION_ROUTES.comingSoon} />;
  }

  return <>{children}</>;
}
