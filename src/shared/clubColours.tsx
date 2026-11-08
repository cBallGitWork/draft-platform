import { createContext, useContext, useMemo, type ReactNode } from "react";
import { coloursFrom, SEEDED_COLOURS, type ColoursOf, type HeldColours } from "../../convex/football/clubColours";

// Each club's colours as the admin holds them (#838; spec/15, The admin), for every shirt and club
// mark on screen. The live app hands down the server's (football/clubKits:all); with none handed
// down, as in the preview and the tests, every club wears its first colours from the file.

const ClubColoursContext = createContext<ColoursOf>(coloursFrom(SEEDED_COLOURS));

/** Hands every screen below the clubs' colours held; while they load, the file's first ones. */
export function ClubColoursProvider({ held, children }: { held: readonly HeldColours[] | undefined; children: ReactNode }) {
  const coloursOf = useMemo(() => coloursFrom(held ?? SEEDED_COLOURS), [held]);
  return <ClubColoursContext.Provider value={coloursOf}>{children}</ClubColoursContext.Provider>;
}

/** A club's colours by its code: white for one with none held, or no club. */
export function useClubColours(): ColoursOf {
  return useContext(ClubColoursContext);
}
