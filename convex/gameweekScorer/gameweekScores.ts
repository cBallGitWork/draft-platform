import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { passedDeadlinesOf } from "../gameweeks/passedDeadlines";
import { isGameweekUsed } from "../gameweeks/usedGameweeks";
import type { StoredScoringSet } from "../scoring/scoringSetShape";
import type { SeasonRules } from "../rules/rulesHistory";
import { logFailure } from "../shared/errors";
import { readOnce } from "../shared/readOnce";
import { heldFixtures, isMatchFinal } from "./heldMatches";
import { squadInputs, type PlayerRows } from "./squadInputs";
import { sameCodes, storedFinalScores, storedScoresIn } from "./storedScores";
import {
  gameweekInputs,
  leagueReads,
  teamInGameweek,
  type GameweekInputs,
  type LeagueReads,
  type TeamInGameweek,
} from "./teamGameweek";

// Each team's points in each gameweek the league has begun (#29; spec/14), each worked out by
// teamGameweek.ts. A gameweek not yet final is worked out on every read: the table's query then
// re-runs whenever a record, a match's state or a lineup changes, so live matches move it minute
// by minute (#28). One final (every match in it locked, so no correction changes it:
// spec/07) is read from finalScores.ts's stored rows, so a season's worth never outgrows one read
// (#418). Little a final gameweek reads changes after: its head-to-heads are stored
// (playedFixtures.ts), the site's set never reaches a gameweek begun (siteScoring.ts), a locked
// match's records no longer change (matchStats.ts) and its lineup is read against the squad at its
// deadline (#415). Its matches can: the stored rows name those they were scored from, and a match
// moved in or out by the football sync reopens the gameweek, to be worked out and stored again.
//
// A gameweek that can't be scored (a site set holding a rule no longer sound, say: #287) is left
// out and named with the reason, logged, rather than blanking or breaking the league's table.

type TeamId = Id<"teams">;

/** A team's points in a gameweek. */
export interface TeamGameweekTotal {
  points: number;
  /** While a record that counts hasn't arrived, or a match it counts isn't locked (spec/07). */
  provisional: boolean;
  /** It held no lineup in a gameweek begun before #637 gave every team one (spec/07), so scored
   *  0 (teamGameweek.ts's TeamInGameweek). */
  noLineup: boolean;
}

/** A gameweek left out of the table, and why. */
interface Unscored {
  gameweek: number;
  reason: string;
}

export type TeamScores = Map<TeamId, TeamGameweekTotal>;

/** Teams' final points worked out here, not read from finalScores: for it to store. */
interface FinalUnstored {
  gameweek: number;
  /** The teams worked out: every team, or only those added since the rest were stored. */
  teamIds: TeamId[];
  /** The gameweek's matches they were scored from, stored with them. */
  fixtureCodes: number[];
  /** Whether the gameweek's stored rows go first: its matches have changed since, or it had none. */
  replace: boolean;
}

interface LeagueScores {
  /** Gameweek to team to points: each gameweek begun and scored. */
  scores: Map<number, TeamScores>;
  unscored: Unscored[];
  finalUnstored: FinalUnstored[];
}

/** The gameweeks the league plays that have begun since it was made, by its recorded deadlines:
 *  the gameweeks it scores. */
export async function begunGameweeks(ctx: QueryCtx, league: Doc<"leagues">): Promise<number[]> {
  const passed = await passedDeadlinesOf(ctx, league._id);
  return [...passed]
    .filter(([gameweek, deadline]) => deadline >= league._creationTime && isGameweekUsed(league, gameweek))
    .map(([gameweek]) => gameweek)
    .sort((one, other) => one - other);
}

/** Every team's points in each gameweek the league has begun, each from the league's scorer. */
export async function leagueScores(
  ctx: QueryCtx,
  league: Doc<"leagues">,
  season: SeasonRules,
  teamIds: readonly TeamId[],
): Promise<LeagueScores> {
  const gameweeks = await begunGameweeks(ctx, league);
  const result: LeagueScores = { scores: new Map(), unscored: [], finalUnstored: [] };
  if (gameweeks.length === 0 || teamIds.length === 0) return result;
  const scoredGameweek = await gameweekScorer(ctx, league, season);
  for (const gameweek of gameweeks) {
    try {
      const { scores, toStore } = await scoredGameweek(gameweek, teamIds);
      result.scores.set(gameweek, scores);
      if (toStore !== null) result.finalUnstored.push({ gameweek, ...toStore });
    } catch (error) {
      const reason = logFailure(`League ${league._id} (${league.name}) can't score gameweek ${gameweek}`, error);
      result.unscored.push({ gameweek, reason });
    }
  }
  return result;
}

/** One gameweek of the league scored (spec/07). */
export interface ScoredGameweek {
  /** Each team's points: its saved total once the gameweek is final, else worked out. */
  scores: TeamScores;
  /** The teams worked out here whose points are final, for finalScores to store; null with none. */
  toStore: Omit<FinalUnstored, "gameweek"> | null;
}

/** Scores one gameweek of the league for the `teamIds`. */
export type GameweekScorer = (gameweek: number, teamIds: readonly TeamId[]) => Promise<ScoredGameweek>;

/** The league's scorer: what any gameweek's scoring reads (the site's sets, the players, the
 *  stored final scores) is read once, however many gameweeks it scores. A gameweek's stored
 *  scores are read while it holds the same matches they were stored from; a team without one (added
 *  since the rest were stored, say) is worked out alone. */
export async function gameweekScorer(ctx: QueryCtx, league: Doc<"leagues">, season: SeasonRules): Promise<GameweekScorer> {
  const stored = await storedFinalScores(ctx, league._id);
  const reads = await leagueReads(ctx, league, season);
  return async (gameweek, teamIds) => {
    const fixtures = await heldFixtures(ctx, gameweek);
    const fixtureCodes = fixtures.map((fixture) => fixture.code);
    const held = stored.get(gameweek);
    const storedScores = held !== undefined && sameCodes(held.fixtureCodes, fixtureCodes) ? held.scores : new Map<TeamId, TeamGameweekTotal>();
    const unstored = teamIds.filter((teamId) => !storedScores.has(teamId));
    const worked = unstored.length === 0 ? null : await gameweekScores(ctx, reads, gameweek, fixtures, unstored);
    const scores = new Map(teamIds.map((teamId) => [teamId, storedScores.get(teamId) ?? worked!.scores.get(teamId)!]));
    const toStore = worked?.final ? { teamIds: unstored, fixtureCodes, replace: storedScores.size === 0 } : null;
    return { scores, toStore };
  };
}

/** A team's points from its gameweek worked out. */
function totalOf(scored: TeamInGameweek): TeamGameweekTotal {
  return { points: scored.team.total, provisional: scored.team.provisional, noLineup: scored.noLineup };
}

/** One gameweek of the league, team by team: for a screen that shows its slots (the matchup, #34,
 *  the match page, #45, a player's card, #381) or a change that re-scores it (an override, #32). */
export interface GameweekTeams {
  /** The site's scoring set in force in the gameweek, checked. */
  set: StoredScoringSet;
  /** The team's gameweek slot by slot, worked out once. */
  slotsOf: (teamId: TeamId) => Promise<TeamInGameweek>;
  /** The team's points: its saved total where one stands, else worked out from its slots. */
  pointsOf: (teamId: TeamId) => Promise<TeamGameweekTotal>;
}

/** The gameweek for the `teamIds` as the table has it: a team's saved total once final, else worked
 *  out. For a screen of one gameweek (the matchup, #34), so the table and it agree. A team's slots
 *  are worked out only when asked for, its points only where none is saved. */
export async function tableGameweek(
  ctx: QueryCtx,
  reads: LeagueReads,
  gameweek: number,
  teamIds: readonly TeamId[],
): Promise<GameweekTeams> {
  const fixtures = await heldFixtures(ctx, gameweek);
  const inputs = await gameweekInputs(ctx, reads, gameweek, fixtures, teamIds);
  return teamsFrom(reads, inputs, await storedScoresIn(ctx, reads.leagueId, gameweek, fixtures));
}

/** The gameweek for the `teamIds` worked out now, any saved total set aside: for a change that
 *  re-scores it (an override, #32), to say what it moved, and for the match page's men (#45), which
 *  hands in the `lineups` it has read already (gameweekInputs). */
export async function workedOutGameweek(
  ctx: QueryCtx,
  reads: LeagueReads,
  gameweek: number,
  teamIds: readonly TeamId[],
  lineups?: GameweekInputs["lineups"],
): Promise<GameweekTeams> {
  const fixtures = await heldFixtures(ctx, gameweek);
  return teamsFrom(reads, await gameweekInputs(ctx, reads, gameweek, fixtures, teamIds, lineups), new Map());
}

/** One team's gameweek worked out from reads the size of its squad (squadInputs.ts), for a
 *  player's card and the Squad tab (#577): his rows are `rowsOf` his code. */
export async function squadGameweek(
  ctx: QueryCtx,
  reads: LeagueReads,
  gameweek: number,
  teamId: TeamId,
  rowsOf: (code: number) => Promise<PlayerRows>,
): Promise<GameweekTeams> {
  const fixtures = await heldFixtures(ctx, gameweek);
  return teamsFrom(reads, await squadInputs(ctx, reads, gameweek, fixtures, teamId, rowsOf), new Map());
}

/** The gameweek team by team from its inputs, each team's `stored` total standing as its points. */
function teamsFrom(reads: LeagueReads, inputs: GameweekInputs, stored: TeamScores): GameweekTeams {
  const slotsOf = readOnce((teamId: TeamId) => teamInGameweek(reads, inputs, teamId));
  return {
    set: inputs.set,
    slotsOf,
    pointsOf: async (teamId) => stored.get(teamId) ?? totalOf(await slotsOf(teamId)),
  };
}

/** The teams' points in one gameweek, from its held fixtures, and whether they are final: the
 *  gameweek holds a match and every match in it is locked, so nothing counted is provisional. One
 *  with no match held (each postponed, say) is never final. */
async function gameweekScores(
  ctx: QueryCtx,
  reads: LeagueReads,
  gameweek: number,
  fixtures: readonly Doc<"fixtures">[],
  teamIds: readonly TeamId[],
): Promise<{ scores: TeamScores; final: boolean }> {
  const inputs = await gameweekInputs(ctx, reads, gameweek, fixtures, teamIds);
  const { pointsOf } = teamsFrom(reads, inputs, new Map());
  const scores = new Map<TeamId, TeamGameweekTotal>();
  for (const teamId of teamIds) scores.set(teamId, await pointsOf(teamId));
  const { matches } = inputs;
  const final = matches.length > 0 && matches.every(isMatchFinal) && [...scores.values()].every((team) => !team.provisional);
  return { scores, final };
}
