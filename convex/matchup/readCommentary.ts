import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { delayedAt, heldOf } from "../football/matchCommentary";
import type { GameweekTeams } from "../gameweekScorer/gameweekScores";
import type { HeldMatch } from "../gameweekScorer/heldMatches";
import { inMatchOf } from "../gameweekScorer/teamGameweek";
import { thresholdStepsOf } from "../stats/thresholdSteps";
import { vidiprinter, type VidiprinterLine, type VidiprinterMatch, type VidiprinterPlayer } from "./vidiprinter";

// The commentary of the matches some teams' men play in, read and priced for them (vidiprinter.ts):
// the matchup's, for its two lineups (matchup.ts), and league home's matchday Vidiprinter, for every
// lineup's men whose points count, in the matchday's matches (home/leagueHome.ts; spec/12).

type TeamId = Id<"teams">;
type PlayerCode = number;

export interface CommentaryReads {
  /** His name, or the words for one the football sync doesn't hold. */
  name(playerCode: PlayerCode): Promise<string>;
  score(fixtureCode: number): Promise<Doc<"matchScores"> | null>;
}

export interface CommentaryOf {
  /** Only the men whose points count, a starter not subbed off or a sub who came on: so every line
   *  priced moves a head-to-head. Otherwise every man on the lineups, bench included (spec/10). */
  countingOnly: boolean;
  /** Only these matches' lines; every match the men play in when absent. */
  fixtureCodes?: ReadonlySet<number>;
}

/** The lines, newest first, and whether any of the matches' commentary is delayed as at `now`. */
export async function readCommentary(
  ctx: QueryCtx,
  inGameweek: GameweekTeams,
  teamIds: readonly TeamId[],
  now: number,
  reads: CommentaryReads,
  { countingOnly, fixtureCodes }: CommentaryOf,
): Promise<{ lines: VidiprinterLine[]; delayed: boolean }> {
  const players = new Map<PlayerCode, VidiprinterPlayer>();
  const matches = new Map<number, HeldMatch>();
  for (const teamId of teamIds) {
    const scored = await inGameweek.slotsOf(teamId);
    for (const slot of [...scored.team.starters, ...scored.team.bench]) {
      if (countingOnly && !slot.counts) continue;
      const his = scored.matchesOf.get(slot.playerCode) ?? [];
      for (const match of his) if (fixtureCodes === undefined || fixtureCodes.has(match.fixture.code)) matches.set(match.fixture.code, match);
      players.set(slot.playerCode, { name: await reads.name(slot.playerCode), cell: slot.cell, role: slot.role, inLineup: true, inMatch: inMatchOf(slot, his) });
    }
  }
  const held = await Promise.all(
    [...matches.values()].map(async ({ fixture }) => ({
      fixture,
      row: await heldOf(ctx, fixture.code),
      score: await reads.score(fixture.code),
      steps: await thresholdStepsOf(ctx, fixture.code),
    })),
  );
  const read: VidiprinterMatch[] = held.flatMap(({ fixture, row, steps }) =>
    row === null ? [] : [{ fixtureCode: fixture.code, kickoff: fixture.kickoff, lines: row.lines, steps }],
  );
  return { lines: vidiprinter(read, players, inGameweek.set), delayed: held.some(({ row, score }) => row !== null && delayedAt(row, score, now)) };
}
