import { t } from "@lingui/macro";
import cx from "classnames";
import { ReactNode, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";

import { useLocalStorageSerializeKey } from "lib/localStorage";

import ExternalLink from "components/ExternalLink/ExternalLink";

import CollapseIcon from "img/collapse.svg?react";
import LeaderboardIcon from "img/leaderboard.svg?react";
import ReferralsIcon from "img/referrals.svg?react";
import TradeIcon from "img/trade.svg?react";
import { STAKING_URL } from "config/perpx";

function SideNav({ className }: { className?: string }) {
  const [isCollapsed, setIsCollapsed] = useLocalStorageSerializeKey("is-side-nav-collapsed", false);

  const handleCollapseToggle = useCallback(() => {
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed, setIsCollapsed]);

  return (
    <nav
      className={cx("flex h-full shrink-0 flex-col bg-slate-950", className, {
        "w-[172px] max-xl:w-[144px]": !isCollapsed,
      })}
    >
      <div className={cx("flex w-full", { "justify-center": isCollapsed })}>
        <LogoSection isCollapsed={isCollapsed} />
      </div>

      <div className="flex flex-1 flex-col justify-between">
        <MenuSection isCollapsed={isCollapsed} />

        <ul className="flex list-none flex-col px-0">
          <NavItem
            icon={<CollapseIcon />}
            label={isCollapsed ? t`Expand` : t`Collapse`}
            isCollapsed={isCollapsed}
            onClick={handleCollapseToggle}
          />
        </ul>
      </div>
    </nav>
  );
}

export function LogoSection({ isCollapsed }: { isCollapsed: boolean | undefined }) {
  return (
    <Link
      to="/"
      className={cx("flex cursor-pointer items-center justify-center gap-5 pb-16 pt-10 text-typography-primary", {
        "pl-12 pr-20": !isCollapsed,
      })}
    >
      <img src={"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAL8AAAAwCAYAAABADKsLAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAp+SURBVHgB7V1NcuPGFX4NSimXZsOcYDAnGI0zSrwzuIjlycbSCYY6geQTiDqBNCcQdQJpFoms2QDcTVmTiDmBkBOYqXISJxLZeQ9oSCD4GmiAIEh5+qtCkeg/NBuvX7+/bgJYWHymEOmbLy/9bssRh0WVpIC2kNBm0keYHoKE4WQi3//1T50LsLBYUUwR/9aH4AYJdxPqQzieyKO/ven0wcJixTBF/K8vfU84wk8lDaWUZxMJo6KGHABX4IqALeLkEV9PZUro3/1Hfj/c7RS2Y2HRFEQ24Q8/+AcTIY7V7ehuIl8N33RCKIGvLn13DEAT6VDipFDJIbbVKduWhcWiILjErQ/+CQrw++o2vPs3ToAKXHvT99vrd9BLtTXEtjp2BbBYBThc4vU3nQOcFoG6ddefPawEpTDsdEbUlgB5pJI21zacQoXawqIJOLqMu3W5i8tCGN1I6L6+GlQm2h+3Oz0Q8h19x4lwsIliEVhYLBla4ieu7aCMnkwAJNrePBPgbh3FH4U1gC5YWCwZTl7mR1RO65oANJkSUQoV4e/AwmLJcIoKaCbAcSXRZSz/ob65sGCgibYry+MnvHy8DvBywYIFjk1fM37dEm3o3s8pNARhWpDMlxP0AaRNlxJE/34yOdOZLyOT5wTaYwc2Iz+AI96Cqi/R+SXREzz+LwSLsP6oFzHvQPaEEEdgMQUcW/Lu3+KV9fKHeL3CMSt8n9gG1XczySNVP4QGYEz8hNh0Kc5RAfYyWegMix1h6OhyVZoLpiAnmJRHdfoAaiJ+whCvjskL/ZyA49vDD04EPsKx6hXUPcCP4yp160Qp4k/w+yu/h1x/LpMlDsD7eKKIlw9pIHqftr+uhdPWSPyEE3wp34PFFHK49wsds1DipM/UC7HOC2gQlYifEIk0DvRnQhniVkco1vwTvw1JVxijeNNqEQcVpyp2aHi97b1KtdPDvLeqdi2OsBziH2iquHg9Bz2I+wdg8QAcYw9iQs5Cy8GxDnH8AyZrD+v0oUFUJv4E3rnf/vmLOBhOtGDUGsPoIyO+kIK87ohb9dT+9TfeXjqf4oocR5wqnWLuCaAh/lzuorgSvZwdJruPdffAYgpkIMAPL5PMyu5qfG+ZZpYytnMTvym2Lv0+xAovKbudT286QbZMtAq0BEWWtlGHCD5963WgIqoQf6ou+0Kx7m/BYgqKoG9gVvm9wPHazZTt48dbppkXTSm5aRSaOutAZBZ1YvEICX/AET6BVgwhlSdYgEerASwH75i0trJy5ILKkDigTHl07SjxYKWg+rmT6acLJaGIlhuvqd+t2uYI/2gZhN8YXv8Q+FtXgaTrKwP/wNaH4CcqS/WgIjR25FvDuq7GBu3m1PGUj0AH8iGcSgMCk7Gf4TZzHaSec87lpeqfMPV3VB4RfT+nnzeyhL0+1eYt05afKuMz+VSnkKEsCgvl/JuoD7y+Cs6Ji9M92fY/Gpgz09yf2oDmYfxM9eLPIVb8vII2u3jdZIlVU9bNXG1FwPScnWyeYX36JBHlbc6zSX87VcTqggGUZYez0nlqsnaBH5ujZZqQF0L8MdEPDteeiVuhlEcifBR3eib15T1cJN9bG7kEtSiwu9kYBY6ILCFGU1CdY6xb1lRMISGVomtT9TkTow4eXuemnFlZagImixgD1++waetOFmvpG5LNHfrRAtqONOd+CfDHPI+sNejRFTRoEiKzp7iXe9cl9vPebUC4/r/4u5yU78c8UNyOI8whk3YCUHnbZw+fNShhPp13e2mZCZp+Jo2FqY+DuL+XSdO9v8rGjLowRfzrrch7Gw9yRTtQVC0hehRfNv4FJ0FJkyUFwaHMH313GogDIiii9yB+2S5TZJAp3wVefKByPSAfBy7pBe2SNaqKY4eeEUIScs5zXB3oXZBY2U9WMhkrpl3gfw/pH+9NJimVkbHIul9QtL8KSu4U8acIP3FSsUBZPGQzJhBKgRwSnVo6i05pGOwfLoFIkYXyoD6cZNI4Qpkx76mXTApmALNiB/XHK8H9Q4idbSFUQ8jVV88nwqXVjRNRaNUIwAw9iMdGx/F1+kHjWOMS5Vj+HYnXgyWBYohAiT0TUSvxV8WUOU7JwR5TTiseUH3FFbPERYQSgBk6c3LM3PqYd6JWqiznpj4WKekJ2pBvMCjKbwws8eMgGJkEFwXnF+Q0ShV3QLPKNAci/CzX5+Rv4ppugYUkZNI8MMNgTsI3rd+DWeKPLEWG9Y8Ny6yWzP8IvcjTBFot9ATHwsmoNvGpPCLZXSOSbGrSqvglXMNy8zKkwKSQ0lNo30U2zsmFAkak9CATxdorKe4tBLzYI5cnavzuyt95CJkWYGwhKoFBTh797hBi2T3IKVfrsl2Cq86DsERZmmjPoTx0VrLE75AG+RKMYv8XhTVYIcSm1seTIlpjWbdiRLZlDyxqh/JbuEzWrkrProqURnpED5YEnviXwPlV1OejNQSVw4+re8AVNz7E4d5Dfe3VjTKrVamVTek5nEKcmDRJ2T+DWQvZPoVaLMvsyRJ/kxYW8gavbTj7INDlrxxrtAfgx287ptaFZSBk0kZN7kKqgJcmhZQli9Np8miiB/yEOcqU+S5Tjr7TirGUUPHKYk9egBrt25WOnntMkLu30KcgHfEyjvuRoBTciPBpwzysNjhvr2ciu1PQGcQ7w3LLLQAUZXlk8FxOYaWJzf3mvGjNd+lnpUy9Wb2AAhDPlqH8ssRv4lW9FxBQOANoGshzELfUZ7YMTpiLZz/LvWDFjzNULzKAWTMlxcJ0crbw0YsnM2K03EOz4bxtg/4Rx+dMlXlGAs7CFcKsUxBU2j7MrhI0LgE0jMqBbVrCrwQ5iDa4/NHbXXXCT+GMSSPiuZGZ+H0V+UlE1Usld/G6lc3G+if9m+Luqn9EgETI3IrNEXJi2nSZrHfcpFaTjov99wwiXWuHzsllTNgUrSmqxN9QCAVyiDUJFyus2GpBEYn4wmi59zJZLl4+5tGLHqXSOPSXsNy7EK8AJv0jsH3MCQAMGadgGpT3cIRNCodK+W2M+U0TPym6tIWwBDGbhin/SkGKmi5MuMiNH0KzMS6h+nTVZ1H/kjq6PnIEDFDwm5QTjcqcZrKoL42aPrNiT6TUkBK69Wd/U1cpir2xSILWSDkPoRxonOeN0ykLEtPI5m7KWUPQ9FFx/R5XxyRGPyf2/9B0A00dmCL+idpBFWFNnOt2UX3xy2oEJq0CiDjUpnhaBcKC4lFEI5Z/JZZg21YWGzoyJswplkRd5vWxp0kvc7aRboU4hYYwY5SZ+WMK5t9U4rN24uC3621PgMUDlMXEg2mRgghq2JR8L/lTEqbO0tH0kyZHID6T0+lmFF76M4mtK+L48bma5HX98tK3fypnCMVdh7DieCr9XCT4f2bZ7nSRNySmPLfliNP00eT3De2usrBYJLR2fpoAaPW5SO6jo8n/4jdui7WwWBRynVz3v5F7IB6XRtESx0s8SMrColbkEj9tJL9bl52pCeCIc7zmOULDwmIlUBjewEwAXdSfhcWTglFsD7cCWFg8dVT5Zxb/4YgTsHZ+i6eLUlGdjysAeoKjDS9yABYWTxT/ByfA+yTiYdBzAAAAAElFTkSuQmCC"} alt="PerpX Logo" className={cx({ "h-24": !isCollapsed, "h-20": isCollapsed })} />
    </Link>
  );
}

export interface NavItemProps {
  icon: ReactNode;
  label: ReactNode;
  isActive?: boolean;
  isCollapsed: boolean | undefined;
  onClick?: () => void;
  to?: string;
  external?: boolean;
}

export function NavItem({ icon, label, isActive = false, isCollapsed = false, onClick, to, external }: NavItemProps) {
  const button = (
    <button className={cx("group cursor-pointer select-none py-1", { "w-full": !isCollapsed })} onClick={onClick}>
      <div
        className={cx(
          `relative flex cursor-pointer items-center gap-8
          rounded-8 px-12 py-10 text-typography-secondary group-hover:bg-blue-400/20 group-hover:text-blue-400
          dark:group-hover:bg-slate-700 dark:group-hover:text-typography-primary`,
          {
            "bg-blue-400/20 !text-blue-400 dark:bg-slate-700 dark:!text-typography-primary": isActive,
            "w-full": !isCollapsed,
          }
        )}
      >
        <div className="flex size-24 shrink-0 items-center justify-center [&>svg]:w-full">{icon}</div>
        <span className={cx("text-body-medium font-medium tracking-[-1.2%]", { hidden: isCollapsed })}>{label}</span>

        <div
          className={cx(
            `absolute left-0 top-0 z-30 hidden items-center gap-8 rounded-8
            bg-slate-800 text-blue-400 dark:text-typography-primary`,
            { "group-hover:flex": isCollapsed }
          )}
        >
          <div className="flex items-center gap-8 rounded-8 bg-blue-400/20 px-12 py-10 dark:bg-slate-700">
            <div className="flex size-24 shrink-0 items-center justify-center">{icon}</div>
            <span className={cx("text-body-medium font-medium tracking-[-1.2%]")}>{label}</span>
          </div>
        </div>
      </div>
    </button>
  );

  const content = to ? (
    external ? (
      <ExternalLink className="w-full !no-underline" href={to}>
        {button}
      </ExternalLink>
    ) : (
      <Link to={to}>{button}</Link>
    )
  ) : (
    button
  );

  return <li className="p-0 first:-mt-4">{content}</li>;
}

export function MenuSection({
  isCollapsed,
  onMenuItemClick,
}: {
  isCollapsed: boolean | undefined;
  onMenuItemClick?: () => void;
}) {
  const mainNavItems = [
    { icon: <ReferralsIcon className="size-24" />, label: t`Referrals`, key: "referrals", to: "/referrals", external: false },
    { icon: <TradeIcon className="size-24" />, label: t`Trade`, key: "trade", to: "/trade", external: false },
    { icon: <TradeIcon className="size-24" />, label: t`Swap`, key: "swap", to: "/swap", external: false },
    { icon: <LeaderboardIcon className="size-24" />, label: t`Leaderboard`, key: "leaderboard", to: "/leaderboard", external: false },
    { icon: <LeaderboardIcon className="size-24" />, label: t`Trading Competition`, key: "trading-competition", to: "/trading-competition", external: false },
    { icon: <TradeIcon className="size-24" />, label: t`Staking`, key: "staking", to: `${STAKING_URL}/staking`, external: true },
    { icon: <LeaderboardIcon className="size-24" />, label: t`Quest Hub`, key: "arena", to: "/arena", external: false },
  ];

  const { pathname } = useLocation();

  return (
    <ul className="flex list-none flex-col px-0">
      {mainNavItems.map((item) => (
        <NavItem
          key={item.key}
          icon={item.icon}
          label={item.label}
          isActive={!item.external && (pathname === item.to || pathname.startsWith(`${item.to}/`))}
          isCollapsed={isCollapsed}
          to={item.to}
          external={item.external}
          onClick={onMenuItemClick}
        />
      ))}
    </ul>
  );
}

export default SideNav;
