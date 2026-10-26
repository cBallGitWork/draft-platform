import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { scoreOf } from "../football/matchScores";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { thisGameweekOf } from "../home/glance";
import { seasonRules, type SeasonRules } from "../rules/rulesHistory";
import { logFailure } from "../shared/errors";
import { memberOf, teamIn, teamOf, teamsOf } from "../shared/leagueAccess";
import { playerByCode } from "../shared/players";
import {
  begunGameweeks,
  gameweekInputs,
  isFinished,
  leagueReads,
  teamInGameweek,
  type HeldMatch,
  type LeagueReads,
  type GameweekInputs,
  type TeamInGameweek,
} from "../table/gameweekScores";
import { scheduleOf } from "../table/playedFixtures";
import { LEAGUE_AVERAGE } from "../table/roundRobin";
import { averageOf } from "../table/standings";
import { BYE, gamesOf, type Against } from "../table/teamGames";
import type { SlotPoints } from "../scoring/teamPoints";
import { game, matchup, type MatchupSide, type MatchupSlot, type SlotStatus } from "./matchupShape";

// One head-to-head in one gameweek (#34; spec/10, The matchup, as a live match; spec/14, On
// screen): both lineups slot by slot, each player's points and whether his match is yet to come,
// on with its minute, or over, the auto-subs, the bench greyed, and the totals, provisional until
// final. Scored by gameweekScores.ts's own functions, so the matchup and the table never disagree.
//
// Lineups show only once the gameweek has begun, at the league's deadline: nothing is secret after
// lock. Who may see another team's lineup before then is Craig's to settle (#392); a manager's own
// is on My team. The commentary is #46.

type TeamId = Id<"teams">;
type PlayerCode = number;
type Game = Infer<typeof game>;
type Opponent = Exclude<Against<TeamId>, { kind: typeof BYE }>;

/** One team's head-to-head in a gameweek, or null for a league made before rules were held (#25).
 *  The team is the caller's own unless one is named; the gameweek is the latest begun, or before
 *  any, the first, unless one is named. `now` is the screen's: a query may not read the clock. */
export const ofTeam = query({
  args: { leagueId: v.id("leagues"), now: v.number(), teamId: v.optional(v.id("teams")), gameweek: v.optional(v.number()) },
  returns: v.union(matchup, v.null()),
  handler: async (ctx, { leagueId, now, teamId, gameweek: asked }) => {
    const { email, league } = await memberOf(ctx, leagueId);
    const season = await seasonRules(ctx, leagueId);
    if (season === null) return null;
    if (season.latest.format === "totalPoints") return { kind: "totalPoints" as const };
    const team = teamId === undefined ? await teamOf(ctx, leagueId, email) : await teamIn(ctx, leagueId, teamId);
    if (team === undefined) return { kind: "noTeam" as const };

    const games = gamesOf(await scheduleOf(ctx, league, season), team._id);
    const deadlines = await leagueDeadlines(ctx, leagueId);
    const gameweek = asked ?? thisGameweekOf(games, (each) => deadlines.get(each) ?? null, now)?.gameweek ?? null;
    const shown = { kind: "headToHead" as const, teamId: team._id, teamName: team.name, gameweeks: [...new Set(games.map((each) => each.gameweek))] };
    if (gameweek === null) return { ...shown, gameweek, deadline: null, game: { kind: "none" as const } };
    const against = games.find((each) => each.gameweek === gameweek)?.against;
    return { ...shown, gameweek, deadline: deadlines.get(gameweek) ?? null, game: await gameOf(ctx, league, season, team, gameweek, against) };
  },
});

/** The team's game in the gameweek: scored once begun, with both lineups. */
async function gameOf(
  ctx: QueryCtx,
  league: Doc<"leagues">,
  season: SeasonRules,
  team: Doc<"teams">,
  gameweek: number,
  against: Against<TeamId> | undefined,
): Promise<Game> {
  if (against === undefined) return { kind: "none" };
  if (against.kind === BYE) return { kind: BYE };
  const teams = await teamsOf(ctx, league._id);
  const nameOf = (teamId: TeamId) => teams.find((each) => each._id === teamId)!.name;
  const opponent = against.kind === "team" ? { kind: "team" as const, teamName: nameOf(against.team) } : { kind: LEAGUE_AVERAGE as typeof LEAGUE_AVERAGE };
  if (!(await begunGameweeks(ctx, league)).includes(gameweek)) return { kind: "notBegun", opponent };
  try {
    const reads = await leagueReads(ctx, league, season, teams.map((each) => each._id));
    const inputs = await gameweekInputs(ctx, reads, gameweek);
    const scorer = new SideScorer(ctx, reads, inputs);
    return { kind: "scored", team: await scorer.team(team._id, team.name), opponent: await scorer.opponent(against, nameOf) };
  } catch (error) {
    const reason = logFailure(`League ${league._id} (${league.name}) can't score ${team.name}'s matchup in gameweek ${gameweek}`, error);
    return { kind: "unscored", opponent, reason };
  }
}

/** Each side of the matchup, from gameweekScores.ts's own scoring. */
class SideScorer {
  private readonly names = new Map<PlayerCode, Promise<string>>();
  private readonly scores = new Map<number, Promise<Doc<"matchScores"> | null>>();

  constructor(
    private readonly ctx: QueryCtx,
    private readonly reads: LeagueReads,
    private readonly inputs: GameweekInputs,
  ) {}

  async team(teamId: TeamId, teamName: string): Promise<MatchupSide> {
    const scored = await teamInGameweek(this.ctx, this.reads, this.inputs, teamId);
    if (scored === null) return { kind: "team", teamId, teamName, points: 0, provisional: false, lineup: null };
    const slotOf = (slotPoints: SlotPoints) => this.slot(slotPoints, scored);
    return {
      kind: "team",
      teamId,
      teamName,
      points: scored.team.total,
      provisional: scored.team.provisional,
      lineup: { starters: await Promise.all(scored.team.starters.map(slotOf)), bench: await Promise.all(scored.team.bench.map(slotOf)) },
    };
  }

  async opponent(against: Opponent, nameOf: (teamId: TeamId) => string): Promise<MatchupSide> {
    if (against.kind === "team") return this.team(against.team, nameOf(against.team));
    // The average of every team's points, a team with no lineup on 0, as the table counts it.
    const every = await Promise.all(this.reads.teamIds.map((teamId) => teamInGameweek(this.ctx, this.reads, this.inputs, teamId)));
    const points = new Map(this.reads.teamIds.map((teamId, index) => [teamId, every[index]?.team.total ?? 0]));
    return {
      kind: LEAGUE_AVERAGE,
      points: averageOf(this.reads.teamIds, points, this.inputs.gameweek),
      provisional: every.some((each) => each?.team.provisional === true),
    };
  }

  private async slot(slotPoints: SlotPoints, { autoSubs, matchesOf }: TeamInGameweek): Promise<MatchupSlot> {
    const { playerCode, cell, points, counts, provisional } = slotPoints;
    const wentOff = autoSubs.substitutions.find((each) => each.off === playerCode);
    const cameOn = autoSubs.substitutions.find((each) => each.on === playerCode);
    const autoSub =
      wentOff !== undefined
        ? { kind: "off" as const, playerName: await this.name(wentOff.on) }
        : cameOn !== undefined
          ? { kind: "on" as const, playerName: await this.name(cameOn.off) }
          : autoSubs.unfilled.includes(playerCode)
            ? { kind: "unreplaced" as const }
            : null;
    return {
      playerCode,
      name: await this.name(playerCode),
      area: cell.area,
      points,
      counts,
      provisional,
      status: await this.status(matchesOf.get(playerCode) ?? []),
      autoSub,
    };
  }

  /** A player in a lineup the football sync doesn't hold is data gone wrong: scoring threw already. */
  private name(playerCode: PlayerCode): Promise<string> {
    let name = this.names.get(playerCode);
    if (name === undefined) {
      name = playerByCode(this.ctx, playerCode).then((player) => player!.name);
      this.names.set(playerCode, name);
    }
    return name;
  }

  private score(fixtureCode: number) {
    let score = this.scores.get(fixtureCode);
    if (score === undefined) {
      score = scoreOf(this.ctx, fixtureCode);
      this.scores.set(fixtureCode, score);
    }
    return score;
  }

  /** On while any of his matches is; over once all are; otherwise yet to play, at the next kickoff. */
  private async status(matches: readonly HeldMatch[]): Promise<SlotStatus> {
    if (matches.length === 0) return { kind: "noMatch" };
    const states = await Promise.all(matches.map(async (match) => ({ match, score: await this.score(match.fixture.code) })));
    const live = states.find(({ match, score }) => !isFinished(match) && (score?.state === "live" || score?.state === "halfTime"));
    if (live !== undefined) return { kind: "playing", minute: live.score!.minutes };
    const toCome = states.filter(({ match, score }) => !isFinished(match) && score?.state !== "fullTime");
    if (toCome.length === 0) return { kind: "finished" };
    const kickoffs = toCome.map(({ match }) => match.fixture.kickoff).filter((kickoff) => kickoff !== null);
    return { kind: "yetToPlay", kickoff: kickoffs.length === 0 ? null : Math.min(...kickoffs) };
  }
}
