import { t } from "@lingui/macro";

import AppPageLayout from "components/AppPageLayout/AppPageLayout";
import SEO from "components/Common/SEO";
import ExternalLink from "components/ExternalLink/ExternalLink";
import { getPageTitle } from "lib/legacy";
import TelegramIcon from "img/social/ic_telegram_new.svg?react";
import XIcon from "img/social/ic_x_new.svg?react";
import frameImage from "img/social/Frame 1261159215.png";
import { TELEGRAM_COMMUNITY_URL, X_URL } from "config/perpx";

export default function ComingSoon() {
  return (
    <SEO
      title={getPageTitle(t`Staking Rewards`)}
      description={t`Stake PerpX tokens to earn rewards. Staking rewards are coming soon — follow us for updates.`}
    >
    <AppPageLayout className="!overflow-hidden">
      <div className="relative flex h-[calc(100vh-68px)] w-full items-center justify-center overflow-hidden bg-[#111D2D]">
        {/* Main Content Container */}
        <div className="relative z-10 flex flex-col items-center justify-center">
          {/* Coming Soon Text */}
          <h1 className="mb-12 text-center font-['Manrope'] text-[40px] font-medium uppercase tracking-[0.49em] text-white">
            COMING SOON
          </h1>

          {/* Center Image with Glow Effect */}
          <div className="relative mb-32 flex h-[399px] w-[498px] items-center justify-center">
            {/* Background Glow Effect - Larger and more subtle */}
            <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-radial from-[#70FDFF]/40 via-[#439899]/30 to-transparent blur-[80px]"></div>

            {/* Secondary Glow */}
            <div className="absolute left-1/2 top-1/2 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-radial from-[#70FDFF]/60 to-[#439899]/40 blur-[50px]"></div>

            {/* Main Frame Image */}
            <img
              src={frameImage}
              alt="Coming Soon"
              className="relative z-10 h-auto w-full max-w-[498px] drop-shadow-[0_0_80px_rgba(112,253,255,0.4)]"
            />
          </div>

          {/* Social Media Section */}
          <div className="flex flex-col items-center gap-4">
            <p className="text-center font-['Manrope'] text-[20px] font-medium text-white">
              Follow us on
            </p>
            <div className="flex items-center gap-12">
              <ExternalLink href={TELEGRAM_COMMUNITY_URL} className="!no-underline transition-transform hover:scale-110">
                <TelegramIcon className="h-16 w-16 text-white" />
              </ExternalLink>
              <ExternalLink href={X_URL} className="!no-underline transition-transform hover:scale-110">
                <XIcon className="h-16 w-16 text-white" />
              </ExternalLink>
            </div>
          </div>
        </div>

        {/* Bottom Gradient Glow Effect - More prominent */}
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-[50vh] w-[200%] -translate-x-1/2 bg-gradient-radial from-[#42F1F3]/30 via-[#2BFCFF]/20 to-transparent opacity-60 blur-[60px]"></div>
      </div>
    </AppPageLayout>
    </SEO>
  );
}
