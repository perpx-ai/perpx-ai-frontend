import { t } from "@lingui/macro";
import { Link, useLocation } from "react-router-dom";
import cx from "classnames";

import { useSettings } from "context/SettingsContext/SettingsContextProvider";

import { MobileSideNav } from "components/SideNav/MobileSideNav";
import ExternalLink from "components/ExternalLink/ExternalLink";

import { AppHeaderLogo } from "./AppHeaderLogo";
import { AppHeaderUser } from "./AppHeaderUser";
import { STAKING_URL } from "config/perpx";

type Props = {
  leftContent?: React.ReactNode;
};

export function AppHeader({ leftContent }: Props) {
  const { setIsSettingsVisible } = useSettings();
  const { pathname } = useLocation();

  const openSettings = () => {
    setIsSettingsVisible(true);
  };

  const navItems = [
    { label: t`Referrals`, to: "/referrals", external: false },
    { label: t`Trade`, to: "/trade", external: false },
    { label: t`Swap`, to: "/swap", external: false },
    { label: t`Leaderboard`, to: "/leaderboard", external: false },
    { label: t`Trading Competition`, to: "/trading-competition", external: false },
    { label: t`Staking`, to: STAKING_URL, external: true },
    { label: t`Quest Hub`, to: "/arena", external: false },
  ];

  return (
    <header
      data-qa="header"
      className="flex min-h-[68px] w-full items-center justify-between gap-24 border-b border-slate-800 bg-[#1a2332] px-24 py-16"
    >
      <div className="flex items-center gap-40">
        {leftContent ? leftContent : <AppHeaderLogo />}

        <nav className="hidden items-center gap-32 lg:flex">
          {navItems.map((item, index) => {
            const isActive = !item.external && (pathname === item.to || pathname.startsWith(`${item.to}/`));
            const linkClassName = cx(
              "text-[15px] font-normal transition-colors hover:text-white",
              {
                "text-white": isActive,
                "text-slate-400": !isActive,
              }
            );

            if (item.external) {
              return (
                <ExternalLink
                  key={`${item.to}-${index}`}
                  href={item.to}
                  className={`${linkClassName} !no-underline`}
                >
                  {item.label}
                </ExternalLink>
              );
            }

            return (
              <Link
                key={`${item.to}-${index}`}
                to={item.to}
                className={linkClassName}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="shrink-0">
        <AppHeaderUser
          openSettings={openSettings}
          menuToggle={
            <div className="block lg:hidden">
              <MobileSideNav />
            </div>
          }
        />
      </div>
    </header>
  );
}
