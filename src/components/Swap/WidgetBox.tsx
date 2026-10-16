import { useEffect, useRef, useState } from "react";
import SpinningLoader from "components/Loader/SpinningLoader";
import perpxLogo from "img/perpx-logo-circle.png";
import "./debridge.d.ts";
import "./DebridgeWidget.scss";

export default function DebridgeWidget() {
  const containerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const SCRIPT_ID = "debridge-widget-js";
    let scriptEl = document.getElementById(SCRIPT_ID);

    if (!scriptEl) {
      scriptEl = document.createElement("script");
      scriptEl.id = SCRIPT_ID;
      scriptEl.src = "https://app.debridge.finance/assets/scripts/widget.js";
      scriptEl.async = true;
      document.body.appendChild(scriptEl);
      scriptEl.onload = initWidget;
    } else if (window.deBridge?.widget) {
      initWidget();
    }

    function initWidget() {
      if (!window.deBridge?.widget || !containerRef.current) return;

      deBridge.widget({
        v: "1",
        element: "debridgeWidget",
        title: "",
        description: "",
        width: "600",
        height: "600",
        r: null,
        supportedChains:
          '{"inputChains":{"1":"all","10":"all","56":"all","100":"all","137":"all","146":"all","388":"all","747":"all","998":"all","999":"all","1088":"all","1329":"all","1514":"all","2741":"all","4158":"all","5000":"all","8453":"all","32769":"all","42161":"all","43114":"all","50104":"all","59144":"all","60808":"all","80094":"all","98866":"all","7565164":"all","245022934":"all"},"outputChains":{"1":"all","10":"all","56":"all","100":"all","137":"all","146":"all","388":"all","747":"all","998":"all","999":"all","1088":"all","1329":"all","1514":"all","2741":"all","4158":"all","5000":"all","8453":"all","32769":"all","42161":"all","43114":"all","50104":"all","59144":"all","60808":"all","80094":"all","98866":"all","7565164":"all","245022934":"all"}}',
        inputChain: 56,
        outputChain: 1,
        inputCurrency: "",
        outputCurrency: "",
        address: "",
        showSwapTransfer: true,
        amount: "",
        outputAmount: "",
        isAmountFromNotModifiable: false,
        isAmountToNotModifiable: false,
        lang: "en",
        mode: "deswap",
        isEnableCalldata: false,
        styles: "eyJhcHBCYWNrZ3JvdW5kIjoiIzEyMjUzNSIsImZvcm1Db250cm9sQmciOiIjMWUyODM3IiwicHJpbWFyeSI6IiMzM2FhYjIifQ==",
        theme: "dark",
        isHideLogo: false,
        // The widget renders inside a deBridge-hosted iframe, so the logo needs an absolute URL.
        logo: new URL(perpxLogo, window.location.origin).href,
        disabledWallets: [],
        disabledElements: [],
      });

      // Hide loader after widget is fully themed and initialized
      setTimeout(() => {
        setIsLoading(false);
      }, 2500);
    }

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, []);

  return (
    <div className="mx-auto">
      {isLoading && (
        <div className="flex min-h-[600px] items-center justify-center">
          <SpinningLoader className="size-40" />
        </div>
      )}
      <div
        id="debridgeWidget"
        className="!mx-auto !w-full"
        ref={containerRef}
        style={{
          visibility: isLoading ? "hidden" : "visible",
          height: isLoading ? "0" : "auto",
          overflow: isLoading ? "hidden" : "visible"
        }}
      ></div>
    </div>
  );
}
