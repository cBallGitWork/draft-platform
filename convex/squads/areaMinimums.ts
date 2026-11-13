import { AREAS, areasOf, type Area } from "../lineup/pitch";
import type { Position } from "../positions/positionTables";
import { matched } from "../shared/matching";

// A squad against the league's minimum per area (spec/03, Squad make-up; #317). A player who can
// play two areas fills one minimum, whichever helps the squad, so one wing back can't fill both
// defence and midfield. Which help most is a matching: each player to at most one place in an
// area's minimum, as many places filled as can be. Pure: no I/O.

interface AreaShort {
  area: Area;
  /** How many of the squad fill the area's minimum, with each player counted once. */
  players: number;
  minimum: number;
}

/** The areas whose minimums a player with these positions can fill: those he plays, or, while no
 *  feed has placed him and so he has none, the area the admin set for him; none with no area set
 *  (spec/06 `S06.1`: "admin set that"). */
export function minimumAreas(positions: readonly Position[], unplacedArea: Area | null): Area[] {
  if (positions.length > 0) return areasOf(positions);
  return unplacedArea === null ? [] : [unplacedArea];
}

/** Each area whose minimum the squad can't fill, back to front, with each player's areas given. */
export function areasShort(playersAreas: readonly (readonly Area[])[], minimums: Readonly<Record<Area, number>>): AreaShort[] {
  const filled = minimumsFilled(playersAreas, minimums);
  return AREAS.flatMap((area) => {
    const players = filled.filter((each) => each === area).length;
    return players < minimums[area] ? [{ area, players, minimum: minimums[area] }] : [];
  });
}

/** The area whose minimum each player fills, in `playersAreas`' order, with as many places filled
 *  as can be; null for one who fills none. */
export function minimumsFilled(playersAreas: readonly (readonly Area[])[], minimums: Readonly<Record<Area, number>>): (Area | null)[] {
  /** One entry for each place in a minimum: its area. */
  const places = AREAS.flatMap((area) => Array.from({ length: minimums[area] }, () => area));
  const players = playersAreas.map((_, player) => player);
  /** The places a player could fill, by index into `places`, back to front. */
  const placesFor = (player: number) => places.flatMap((area, index) => (playersAreas[player].includes(area) ? [index] : []));
  const placeOf = matched(players, placesFor, (index) => index);
  return players.map((player) => {
    const index = placeOf.get(player);
    return index === undefined ? null : places[index];
  });
}
