import { useState } from "react";
import ExternalLink from "components/ExternalLink/ExternalLink";
import TelegramIcon from "img/ic_telegram.svg?react";
import { TELEGRAM_COMMUNITY_URL } from "config/perpx";

const DISMISSED_KEY = "floating-telegram-button-dismissed";

function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function FloatingTelegramButton() {
  const [dismissed, setDismissed] = useState(readDismissed);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // storage unavailable (e.g. private mode) — dismissal lasts until remount
    }
  };

  if (dismissed) return null;

  return (
    <div className="group/tg fixed bottom-32 right-32 z-50">
      <button
        onClick={handleDismiss}
        className="absolute -top-2 -right-2 z-10 flex size-18 items-center justify-center rounded-full bg-[#1e2736] text-gray-400 hover:bg-red-500 hover:text-white opacity-0 scale-75 group-hover/tg:opacity-100 group-hover/tg:scale-100 transition-all duration-200"
        aria-label="Dismiss"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="1" y1="1" x2="7" y2="7" />
          <line x1="7" y1="1" x2="1" y2="7" />
        </svg>
      </button>
      <ExternalLink
        href={TELEGRAM_COMMUNITY_URL}
        className="flex size-64 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-500 shadow-[0_4px_20px_rgba(93,189,183,0.4)] transition-all duration-300 hover:scale-110 hover:shadow-[0_6px_30px_rgba(93,189,183,0.6)] active:scale-95"
        style={{ backgroundColor: '#5dbdb7' }}
      >
        <TelegramIcon className="size-36 text-white" />
      </ExternalLink>
    </div>
  );
}
