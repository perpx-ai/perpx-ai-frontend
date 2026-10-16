import { PRODUCTION_PREVIEW_KEY } from "./localStorage";
import staticConfig from "../../public/config.json";

export const UI_VERSION = staticConfig.uiVersion;

export const IS_TOUCH = "ontouchstart" in self;

export const isWebWorker = Boolean(self.WorkerGlobalScope);

export const APP_VERSION = import.meta.env.VITE_APP_VERSION;

export const IS_HOME_SITE = import.meta.env.VITE_IS_HOME_SITE;

/**
 * Debug features, testnets and dev-only routes. On unless VITE_DEV_MODE=false;
 * a production preview (PRODUCTION_PREVIEW_KEY in localStorage) always turns it off.
 */
export function isDevelopment() {
  const isProductionPreview = isWebWorker
    ? // @ts-ignore
      Boolean((self as DedicatedWorkerGlobalScope).PRODUCTION_PREVIEW_KEY)
    : Boolean(localStorage.getItem(PRODUCTION_PREVIEW_KEY));

  return import.meta.env.VITE_DEV_MODE !== "false" && !isProductionPreview;
}

/**
 * Skips upstream hosted services (metrics reporting, share URLs). On unless
 * VITE_LOCAL_MODE=false.
 */
export function isLocal() {
  return import.meta.env.VITE_LOCAL_MODE !== "false";
}
