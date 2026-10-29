// This season's results so far beside the Premier League's own table for them (#50), recorded
// together at 00:30 UTC on 26 Oct 2026, gameweek 8's matches all played (FPL's
// `finished_provisional`) and every club on 8 played.
// - fpl-season-results.json: FPL's bootstrap-static and fixtures, all 380 matches. Each club cut to
//   the keys `mapFpl` reads and `pulse_id`, the Premier League's team id; each gameweek to its id and
//   deadline; each match to the keys `mapFpl` and the score read take. No players: `recordedResults`
//   lends it the first recording's, as `recordedSeason` does (fpl.payloads.ts).
// - pl-standings.json: the Premier League's `/standings?compSeasons=841&altIds=true&detail=2`, its
//   one table's entries cut to the team's id and name, the position and the overall record.

import type { RawBootstrap } from "../../../convex/football/fpl/fpl";
import { recordedFpl, type FplPayloads } from "./fpl.payloads";
import results from "./fpl-season-results.json";
import standings from "./pl-standings.json";

/** A row of the Premier League's own table. */
export type RecordedStanding = (typeof standings.tables)[number]["entries"][number];

/** A fresh copy of the season's results, with the first recording's players, safe to change. */
export function recordedResults(): FplPayloads {
  const whole = structuredClone(results) as unknown as FplPayloads;
  whole.bootstrap.elements = recordedFpl().bootstrap.elements as RawBootstrap["elements"];
  return whole;
}

/** FPL's season-stable club code for each Premier League team id, from the clubs' `pulse_id`. */
export const clubCodeOfPlTeam = new Map(results.bootstrap.teams.map((team) => [team.pulse_id, team.code]));

/** The Premier League's table at the same moment, top first. */
export const recordedStandings: readonly RecordedStanding[] = standings.tables[0].entries;
