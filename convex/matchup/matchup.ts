import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { heldOf } from "../football/matchCommentary";
import { PLAYING_STATES, scoreOf } from "../football/matchScores";
import { deadlineOf, leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { thisGameweekOf } from "../gameweeks/nextGameweek";
import { seasonRules, type SeasonRules } from "../rules/rulesHistory";
import { logFailure } from "../shared/errors";
import { memberOf, teamIn, teamsOf } from "../shared/leagueAccess";
import { readOnce } from "../shared/readOnce";
import { begunGameweeks, tableGameweek, type GameweekTeams } from "../gameweekScorer/gameweekScores";
import { scheduleOf } from "../table/playedFixtures";
import { isFinished, type HeldMatch } from "../gameweekScorer/heldMatches";
import { inMatchOf, leagueReads, lineupPlayer, type TeamInGameweek } from "../gameweekScorer/teamGameweek";
import { LEAGUE_AVERAGE, type GameweekFixtures } from "../table/roundRobin";
import { teamsInGameweek } from "../table/standings";
import { averageScore, BYE, gamesOf, type Against } from "../table/teamGames";
import type { SlotPoints } from "../scoring/teamPoints";
import { thresholdStepsOf } from "../stats/thresholdSteps";
import { game, matchup, type MatchupCommentary, type MatchupSide, type MatchupSlot, type SlotStatus } from "./matchupShape";
import { vidiprinter, type VidiprinterMatch, type VidiprinterPlayer } from "./vidiprinter";

// One head-to-head in one gameweek (#34; spec/10, The matchup, as a live match; spec/14, On
// screen): both lineups slot by slot, each player's points and whether his match is yet to come,
// on with its minute, or over, the auto-subs, the bench greyed, and the totals, provisional until
// final. Scored by the table's own scorer (gameweekScores.ts), so the matchup and the table never
// disagree.
//
// Lineups show only once the gameweek has begun, at the league's deadline: nothing is secret after
// lock. Who may see another team's lineup before then is Craig's to settle (#392); a manager's own
// is on My team. The commentary is every line of the matches either lineup's men play in, each
// priced for them (vidiprinter.ts, #44).

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
    const { league, team: own } = await memberOf(ctx, leagueId);
    const season = await seasonRules(ctx, leagueId);
    if (season === null) return null;
    if (season.latest.format === "totalPoints") return { kind: "totalPoints" as const };
    const team = teamId === undefined ? own : await teamIn(ctx, leagueId, teamId);
    if (team === undefined) return { kind: "noTeam" as const };

    const schedule = await scheduleOf(ctx, league, season);
    const games = gamesOf(schedule, team._id);
    const deadlineIn = deadlineOf(await leagueDeadlines(ctx, leagueId));
    const gameweek = asked ?? thisGameweekOf(games, deadlineIn, now)?.gameweek ?? null;
    const heading = { kind: "headToHead" as const, teamId: team._id, teamName: team.name, gameweeks: [...new Set(games.map((each) => each.gameweek))] };
    if (gameweek === null) return { ...heading, gameweek, deadline: null, game: { kind: "none" as const } };
    const against = games.find((each) => each.gameweek === gameweek)?.against;
    const drawn = schedule.find((each) => each.gameweek === gameweek);
    return { ...heading, gameweek, deadline: deadlineIn(gameweek), game: await gameOf(ctx, league, season, team, drawn, against) };
  },
});

/** The team's game in the gameweek `drawn`: scored once begun, with both lineups. */
async function gameOf(
  ctx: QueryCtx,
  league: Doc<"leagues">,
  season: SeasonRules,
  team: Doc<"teams">,
  drawn: GameweekFixtures<TeamId> | undefined,
  against: Against<TeamId> | undefined,
): Promise<Game> {
  // A game is one of the gameweek's fixtures or byes, so there is one only where it is drawn.
  if (against === undefined || drawn === undefined) return { kind: "none" };
  const { gameweek } = drawn;
  if (against.kind === BYE) return { kind: BYE };
  const teams = await teamsOf(ctx, league._id);
  const nameOf = (teamId: TeamId) => {
    const named = teams.find((each) => each._id === teamId);
    if (named === undefined) throw new Error(`gameweek ${gameweek}'s fixtures name team ${teamId}, which isn't in the league`);
    return named.name;
  };
  const opponent = against.kind === "team" ? { kind: "team" as const, teamName: nameOf(against.team) } : { kind: LEAGUE_AVERAGE as typeof LEAGUE_AVERAGE };
  if (!(await begunGameweeks(ctx, league)).includes(gameweek)) return { kind: "notBegun", opponent };
  try {
    const teamIds = teams.map((each) => each._id);
    const inGameweek = await tableGameweek(ctx, await leagueReads(ctx, league, season), gameweek, teamIds);
    const scorer = new SideScorer(ctx, inGameweek, teamsInGameweek(drawn), gameweek);
    const sides = against.kind === "team" ? [team._id, against.team] : [team._id];
    return {
      kind: "scored",
      team: await scorer.team(team._id, team.name),
      opponent: await scorer.opponent(against, nameOf),
      commentary: await scorer.commentary(sides, `League ${league._id} (${league.name}) can't read ${team.name}'s commentary in gameweek ${gameweek}`),
    };
  } catch (error) {
    const reason = logFailure(`League ${league._id} (${league.name}) can't score ${team.name}'s matchup in gameweek ${gameweek}`, error);
    return { kind: "unscored", opponent, reason };
  }
}

/** Each side of the matchup, from the table's scorer: each slot worked out, and each total the
 *  table's, its saved final total where the table reads one. A stored total is final, so should the
 *  data behind a slot change after storing (a position corrected, say), the slots may no longer add
 *  up to it; and a gameweek whose slots can't be worked out is unscored here even while the table
 *  shows its stored totals. */
class SideScorer {
  private readonly name = readOnce((playerCode: PlayerCode) => lineupPlayer(this.ctx, playerCode).then((player) => player.name));
  private readonly score = readOnce((fixtureCode: number) => scoreOf(this.ctx, fixtureCode));

  constructor(
    private readonly ctx: QueryCtx,
    private readonly inGameweek: GameweekTeams,
    /** The teams the league's average is over: the gameweek's own (standings.ts's teamsInGameweek). */
    private readonly averaged: readonly TeamId[],
    private readonly gameweek: number,
  ) {}

  async team(teamId: TeamId, teamName: string): Promise<MatchupSide> {
    const scored = await this.inGameweek.slotsOf(teamId);
    const { points, provisional } = await this.inGameweek.pointsOf(teamId);
    const slotOf = (slotPoints: SlotPoints) => this.slot(slotPoints, scored);
    return {
      kind: "team",
      teamId,
      teamName,
      points,
      provisional,
      lineup: { starters: await Promise.all(scored.team.starters.map(slotOf)), bench: await Promise.all(scored.team.bench.map(slotOf)) },
    };
  }

  async opponent(against: Opponent, nameOf: (teamId: TeamId) => string): Promise<MatchupSide> {
    if (against.kind === "team") return this.team(against.team, nameOf(against.team));
    // The average of the gameweek's teams' points, as the table counts it.
    const every = await Promise.all(this.averaged.map((teamId) => this.inGameweek.pointsOf(teamId)));
    const sides = new Map(this.averaged.map((teamId, index) => [teamId, every[index]]));
    return { kind: LEAGUE_AVERAGE, ...averageScore(this.averaged, sides, this.gameweek) };
  }

  /** The commentary of every match the sides' men play in, priced for them. One that can't be read
   *  is logged and says why, while the scores still show. */
  async commentary(teamIds: readonly TeamId[], failure: string): Promise<MatchupCommentary> {
    try {
      const players = new Map<PlayerCode, VidiprinterPlayer>();
      const matches = new Map<number, HeldMatch>();
      for (const teamId of teamIds) {
        const scored = await this.inGameweek.slotsOf(teamId);
        for (const slot of [...scored.team.starters, ...scored.team.bench]) {
          const his = scored.matchesOf.get(slot.playerCode) ?? [];
          for (const match of his) matches.set(match.fixture.code, match);
          players.set(slot.playerCode, { name: await this.name(slot.playerCode), cell: slot.cell, role: slot.role, inMatch: inMatchOf(slot, his) });
        }
      }
      const held = await Promise.all(
        [...matches.values()].map(async ({ fixture }) => ({ fixture, row: await heldOf(this.ctx, fixture.code), steps: await thresholdStepsOf(this.ctx, fixture.code) })),
      );
      const read: VidiprinterMatch[] = held.flatMap(({ fixture, row, steps }) =>
        row === null ? [] : [{ fixtureCode: fixture.code, kickoff: fixture.kickoff, lines: row.lines, steps }],
      );
      return { kind: "read", lines: vidiprinter(read, players, this.inGameweek.set), delayed: held.some(({ row }) => row !== null && row.delayed !== null) };
    } catch (error) {
      return { kind: "unread", reason: logFailure(failure, error) };
    }
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

  /** On while any of his matches is; over once all are (at full time, though his points stay
   *  provisional until the match locks), naming the last to kick off; otherwise yet to play, at
   *  the next kickoff. */
  private async status(matches: readonly HeldMatch[]): Promise<SlotStatus> {
    if (matches.length === 0) return { kind: "noMatch" };
    const states = await Promise.all(matches.map(async (match) => ({ match, score: await this.score(match.fixture.code) })));
    const live = states.find(({ match, score }) => !isFinished(match) && score !== null && PLAYING_STATES.has(score.state));
    if (live !== undefined) {
      const { minutes, clockLabel } = live.score!;
      return { kind: "playing", fixtureCode: live.match.fixture.code, minute: minutes, clockLabel };
    }
    const toCome = states.filter(({ match, score }) => !isFinished(match) && score?.state !== "fullTime").map(({ match }) => match.fixture);
    if (toCome.length === 0) return { kind: "finished", fixtureCode: byKickoff(matches.map(({ fixture }) => fixture)).at(-1)!.code };
    const [next] = byKickoff(toCome);
    return { kind: "yetToPlay", fixtureCode: next.code, kickoff: next.kickoff };
  }
}

/** Matches by kickoff, any with no time yet last. */
const byKickoff = <Fixture extends { kickoff: number | null }>(fixtures: readonly Fixture[]): Fixture[] =>
  fixtures.toSorted((one, other) => (one.kickoff === null ? 1 : 0) - (other.kickoff === null ? 1 : 0) || (one.kickoff ?? 0) - (other.kickoff ?? 0));
