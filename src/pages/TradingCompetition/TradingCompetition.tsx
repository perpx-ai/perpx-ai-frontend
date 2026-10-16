import { Trans, t } from "@lingui/macro";

import AppPageLayout from "components/AppPageLayout/AppPageLayout";
import SEO from "components/Common/SEO";
import { getPageTitle } from "lib/legacy";

import CompetitionBackdrop from "./CompetitionBackdrop";
import CompetitionRegistration from "./CompetitionRegistration";
import CompetitionSocialBar from "./CompetitionSocialBar";
import { useCompetitionStarted } from "./useCompetitionStarted";

/** Bull artwork lives in `public/`, so it is served from the site root. */
const BULL_IMAGE_URL = "/Bull.png";

/**
 * The competition's front door: the pitch, and the registration gate.
 *
 * It is the page for visitors who have not registered yet — the moment they
 * have, TradingCompetitionRoutes hands them to the countdown, or straight to
 * the dashboard once the competition is live.
 *
 * Because an unregistered visitor lands here whether or not the competition has
 * started, the pitch reads from `useCompetitionStarted` rather than being fixed
 * copy — telling someone the challenge "is coming" while it is already running
 * is both wrong and a reason not to sign up.
 */
export default function TradingCompetition() {
  const hasStarted = useCompetitionStarted();

  return (
    <SEO
      title={getPageTitle(t`Trading Competition`)}
      description={
        hasStarted
          ? t`The PerpX trading challenge is live. Register now, beat the market and win amazing rewards.`
          : t`The ultimate PerpX trading challenge is coming. Sharpen your strategy, beat the market and win amazing rewards.`
      }
    >
      <AppPageLayout contentClassName="!max-w-none !gap-0 !p-0">
        <section
          className="relative isolate flex min-h-[calc(100vh-68px)] w-full flex-col overflow-hidden bg-[#081420]"
          style={{ minHeight: "calc(100dvh - 68px)" }}
        >
          <CompetitionBackdrop />

          <div
            className="relative z-10 mx-auto grid w-full max-w-[1512px] flex-1 items-center
              gap-[clamp(32px,5vw,56px)] px-[clamp(16px,4vw,64px)] py-[clamp(32px,5vw,72px)]
              lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"
          >
            <div className="flex min-w-0 flex-col items-start">
              <span
                className="inline-flex items-center gap-8 rounded-full border border-[#35B9C0]/30 bg-[#35B9C0]/10
                  px-[clamp(10px,2vw,16px)] py-[clamp(5px,1.2vw,9px)] text-[clamp(10px,2.2vw,12px)]
                  font-semibold uppercase tracking-[0.16em] text-[#35B9C0]"
              >
                <Trans>Trading Competition</Trans>
                {hasStarted && (
                  <>
                    <span className="text-[#35B9C0]/40" aria-hidden>
                      ·
                    </span>
                    <span className="inline-flex items-center gap-6">
                      <span className="size-6 animate-pulse rounded-full bg-[#35B9C0]" aria-hidden />
                      <Trans>Live</Trans>
                    </span>
                  </>
                )}
              </span>

              <h1
                className="mt-[clamp(16px,3vw,28px)] text-[clamp(30px,6.4vw,54px)] font-bold
                  leading-[1.1] tracking-[-0.02em] text-white"
              >
                {hasStarted ? (
                  <Trans>
                    The Ultimate Trading Challenge is <span className="text-[#35B9C0]">Live</span>
                  </Trans>
                ) : (
                  <Trans>
                    The Ultimate Trading Challenge is <span className="text-[#35B9C0]">Coming</span>
                  </Trans>
                )}
              </h1>

              <p
                className="mt-[clamp(12px,2.2vw,20px)] max-w-[46ch] text-[clamp(13px,2.6vw,16px)]
                  leading-[1.6] text-[#8296a5]"
              >
                {hasStarted ? (
                  <Trans>The challenge has begun. Register to join the live leaderboard and win amazing rewards.</Trans>
                ) : (
                  <Trans>Sharpen your strategy. Beat the market. Win amazing rewards.</Trans>
                )}
              </p>

              <CompetitionRegistration />
            </div>

            <BullArtwork />
          </div>

          <CompetitionSocialBar />
        </section>
      </AppPageLayout>
    </SEO>
  );
}

function BullArtwork() {
  /** Decorative candlestick ticks, echoing a rising market behind the bull. */
  const candles = [26, 44, 34, 58, 48, 72, 62, 88, 78, 100];

  return (
    <div className="relative min-w-0">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-radial
          from-[#35B9C0]/25 via-[#0e7f8e]/10 to-[#0e7f8e]/0 blur-[70px]"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-[6%] hidden h-[38%] items-end
          gap-[clamp(4px,0.9vw,8px)] opacity-40 md:flex"
      >
        {candles.map((height, index) => (
          <div
            key={index}
            style={{ height: `${height}%` }}
            className="w-[clamp(3px,0.7vw,6px)] rounded-full bg-gradient-to-t from-[#35B9C0]/0 to-[#35B9C0]/80"
          />
        ))}
      </div>

      <img
        src={BULL_IMAGE_URL}
        alt={t`Glowing bull charging upward`}
        width={1536}
        height={1024}
        decoding="async"
        className="mx-auto h-auto w-full max-w-[720px] object-contain
          drop-shadow-[0_0_50px_rgba(29,233,182,0.28)]"
      />
    </div>
  );
}
