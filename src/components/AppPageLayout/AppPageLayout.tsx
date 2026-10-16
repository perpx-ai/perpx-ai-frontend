import cx from "classnames";

import { AppHeader } from "components/AppHeader/AppHeader";
import Footer from "components/Footer/Footer";
import SideNav from "components/SideNav/SideNav";
import { FloatingTelegramButton } from "components/FloatingTelegramButton/FloatingTelegramButton";

export default function AppPageLayout({
  children,
  header,
  className,
  sideNav,
  contentClassName,
  pageWrapperClassName,
  footer,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
  sideNav?: React.ReactNode;
  contentClassName?: string;
  pageWrapperClassName?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className={cx("flex h-full w-full flex-col", className)}>
      <div className="sticky top-0 z-40 w-full">{header ? header : <AppHeader />}</div>
      <div
        className={cx("flex h-full grow flex-col overflow-y-auto scrollbar-gutter-stable", pageWrapperClassName)}
      >
        <div className="flex h-full grow flex-col items-center">
          <div className={cx("flex w-full max-w-[1512px] grow flex-col gap-8 py-8 px-8", contentClassName)}>
            {children}
          </div>
          <div className="mt-auto hidden w-full pt-8 lg:block">{footer ? footer : <Footer />}</div>
        </div>
      </div>
      <FloatingTelegramButton />
    </div>
  );
}
