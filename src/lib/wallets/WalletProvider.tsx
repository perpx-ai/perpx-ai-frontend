import { useLingui } from "@lingui/react";
import { darkTheme, lightTheme, RainbowKitProvider, type Theme, type Locale } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import merge from "lodash/merge";
import { useMemo } from "react";
import { WagmiProvider } from "wagmi";

import { useTheme } from "context/ThemeContext/ThemeContext";

import { getRainbowKitConfig } from "./rainbowKitConfig";
import { useAutoReconnectWallet } from "./useAutoReconnectWallet";
import { useEagerConnect } from "./useEagerConnect";
import { usePreventModalClose } from "./usePreventModalClose";

const darkWalletTheme = merge(darkTheme(), {
  colors: {
    modalBackground: "var(--color-slate-800)",
    accentColor: "var(--color-blue-500)",
    menuItemBackground: "var(--color-fill-surfaceHover)",
  },
  radii: {
    modal: "8px",
    menuButton: "8px",
  },
} as Theme);

const lightWalletTheme = merge(lightTheme(), {
  colors: {
    modalBackground: "var(--color-slate-900)",
    accentColor: "var(--color-blue-500)",
    menuItemBackground: "var(--color-fill-surfaceHover)",
  },
  radii: {
    modal: "8px",
    menuButton: "8px",
  },
} as Theme);

// Custom CSS to hide the close button in RainbowKit modal
const hideCloseButtonStyles = `
  /* Hide the close button (X) in RainbowKit connect modal */
  [data-rk] button[aria-label="Close"] {
    display: none !important;
  }

  /* Also hide any close button that might be in the header */
  [data-rk] div[data-rk] > div > div > button:last-child {
    display: none !important;
  }
`;

const queryClient = new QueryClient();

const appLocale2RainbowLocaleMap: Record<string, Locale> = {
  de: "en",
  en: "en",
  es: "es",
  fr: "fr",
  ja: "ja",
  ko: "ko",
  ru: "ru",
  zh: "zh",
  pseudo: "en",
};

export default function WalletProvider({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={getRainbowKitConfig()}>{children}</WagmiProvider>
    </QueryClientProvider>
  );
}

export function RainbowKitProviderWrapper({ children }) {
  const { i18n } = useLingui();
  const { theme } = useTheme();
  const locale = useMemo(() => appLocale2RainbowLocaleMap[i18n.locale] ?? "en", [i18n.locale]);
  const walletTheme = theme === "light" ? lightWalletTheme : darkWalletTheme;

  // Automatically reconnect to previously connected wallet on page load
  useAutoReconnectWallet({
    onReconnected: (address) => {
      console.log("Wallet auto-reconnected:", address);
    },
    onReconnectFailed: (error) => {
      console.debug("Auto-reconnect failed:", error.message);
    },
  });

  // Automatically open wallet connect modal when site loads (if not already connected)
  useEagerConnect({
    autoOpenModal: true,
    delay: 2000, // Wait 2 seconds after page load before opening modal (after auto-reconnect)
    onEagerConnect: () => {
      console.log("Auto-opening wallet connect modal...");
    },
  });

  // Automatically reopen modal if closed without wallet connection
  usePreventModalClose();

  return (
    <>
      {/* Inject custom styles to hide the close button */}
      <style dangerouslySetInnerHTML={{ __html: hideCloseButtonStyles }} />
      <RainbowKitProvider theme={walletTheme} locale={locale} modalSize="compact">
        {children}
      </RainbowKitProvider>
    </>
  );
}
