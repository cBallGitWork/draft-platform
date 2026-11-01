// Stars: which role suits a player (spec/05 Roles; #11; Craig, 26 Oct and 1 Nov 2026). A rating for a
// role ranks him against everyone else who can play its area, on his points per match under that
// role over the last STARS_WINDOW matches he got on the pitch. Pure, so the refresh and the tests
// rate alike; starsRefresh.ts stores what they give. Stars are a hint: they pick the role a player
// starts on when he is dropped into a slot (bestRole.ts), and never price a match.

import { areasOf, cellsOf, LANES, type Area, type Cell } from "../lineup/pitch";
import { rolesOfSlot } from "../lineup/roles";
import type { Position } from "../positions/positionTables";
import { scoreMatch } from "../scoring/scoring";
import type { ScoringSet } from "../scoring/scoringSet";
import { statIn, type MatchStats } from "../scoring/values";
import type { Doc } from "../_generated/dataModel";
import { isWhole, MINUTES_STAT } from "../stats/matchRecords";
import { NO_DATA, UNSURE, type Stars } from "./starsShape";

/** How many of his newest matches he is rated on (spec/05: "the last 38 matches he played"). */
export const STARS_WINDOW = 38;

/** Fewer counted matches than this and he shows "?": we aren't sure yet (spec/05). */
export const LEAST_MATCHES_RATED = 3;

/** The first cut points (Craig, 1 Nov 2026), tunable: each rating, best first, and the share of the
 *  pool that may score more than him for it. Five stars is the top 5%; 4.5 from the 85th
 *  percentile, so fewer than 15% above him; and so on down to 1. */
export const STAR_CUTS: readonly { stars: number; fewerAbove: number }[] = [
  { stars: 5, fewerAbove: 0.05 },
  { stars: 4.5, fewerAbove: 0.15 },
  { stars: 4, fewerAbove: 0.25 },
  { stars: 3.5, fewerAbove: 0.35 },
  { stars: 3, fewerAbove: 0.45 },
  { stars: 2.5, fewerAbove: 0.55 },
  { stars: 2, fewerAbove: 0.65 },
  { stars: 1.5, fewerAbove: 0.75 },
  { stars: 1, fewerAbove: 0.85 },
];

/** Below the last cut: half a star is the lowest (Craig, 1 Nov 2026). */
export const LOWEST_STARS = 0.5;

/** A role to rate in an area, and the cell it is priced in there. */
export interface RatedRole {
  area: Area;
  role: string;
  cell: Cell;
}

/** Every role in every area these positions play (Craig, 1 Nov 2026), each priced in the first
 *  cell of the area, left to right, that offers it. A rule prices by area and position alone, so
 *  any cell offering the role prices it the same. */
export function ratedRoles(positions: readonly Position[]): RatedRole[] {
  const rated: RatedRole[] = [];
  for (const area of areasOf(positions)) {
    for (const cell of cellsOf(area, LANES)) {
      for (const { key } of rolesOfSlot(cell)) {
        if (!rated.some((each) => each.area === area && each.role === key)) rated.push({ area, role: key, cell });
      }
    }
  }
  return rated;
}

/** A match record as the rating reads it: held whole or not, final (locked) or not, and when its
 *  match kicked off. */
export type RatedRecord = Pick<Doc<"playerMatchStats">, "state" | "played" | "arrived" | "stats"> & { kickoff: number };

/** The matches he is rated on (Craig, 1 Nov 2026): each final one he got on the pitch for, cameos
 *  included, his newest STARS_WINDOW, newest first. */
export function countedMatches(records: readonly RatedRecord[]): MatchStats[] {
  return records
    .filter((record) => record.state === "locked" && isWhole(record) && statIn(record.stats, MINUTES_STAT) > 0)
    .toSorted((one, other) => other.kickoff - one.kickoff)
    .slice(0, STARS_WINDOW)
    .map((record) => record.stats);
}

/** His points per match under the role, priced in `cell` under `set`: what he is ranked on. Each
 *  counted match's record is whole, so priced; none to price throws. */
export function perMatchUnder(matches: readonly MatchStats[], set: ScoringSet, cell: Cell, role: string): number {
  if (matches.length === 0) throw new Error("No counted match to price his points per match from");
  const totals = matches.map((stats) => scoreMatch(stats, set, cell, role).total!);
  return totals.reduce((sum, total) => sum + total, 0) / matches.length;
}

/** His stars for one role in one area: "—" with no counted match, "?" with fewer than
 *  LEAST_MATCHES_RATED, else by how much of `pool` scores more per match than his `perMatch`.
 *  `pool` is every rated player's points per match for the role in the area, his own among them. */
export function starsFor(matches: number, perMatch: number, pool: readonly number[]): Stars {
  if (matches === 0) return NO_DATA;
  if (matches < LEAST_MATCHES_RATED) return UNSURE;
  if (pool.length === 0) throw new Error("A rated player's pool holds no one, not even him");
  const above = pool.filter((each) => each > perMatch).length / pool.length;
  return STAR_CUTS.find((cut) => above < cut.fewerAbove)?.stars ?? LOWEST_STARS;
}
