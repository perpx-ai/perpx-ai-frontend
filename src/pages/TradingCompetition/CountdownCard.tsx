import { Trans, t } from "@lingui/macro";
import { Fragment } from "react";

import { COMPETITION_START_MS } from "./constants";
import { useCountdown } from "./useCountdown";

const GMT_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

/**
 * Live countdown to the competition start.
 *
 * Owns its own ticking clock, so mounting it is what starts the once-a-second
 * re-render — nothing ticks while the card is gated behind registration.
 */
export default function CountdownCard() {
  const countdown = useCountdown(COMPETITION_START_MS);

  const startsAtLabel = new Intl.DateTimeFormat("en-GB", GMT_DATE_FORMAT).format(COMPETITION_START_MS);

  const units = [
    { value: countdown.days, label: t`Days` },
    { value: countdown.hours, label: t`Hrs` },
    { value: countdown.minutes, label: t`Mins` },
    { value: countdown.seconds, label: t`Secs` },
  ];

  return (
    <div
      className="mt-[clamp(24px,4vw,40px)] w-full max-w-[420px] rounded-[clamp(12px,2vw,16px)]
        border border-white/10 bg-[#0C1E2C]/70 p-[clamp(14px,3vw,20px)] backdrop-blur-sm"
    >
      <div className="text-[clamp(10px,2.2vw,11px)] font-semibold uppercase tracking-[0.16em] text-[#7a8a9a]">
        {countdown.hasStarted ? (
          <Trans>The competition is live</Trans>
        ) : (
          <>
            <Trans>Starts in</Trans> <span className="text-[#35B9C0]">(GMT)</span>
          </>
        )}
      </div>

      <div className="mt-[clamp(12px,2.4vw,16px)] flex items-stretch gap-[clamp(4px,1.2vw,10px)]">
        {units.map((unit, index) => (
          <Fragment key={unit.label}>
            {index > 0 && (
              <div
                aria-hidden
                className="flex items-center pb-[clamp(15px,3.2vw,20px)] text-[clamp(18px,4vw,28px)]
                  font-light text-white/25"
              >
                :
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div
                className="rounded-[clamp(8px,1.6vw,12px)] border border-white/10 bg-[#0A1A26]
                  py-[clamp(8px,2vw,14px)] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              >
                <span className="block text-[clamp(24px,6.4vw,40px)] font-bold leading-1 tabular-nums text-white">
                  {String(unit.value).padStart(2, "0")}
                </span>
              </div>
              <div
                className="mt-6 text-center text-[clamp(9px,2vw,11px)] font-medium uppercase
                  tracking-[0.14em] text-[#7a8a9a]"
              >
                {unit.label}
              </div>
            </div>
          </Fragment>
        ))}
      </div>

      <div className="mt-[clamp(12px,2.4vw,16px)] text-[clamp(11px,2.2vw,12px)] text-[#7a8a9a]">
        <Trans>Kicks off {startsAtLabel} GMT</Trans>
      </div>
    </div>
  );
}
