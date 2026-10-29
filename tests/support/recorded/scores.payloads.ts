// Ipswich v Nott'm Forest's score and clock as the Premier League served them live on Fri 23 Oct
// 2026, from scripts/record-match.mjs's 383 polls of `/fixtures/128999` (#37), recorded for #49.
// pl-live-scores.json keeps five reads, each with when it was asked, cut to what a score is read
// from: the ids, kickoff, `status`, `phase`, `clock` and each side's id, name and `score`. The
// fixture list's entries (`readPlFixtures`) carry the same fields as this read of the one fixture.
// The match is upcoming in fpl.payloads.ts's first recording (IPSWICH_FOREST, below).

import type { RawPlFixture } from "../../../convex/football/premierLeague/premierLeague";
import live from "./pl-live-scores.json";

/** FPL's code for Ipswich v Nott'm Forest. */
export const IPSWICH_FOREST = 2645271;

/** FPL's code for Spurs v Coventry in gameweek 7, the match fpl.payloads.ts's first recording holds live. */
export const FPL_RECORDED_LIVE = 2645264;

/** Each read kept, by what it was picked for. */
export const LIVE_SCORE = {
  /** 58 minutes before kickoff: status "U", and 0–0, which is no score yet. */
  beforeKickoff: "beforeKickoff",
  /** 13': Forest's goal, 0–1. */
  firstGoal: "firstGoal",
  /** Half-time at 1–1: status still "L", phase "H", the clock stopped at 45+3. */
  halfTime: "halfTime",
  /** The second half under way, its clock restarted at 45'00. */
  secondHalf: "secondHalf",
  /** Full time, status "C", 1–1 at 90+9. */
  fullTime: "fullTime",
} as const;

/** One kept read and when it was asked, a fresh copy. */
export function recordedLiveScore(read: keyof typeof LIVE_SCORE): { readAt: number; fixture: RawPlFixture } {
  const { readAt, fixture } = structuredClone(live[read]);
  return { readAt: Date.parse(readAt), fixture };
}
