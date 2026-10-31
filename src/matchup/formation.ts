// A side's formation on the matchup (spec/10, The matchup, as a live match: "the formation"), read
// from where its men stand, since a lineup placed cell by cell has no preset name and the server
// sends none (convex/matchup/matchup.ts). It is the shape on the pitch now: a sub who came on in his
// own area changes it (spec/05, Auto-subs).

import { AREAS, type Area } from "../../convex/lineup/pitch";
import type { MatchupSide } from "../../convex/matchup/matchupShape";

type Lineup = Extract<MatchupSide, { kind: "team" }>["lineup"];

/** Every formation leaves the keeper out: there is always one. */
const KEEPER: Area = "goalkeeper";
const OUTFIELD = AREAS.filter((area) => area !== KEEPER);

/** How many stand in each outfield area, back to front, empty areas left out: [4, 2, 3, 1]. Those
 *  standing are each starter still on and each sub who has come on; a starter subbed off, or one
 *  whom no one could replace, leaves his slot empty. */
export function formationOf({ starters, bench }: Lineup): number[] {
  const standing = [...starters.filter((starter) => starter.autoSub === null), ...bench.filter((slot) => slot.autoSub?.kind === "on")];
  return OUTFIELD.map((area) => standing.filter((slot) => slot.area === area).length).filter((count) => count > 0);
}
