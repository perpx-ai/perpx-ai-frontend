import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Venue = "auto" | "gmx" | "hyperliquid";

const STORAGE_KEY = "perpx_venue";
const VALID_VENUES: Venue[] = ["auto", "gmx", "hyperliquid"];

interface VenueContextValue {
  venue: Venue;
  setVenue: (v: Venue) => void;
}

const VenueContext = createContext<VenueContextValue | undefined>(undefined);

export function useVenue(): VenueContextValue {
  const ctx = useContext(VenueContext);
  if (!ctx) throw new Error("useVenue must be used within VenueContextProvider");
  return ctx;
}

export function VenueContextProvider({ children }: { children: React.ReactNode }) {
  const [venue, setVenueState] = useState<Venue>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Venue | null;
    return stored && VALID_VENUES.includes(stored) ? stored : "gmx";
  });

  const setVenue = useCallback((v: Venue) => {
    setVenueState(v);
    localStorage.setItem(STORAGE_KEY, v);
  }, []);

  return (
    <VenueContext.Provider value={{ venue, setVenue }}>
      {children}
    </VenueContext.Provider>
  );
}
