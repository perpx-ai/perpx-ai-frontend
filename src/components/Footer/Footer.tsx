import cx from "classnames";

import { useSettings } from "context/SettingsContext/SettingsContextProvider";
import { getAppBaseUrl, shouldShowRedirectModal } from "lib/legacy";
import { userAnalytics } from "lib/userAnalytics";
import { LandingPageFooterMenuEvent } from "lib/userAnalytics/types";

import Button from "components/Button/Button";
import { TrackingLink } from "components/TrackingLink/TrackingLink";

import { getFooterLinks, SOCIAL_LINKS } from "./constants";
import { UserFeedbackModal } from "../UserFeedbackModal/UserFeedbackModal";

type Props = {
  showRedirectModal?: (to: string) => void;
  redirectPopupTimestamp?: number;
  isMobileSideNav?: boolean;
};

export default function Footer({ showRedirectModal, redirectPopupTimestamp, isMobileSideNav }: Props) {
  const { feedbackModalVisible, setFeedbackModalVisible } = useSettings();

  return (
    <>
      <div className={cx("flex w-full justify-center", { "flex-col": isMobileSideNav })}>
        {/* Footer links removed */}
      </div>
      <UserFeedbackModal isVisible={feedbackModalVisible} setIsVisible={setFeedbackModalVisible} />
    </>
  );
}
