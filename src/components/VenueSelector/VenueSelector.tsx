import { Listbox } from "@headlessui/react";
import cx from "classnames";
import { Venue, useVenue } from "context/VenueContext/VenueContextProvider";
import { HlRoutingInfo } from "lib/api/hyperliquid";

import ChevronDownIcon from "img/ic_chevron_down.svg?react";

const VENUE_OPTIONS: { id: Venue; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "gmx", label: "GMX" },
  { id: "hyperliquid", label: "Hyperliquid" },
];

interface Props {
  routing?: HlRoutingInfo | null;
  showRouting?: boolean;
  isOnGmx?: boolean;
  isOnHl?: boolean;
  onUserChange?: () => void;
}

function isVenueAvailable(id: Venue, isOnGmx: boolean, isOnHl: boolean): boolean {
  if (id === "gmx") return isOnGmx;
  if (id === "hyperliquid") return isOnHl;
  // auto: available if at least one venue is
  return isOnGmx || isOnHl;
}

export function VenueSelector({ routing, showRouting, isOnGmx = true, isOnHl = true, onUserChange }: Props) {
  const { venue, setVenue } = useVenue();
  const selected = VENUE_OPTIONS.find((o) => o.id === venue) ?? VENUE_OPTIONS[1];

  return (
    <div className="flex items-center gap-8">
      <span className="text-body-small text-typography-secondary">Venue</span>
      <Listbox value={venue} onChange={(v) => { onUserChange?.(); setVenue(v); }}>
        <div className="relative">
          <Listbox.Button
            className={({ open }) =>
              cx(
                "flex items-center gap-4 rounded-4 border px-8 py-3 text-[12px] font-medium transition-colors",
                open
                  ? "border-blue-300 bg-blue-950 text-blue-300"
                  : "border-slate-600 bg-slate-800 text-typography-primary hover:border-slate-500",
              )
            }
          >
            {selected.label}
            <ChevronDownIcon className="size-12 opacity-60" />
          </Listbox.Button>
          <Listbox.Options className="absolute left-0 top-full z-50 mt-4 min-w-[120px] overflow-hidden rounded-8 border border-slate-600 bg-slate-800 py-4 pl-4 pr-4 !text-left shadow-lg mb-0">
            {VENUE_OPTIONS.map((opt) => {
              const available = isVenueAvailable(opt.id, isOnGmx, isOnHl);
              return (
                <Listbox.Option
                  key={opt.id}
                  value={opt.id}
                  disabled={!available}
                  className={({ active, selected }) =>
                    cx(
                      "py-6 pl-0 pr-12 !text-left text-[12px] font-medium transition-colors",
                      available ? "cursor-pointer" : "cursor-not-allowed opacity-40",
                      available && (active || selected) && "bg-fill-surfaceHover",
                      selected && available ? "text-blue-300" : "text-typography-primary",
                    )
                  }
                >
                  <div className="flex items-center gap-8">
                    <span>{opt.label}</span>
                  </div>
                </Listbox.Option>
              );
            })}
          </Listbox.Options>
        </div>
      </Listbox>
      {showRouting && routing && venue === "auto" && (
        <span className="text-body-small text-blue-300">
          → {routing.recommended.toUpperCase()}
          {routing.savingsPercent > 0 ? (
            <span className="ml-4 text-green-500">{routing.savingsPercent.toFixed(2)}% better</span>
          ) : (
            <span className="ml-4 text-typography-secondary">lower fees</span>
          )}
        </span>
      )}
    </div>
  );
}
