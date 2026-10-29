// The five team stats spec/10's match page shows (#45; spec/10, The match page), from the Premier
// League's `/stats/match/{id}`: which of Opta's names answers each is mapped in
// docs/pl-commentary.md (Team stats). Pure: `matchTeamStats.ts` reads and stores them.

import type { Infer } from "convex/values";
import type { sideTeamStats } from "../../schema";
import type { RawPlTeamStats } from "./premierLeague";

/** One side's five, as Opta counts them. A red shown for a second yellow is in `redCards`, and that
 *  man's yellows are then out of `yellowCards` (Brentford v Liverpool: three yellows shown, one of
 *  them to the man sent off for a second, and Opta's 2 yellows and 2 reds). */
export type SideTeamStats = Infer<typeof sideTeamStats>;

export interface TeamStats {
  home: SideTeamStats;
  away: SideTeamStats;
}

/** Opta's name for each of the five, docs/pl-commentary.md's table. */
export const OPTA_TEAM_STAT = {
  shots: "total_scoring_att",
  shotsOnTarget: "ontarget_scoring_att",
  possession: "possession_percentage",
  corners: "won_corners",
  yellowCards: "total_yel_card",
  redCards: "total_red_card",
} as const satisfies Record<keyof SideTeamStats, string>;

/** Both sides' five, home and away as the read's own match orders its `teams`; null before
 *  kickoff, when the read has no `data`. Opta leaves noughts out, so a stat a side lacks is
 *  0. A read keyed by a side the match doesn't have, or missing one it has, is a changed payload:
 *  it throws rather than guess which side is which. */
export function plTeamStats(read: RawPlTeamStats): TeamStats | null {
  if (read.data === undefined) return null;
  const { id, teams } = read.entity;
  if (teams?.length !== 2) throw new Error(`PL fixture ${id}'s team stats name no two teams`);
  const [home, away] = teams.map(({ team }) => String(team.id));
  const sides = Object.keys(read.data);
  const strangers = sides.filter((side) => side !== home && side !== away);
  if (strangers.length > 0 || sides.length !== 2) {
    throw new Error(`PL fixture ${id}'s team stats are for teams ${sides.join(", ")}, not ${home} and ${away}`);
  }
  return { home: sideOf(read.data[home].M), away: sideOf(read.data[away].M) };
}

function sideOf(metrics: { name: string; value: number }[]): SideTeamStats {
  const valueOf = new Map(metrics.map(({ name, value }) => [name, value]));
  const count = (name: string) => valueOf.get(name) ?? 0;
  return {
    shots: count(OPTA_TEAM_STAT.shots),
    shotsOnTarget: count(OPTA_TEAM_STAT.shotsOnTarget),
    possession: valueOf.get(OPTA_TEAM_STAT.possession) ?? null,
    corners: count(OPTA_TEAM_STAT.corners),
    yellowCards: count(OPTA_TEAM_STAT.yellowCards),
    redCards: count(OPTA_TEAM_STAT.redCards),
  };
}
