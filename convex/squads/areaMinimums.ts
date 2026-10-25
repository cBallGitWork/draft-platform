import { AREAS, type Area } from "../lineup/pitch";

// A squad against the league's minimum per area (spec/03, Squad make-up; #317). A player who can
// play two areas fills one minimum, whichever helps the squad, so one wing back can't fill both
// defence and midfield. Which help most is a matching: each player to at most one place in an
// area's minimum, as many places filled as can be. Pure: no I/O.

export interface AreaShort {
  area: Area;
  /** How many of the squad fill the area's minimum, with each player counted once. */
  players: number;
  minimum: number;
}

/** Each area whose minimum the squad can't fill, back to front, with each player's areas given. */
export function areasShort(playersAreas: readonly (readonly Area[])[], minimums: Readonly<Record<Area, number>>): AreaShort[] {
  /** One entry for each place in a minimum: its area. */
  const places = AREAS.flatMap((area) => Array.from({ length: minimums[area] }, () => area));
  /** Who fills each place, by index into `playersAreas`; null while no one does. */
  const filledBy: (number | null)[] = places.map(() => null);

  /** Finds the player a place, moving whoever holds a place he could take to another (Kuhn's
   *  augmenting path); true if he now fills one. */
  const placeFor = (player: number, tried: Set<number>): boolean => {
    for (const [index, area] of places.entries()) {
      if (tried.has(index) || !playersAreas[player].includes(area)) continue;
      tried.add(index);
      const holder = filledBy[index];
      if (holder === null || placeFor(holder, tried)) {
        filledBy[index] = player;
        return true;
      }
    }
    return false;
  };
  playersAreas.forEach((_, player) => placeFor(player, new Set()));

  return AREAS.flatMap((area) => {
    const players = places.filter((placeArea, index) => placeArea === area && filledBy[index] !== null).length;
    return players < minimums[area] ? [{ area, players, minimum: minimums[area] }] : [];
  });
}
