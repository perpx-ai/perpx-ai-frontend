import { Trans } from "@lingui/macro";

import ExternalLink from "components/ExternalLink/ExternalLink";

import TelegramIcon from "img/ic_telegram.svg?react";
import XIcon from "img/social/ic_x_new.svg?react";

import { COMPETITION_SOCIALS } from "./constants";

/**
 * The GMT note and social links that close every competition page.
 *
 * pr-[100px] keeps its content clear of the app-wide FloatingTelegramButton,
 * which is fixed 32px from the right edge and 64px across.
 */
export default function CompetitionSocialBar() {
  return (
    <div
      className="relative z-10 mt-auto flex w-full flex-col items-start justify-between gap-[clamp(12px,2.5vw,16px)]
        border-t border-white/10 bg-[#0A1A26]/70 px-[clamp(16px,4vw,64px)] py-[clamp(14px,2.5vw,20px)]
        backdrop-blur-sm sm:flex-row sm:items-center
        pr-[100px]"
    >
      <div className="flex items-center gap-8 text-[clamp(12px,2.4vw,14px)] text-[#8296a5]">
        <ClockIcon />
        <span>
          <Trans>
            All times shown in <span className="font-semibold text-[#35B9C0]">GMT</span>
          </Trans>
        </span>
      </div>

      <div className="flex items-center gap-[clamp(12px,2.5vw,20px)]">
        <span className="text-[clamp(12px,2.4vw,14px)] text-[#8296a5]">
          <Trans>Stay tuned!</Trans>
        </span>

        <ExternalLink
          href={COMPETITION_SOCIALS.x}
          className="!no-underline text-[#8296a5] transition-colors hover:!text-[#35B9C0]"
        >
          <XIcon className="size-20" />
        </ExternalLink>

        <ExternalLink
          href={COMPETITION_SOCIALS.telegram}
          className="!no-underline text-[#8296a5] transition-colors hover:!text-[#35B9C0]"
        >
          <TelegramIcon className="size-20" />
        </ExternalLink>
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
