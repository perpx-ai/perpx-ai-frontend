import { Trans, t } from "@lingui/macro";

import { getPageTitle } from "lib/legacy";

import AppPageLayout from "components/AppPageLayout/AppPageLayout";
import SEO from "components/Common/SEO";

import CompetitionBackdrop from "./CompetitionBackdrop";
import { useCompetitionRegistration } from "./CompetitionRegistrationContext";
import CompetitionSocialBar from "./CompetitionSocialBar";
import CountdownCard from "./CountdownCard";

/**
 * Where a registered visitor waits out the last stretch before the start.
 *
 * Reached only once registration is confirmed, and only before the start
 * instant — the route guards own both halves of that, and the countdown card
 * keeps its own clock, so the section moves itself on to the dashboard the
 * moment the competition goes live.
 */
export default function CompetitionComingSoon() {
  const { contact } = useCompetitionRegistration();

  return (
    <SEO
      title={getPageTitle(t`Trading Competition`)}
      description={t`You are registered for the PerpX trading competition. The leaderboard opens when the competition starts.`}
    >
      <AppPageLayout contentClassName="!max-w-none !gap-0 !p-0">
        <section
          className="relative isolate flex min-h-[calc(100vh-68px)] w-full flex-col overflow-hidden bg-[#081420]"
          style={{ minHeight: "calc(100dvh - 68px)" }}
        >
          <CompetitionBackdrop />

          <div
            className="relative z-10 mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center justify-center
              px-[clamp(16px,4vw,64px)] py-[clamp(32px,5vw,72px)] text-center"
          >
            <span
              className="rounded-full border border-[#35B9C0]/30 bg-[#35B9C0]/10 px-[clamp(10px,2vw,16px)]
                py-[clamp(5px,1.2vw,9px)] text-[clamp(10px,2.2vw,12px)] font-semibold uppercase
                tracking-[0.16em] text-[#35B9C0]"
            >
              <Trans>You are in</Trans>
            </span>

            <h1
              className="mt-[clamp(16px,3vw,28px)] text-[clamp(28px,5.6vw,46px)] font-bold
                leading-[1.1] tracking-[-0.02em] text-white"
            >
              {contact ? (
                <Trans>
                  See you at the open, <span className="text-[#35B9C0]">{contact.name}</span>
                </Trans>
              ) : (
                <Trans>
                  The competition opens <span className="text-[#35B9C0]">soon</span>
                </Trans>
              )}
            </h1>

            <p className="mt-[clamp(12px,2.2vw,20px)] max-w-[46ch] text-[clamp(13px,2.6vw,16px)] leading-[1.6] text-[#8296a5]">
              <Trans>
                Your spot is saved. The leaderboard and your volume stats unlock the moment the competition starts —
                this page moves you there on its own.
              </Trans>
            </p>

            <div className="flex w-full flex-col items-center">
              <CountdownCard />
            </div>

            <div className="mt-[clamp(10px,2vw,14px)] flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
              <CheckIcon />
              <span className="text-[clamp(12px,2.4vw,13px)] text-[#8296a5]">
                {contact ? (
                  <>
                    <Trans>Registered as</Trans> <span className="text-white">{contact.name}</span>
                  </>
                ) : (
                  <Trans>You are registered</Trans>
                )}
              </span>
            </div>
          </div>

          <CompetitionSocialBar />
        </section>
      </AppPageLayout>
    </SEO>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[#35B9C0]" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8.5 12.3l2.4 2.4 4.6-4.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
