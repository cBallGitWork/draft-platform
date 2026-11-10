import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { delayedAt, heldOf } from "../football/matchCommentary";
import { scoreOf } from "../football/matchScores";
import { playerByCode, unheldPlayerWords } from "../shared/players";
import { readOnce } from "../shared/readOnce";
import type { GameweekTeams } from "../gameweekScorer/gameweekScores";
import type { HeldMatch } from "../gameweekScorer/heldMatches";
import { inMatchOf, scoredByMatch } from "../gameweekScorer/teamGameweek";
import { inTenths } from "../scoring/values";
import { signedWords } from "../shared/numberWords";
import { thresholdStepsOf } from "../stats/thresholdSteps";
import { vidiprinterTeam } from "./instructionLines";
import { shownLine, vidiprinter, type PricedLine, type VidiprinterLine, type VidiprinterMatch, type VidiprinterPlayer } from "./vidiprinter";

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

/** Each man's name and each match's score, each read once however many lines ask. */
export function commentaryReads(ctx: QueryCtx): CommentaryReads {
  return {
    name: readOnce((playerCode: PlayerCode) => playerByCode(ctx, playerCode).then((player) => player?.name ?? unheldPlayerWords(playerCode))),
    score: readOnce((fixtureCode: number) => scoreOf(ctx, fixtureCode)),
  };
}

export interface CommentaryOf {
  /** Only the men whose points count, a starter not subbed off or a sub who came on: so every line
   *  priced moves a head-to-head. Otherwise every man on the lineups, bench included (spec/10). */
  countingOnly: boolean;
  /** Only these matches' lines; every match the men play in when absent. */
  fixtureCodes?: ReadonlySet<number>;
}

/** A line with whom it is about and, for each of the teams in the order asked, what it moves that
 *  team's score by: "+4", or null where it moves none of the men whose points count for it. */
export interface TeamsLine extends VidiprinterLine {
  about: PlayerCode[];
  columns: (string | null)[];
}

/** The lines, newest first, and whether any of the matches' commentary is delayed as at `now`. */
export async function readCommentary(
  ctx: QueryCtx,
  inGameweek: GameweekTeams,
  teamIds: readonly TeamId[],
  now: number,
  reads: CommentaryReads,
  { countingOnly, fixtureCodes }: CommentaryOf,
): Promise<{ lines: TeamsLine[]; delayed: boolean }> {
  const players = new Map<PlayerCode, VidiprinterPlayer>();
  const matches = new Map<number, HeldMatch>();
  const counting: Counting[] = [];
  for (const teamId of teamIds) {
    const scored = await inGameweek.slotsOf(teamId);
    const counts: Counting = new Map();
    counting.push(counts);
    for (const slot of [...scored.team.starters, ...scored.team.bench]) {
      if (countingOnly && !slot.counts) continue;
      const his = scored.matchesOf.get(slot.playerCode) ?? [];
      for (const match of his) if (fixtureCodes === undefined || fixtureCodes.has(match.fixture.code)) matches.set(match.fixture.code, match);
      players.set(slot.playerCode, { name: await reads.name(slot.playerCode), cell: slot.cell, role: slot.role, inLineup: true, inMatch: inMatchOf(slot, his), team: vidiprinterTeam(scored) });
      if (slot.counts) counts.set(slot.playerCode, new Set(scoredByMatch(slot, his).flatMap(({ match, counted }) => (counted ? [match.fixture.code] : []))));
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
  const lines = vidiprinter(read, players, inGameweek.set).map((line) => ({
    ...shownLine(line),
    about: line.priced.about,
    columns: counting.map((counts) => columnOf(line, counts)),
  }));
  return { lines, delayed: held.some(({ row, score }) => row !== null && delayedAt(row, score, now)) };
}

/** Each man whose points count for a team, a starter not subbed off or a sub who came on, and the
 *  matches his points there count from (all but the lower under best match). */
type Counting = Map<PlayerCode, ReadonlySet<number>>;

/** What a line moves a team's score by: only its men whose points count for it, so a bench man's
 *  lines show nothing in his team's column, an auto-sub's every line of the gameweek does once he
 *  comes on, and a column's figures add up to the team's score (Craig, 9 Nov 2026, on #1026). */
function columnOf({ priced: { fixtureCode, moves } }: PricedLine, counts: Counting): string | null {
  const counted = moves.filter(({ playerCode }) => counts.get(playerCode)?.has(fixtureCode) === true);
  if (counted.length === 0) return null;
  return signedWords(inTenths(counted.reduce((total, { points }) => total + points, 0)));
}
