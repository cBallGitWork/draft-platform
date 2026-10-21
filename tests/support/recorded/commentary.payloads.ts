// The Premier League's commentary and team stats, recorded 20 Oct 2026 (#37), for four finished
// matches of different kinds and one not yet played:
// - pl-commentary.json: each match's whole `/fixtures/{id}/textstream/EN` read, every key, keyed by
//   the Premier League's fixture id; Ipswich v Forest's three days before kickoff.
// - pl-commentary-sheets.json: three of the matches' `/fixtures/{id}` reads cut to what the bridge
//   reads (each man's id, name and Opta id). Hull v Everton's sheets are gw6.payloads.ts's, whole.
// - pl-commentary-fpl-players.json: FPL's bootstrap-static on the same day, cut to the 160 men those
//   four matches named, and to the fields `RawBootstrap` types.
// - pl-team-stats.json: `/stats/match/{id}` whole, for Brentford v Liverpool and for Ipswich v Forest.
// For the tests only: it sits outside convex/, so never deploys.

import type { RawBootstrap } from "../../../convex/football/fpl";
import type { RawPlCommentary, RawPlFixture, RawPlTeamStats } from "../../../convex/football/premierLeague";
import { MATCH, recordedPlFixture } from "./gw6.payloads";
import streams from "./pl-commentary.json";
import fplPlayers from "./pl-commentary-fpl-players.json";
import sheets from "./pl-commentary-sheets.json";
import teamStats from "./pl-team-stats.json";

/** Each recorded match by the Premier League's fixture id, and what it was picked for. */
export const COMMENTARY_MATCH = {
  /** 2–2, ten substitutions, a goal VAR ruled out. */
  hullEverton: MATCH.hullEverton.pl,
  /** 1–2, a straight red (upgraded by VAR) and a second yellow, both Brentford's. */
  brentfordLiverpool: 128984,
  /** 5–0, with an own goal. */
  brightonPalace: 128985,
  /** 3–2, a penalty won, conceded and scored, and a goal VAR ruled out. */
  manCityIpswich: 128989,
} as const;

/** Ipswich v Nott'm Forest, Fri 23 Oct 2026 at 20:00 BST: the first live match after recording. */
export const UPCOMING_MATCH = 128999;

/** The four finished matches' fixture ids. */
export const FINISHED_MATCHES = Object.values(COMMENTARY_MATCH);

/** One recorded commentary read, a fresh copy. */
export function recordedCommentary(plId: number): RawPlCommentary {
  return structuredClone(recorded(streams as Record<string, RawPlCommentary>, plId, "commentary"));
}

/** One recorded match's team sheets, a fresh copy. */
export function recordedSheets(plId: number): RawPlFixture {
  if (plId === COMMENTARY_MATCH.hullEverton) return recordedPlFixture(plId);
  const fixture = (sheets as RawPlFixture[]).find((each) => each.id === plId);
  if (fixture === undefined) throw new Error(`no recorded team sheets for Premier League fixture ${plId}`);
  return structuredClone(fixture);
}

/** FPL's players named in the four finished matches, a fresh copy. */
export function recordedFplPlayers(): RawBootstrap["elements"] {
  return structuredClone(fplPlayers);
}

/** One recorded team stats read, a fresh copy. */
export function recordedTeamStats(plId: number): RawPlTeamStats {
  return structuredClone(recorded(teamStats as Record<string, RawPlTeamStats>, plId, "team stats"));
}

function recorded<T>(byFixture: Record<string, T>, plId: number, what: string): T {
  const payload = byFixture[plId];
  if (payload === undefined) throw new Error(`no recorded ${what} for Premier League fixture ${plId}`);
  return payload;
}
