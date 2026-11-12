// The shortlist in the preview (src/app/preview.ts), over Scouting's preview players (../preview.ts):
// adding or taking off a player changes it for the session, so both screens show the change.

import { useSyncExternalStore } from "react";
import type { ListedPlayer } from "../../../convex/scouting/playersList";
import type { ShortlistedPlayer, ShortlistSeam } from "./seam";

/** A shortlist seam over `players`, holding those with `openingCodes` to begin with. */
export function previewShortlistOf(players: readonly ListedPlayer[], openingCodes: readonly number[]): ShortlistSeam {
  const listeners = new Set<() => void>();
  const shortlisted = (code: number): ShortlistedPlayer => {
    const player = players.find((each) => each.code === code)!;
    return { code, name: player.name, fullName: player.fullName, club: player.club, ownerTeamName: player.ownerTeamName, gone: false };
  };
  const sortedPlayers = (codes: Iterable<number>) => [...codes].map(shortlisted).sort((one, other) => one.name.localeCompare(other.name));

  // A new array only when it changes, as useSyncExternalStore needs.
  let codes = new Set(openingCodes);
  let list = sortedPlayers(codes);
  const changeTo = (next: Set<number>) => {
    codes = next;
    list = sortedPlayers(codes);
    for (const listener of listeners) listener();
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };
  const changes = {
    add: async (_leagueId: unknown, playerCode: number) => {
      changeTo(new Set([...codes, playerCode]));
      return null;
    },
    remove: async (_leagueId: unknown, playerCode: number) => {
      changeTo(new Set([...codes].filter((code) => code !== playerCode)));
      return null;
    },
  };
  return {
    useShortlist: () => useSyncExternalStore(subscribe, () => list),
    useShortlistChanges: () => changes,
  };
}
