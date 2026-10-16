import { useEffect, useState } from "react";

export type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  hasStarted: boolean;
};

function getCountdown(targetMs: number): Countdown {
  const msLeft = Math.max(0, targetMs - Date.now());
  const totalSeconds = Math.floor(msLeft / 1000);

  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    hasStarted: msLeft === 0,
  };
}

/** Ticks once a second down to `targetMs`, then clamps at zero. */
export function useCountdown(targetMs: number): Countdown {
  const [countdown, setCountdown] = useState(() => getCountdown(targetMs));

  useEffect(() => {
    setCountdown(getCountdown(targetMs));

    const intervalId = setInterval(() => {
      setCountdown(getCountdown(targetMs));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [targetMs]);

  return countdown;
}
