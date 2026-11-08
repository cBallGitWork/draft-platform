import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { isPlaying } from "../football/matchScores";
import { deadlineOf, leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { thisGameweekOf } from "../gameweeks/nextGameweek";
import { seasonRules, type SeasonRules } from "../rules/rulesHistory";
import { logFailure } from "../shared/errors";
import { memberOf, teamIn, teamsOf } from "../shared/leagueAccess";
import { begunGameweeks, tableGameweek, type GameweekTeams } from "../gameweekScorer/gameweekScores";
import { scheduleOf } from "../table/playedFixtures";
import { isFinished, overrideOf, type HeldMatch } from "../gameweekScorer/heldMatches";
import { leagueReads, scoredByMatch, type TeamInGameweek } from "../gameweekScorer/teamGameweek";
import { LEAGUE_AVERAGE, type GameweekFixtures } from "../table/roundRobin";
import { teamsInGameweek } from "../table/standings";
import { averageScore, BYE, gamesOf, type Against } from "../table/teamGames";
import type { SlotPoints } from "../scoring/teamPoints";
import { namedCategoriesOf, roleLineOf } from "../scoring/breakdownShape";
import { siteVersionByGameweek } from "../scoring/siteVersions";
import { positionOfSlot } from "../lineup/pitch";
import { namedRole, roleIn, type Role } from "../lineup/roles";
import { game, matchup, type MatchBreakdown, type MatchupCommentary, type MatchupBenchSlot, type MatchupPlace, type MatchupSide, type MatchupSlot, type MatchupStarter, type SlotStatus } from "./matchupShape";
import { commentaryReads, readCommentary, type CommentaryReads } from "./readCommentary";

// One head-to-head in one gameweek (#34; spec/10, The matchup, as a live match; spec/14, On
// screen): both lineups slot by slot, each player's points and whether his match is yet to come,
// on with its minute, or over, the auto-subs, the bench greyed, and the totals, provisional until
// final. Scored by the table's own scorer (gameweekScores.ts), so the matchup and the table never
// disagree.
//
// Lineups show only once the gameweek has begun, at the league's deadline: then both sides'
// starters, each in his role, the bench in order, each sub who came on in his, and the formation:
// the preset the lineup stands in, until its manager edits it off one (spec/10; #878), when it is
// null, as what such a shape is called waits on Craig.
// Before it nobody sees another team's lineup, the commissioner and the admin included:
// "they just get to view what the managers see" (Craig, 31 Oct 2026; #392, #799). A manager's own
// is on My team. The commentary is every line of the matches either lineup's men play in, each
// priced for them (vidiprinter.ts, #44).

type TeamId = Id<"teams">;
type Game = Infer<typeof game>;
type Opponent = Exclude<Against<TeamId>, { kind: typeof BYE }>;

/** One team's head-to-head in a gameweek, or null for a league made before rules were held (#25).
 *  The team is the caller's own unless one is named; the gameweek is the latest begun, or before
 *  any, the first, unless one is named; the game, in a league playing more than one a gameweek, is
 *  its number among the team's that gameweek as drawn, the first unless one is named or when the
 *  one named isn't drawn (#521). `now` is the screen's: a query may not read the clock. */
export const ofTeam = query({
  args: {
    leagueId: v.id("leagues"),
    now: v.number(),
    teamId: v.optional(v.id("teams")),
    gameweek: v.optional(v.number()),
    game: v.optional(v.number()),
  },
  returns: v.union(matchup, v.null()),
  handler: async (ctx, { leagueId, now, teamId, gameweek: asked, game: askedGame }) => {
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
    if (gameweek === null) return { ...heading, gameweek, deadline: null, gameNumber: FIRST_GAME, games: [], game: { kind: "none" as const } };
    // The team's games in the gameweek, shown one at a time with a switch between them: the
    // stepper steps gameweeks, the switch games (Craig, 6 Nov 2026, #521).
    const inGameweek = games.filter((each) => each.gameweek === gameweek).map(({ against }) => against);
    const gameNumber = askedGame !== undefined && askedGame >= FIRST_GAME && askedGame <= inGameweek.length ? askedGame : FIRST_GAME;
    const drawn = schedule.find((each) => each.gameweek === gameweek);
    const teams = await teamsOf(ctx, league._id);
    const nameOf = nameIn(teams, gameweek);
    return {
      ...heading,
      gameweek,
      deadline: deadlineIn(gameweek),
      gameNumber,
      games: inGameweek.map((against) => (against.kind === BYE ? { kind: BYE as typeof BYE } : opponentOf(against, nameOf))),
      game: await gameOf(ctx, league, season, team, teams, drawn, inGameweek.at(gameNumber - FIRST_GAME), now),
    };
  },
});

/** The team's game in the gameweek `drawn`: scored once begun, with both lineups. */
async function gameOf(
  ctx: QueryCtx,
  league: Doc<"leagues">,
  season: SeasonRules,
  team: Doc<"teams">,
  teams: readonly Doc<"teams">[],
  drawn: GameweekFixtures<TeamId> | undefined,
  against: Against<TeamId> | undefined,
  now: number,
): Promise<Game> {
  // A game is one of the gameweek's fixtures or byes, so there is one only where it is drawn.
  if (against === undefined || drawn === undefined) return { kind: "none" };
  const { gameweek } = drawn;
  if (against.kind === BYE) return { kind: BYE };
  const nameOf = nameIn(teams, gameweek);
  const opponent = opponentOf(against, nameOf);
  if (!(await begunGameweeks(ctx, league)).includes(gameweek)) return { kind: "notBegun", opponent };
  try {
    const teamIds = teams.map((each) => each._id);
    const versionIn = await siteVersionByGameweek(ctx);
    const inGameweek = await tableGameweek(ctx, await leagueReads(ctx, league, season, (each) => versionIn(each).set), gameweek, teamIds);
    const scorer = new SideScorer(ctx, league._id, inGameweek, teamsInGameweek(drawn), gameweek);
    const sides = against.kind === "team" ? [team._id, against.team] : [team._id];
    return {
      kind: "scored",
      team: await scorer.team(team._id, team.name),
      opponent: await scorer.opponent(against, nameOf),
      commentary: await scorer.commentary(sides, `League ${league._id} (${league.name}) can't read ${team.name}'s commentary in gameweek ${gameweek}`, now),
      version: versionIn(gameweek).name,
    };
  } catch (error) {
    const reason = logFailure(`League ${league._id} (${league.name}) can't score ${team.name}'s matchup in gameweek ${gameweek}`, error);
    return { kind: "unscored", opponent, reason };
  }
}

/** The first of a team's games in a gameweek, as the address and the switch number them. */
const FIRST_GAME = 1;

/** A team's name, for a team `gameweek`'s fixtures name. */
const nameIn = (teams: readonly Doc<"teams">[], gameweek: number) => (teamId: TeamId) => {
  const named = teams.find((each) => each._id === teamId);
  if (named === undefined) throw new Error(`gameweek ${gameweek}'s fixtures name team ${teamId}, which isn't in the league`);
  return named.name;
};

/** Who a game is against: another team, by name, or the league's average. */
const opponentOf = (against: Opponent, nameOf: (teamId: TeamId) => string) =>
  against.kind === "team" ? { kind: "team" as const, teamName: nameOf(against.team) } : { kind: LEAGUE_AVERAGE as typeof LEAGUE_AVERAGE };

/** Each side of the matchup, from the table's scorer: each slot worked out, and each total the
 *  table's, its saved final total where the table reads one. A stored total is final, so should the
 *  data behind a slot change after storing (a position corrected, say), the slots may no longer add
 *  up to it; and a gameweek whose slots can't be worked out is unscored here even while the table
 *  shows its stored totals. */
class SideScorer {
  /** Each man's name, for one the football sync doesn't hold the words saying so (#810, #323), and
   *  each match's score, read once. */
  private readonly reads: CommentaryReads;
  private readonly name: CommentaryReads["name"];
  private readonly score: CommentaryReads["score"];

  constructor(
    private readonly ctx: QueryCtx,
    private readonly leagueId: Id<"leagues">,
    private readonly inGameweek: GameweekTeams,
    /** The teams the league's average is over: the gameweek's own (standings.ts's teamsInGameweek). */
    private readonly averaged: readonly TeamId[],
    private readonly gameweek: number,
  ) {
    this.reads = commentaryReads(ctx);
    this.name = this.reads.name;
    this.score = this.reads.score;
  }

  async team(teamId: TeamId, teamName: string): Promise<MatchupSide> {
    const scored = await this.inGameweek.slotsOf(teamId);
    const { points, provisional } = await this.inGameweek.pointsOf(teamId);
    const starterOf = (slotPoints: SlotPoints) => this.starter(slotPoints, scored);
    const benchOf = (slotPoints: SlotPoints) => this.benchSlot(slotPoints, scored);
    return {
      kind: "team",
      teamId,
      teamName,
      points,
      provisional,
      overridden: this.inGameweek.overridden(teamId),
      lineup: { starters: await Promise.all(scored.team.starters.map(starterOf)), bench: await Promise.all(scored.team.bench.map(benchOf)) },
      formation: scored.formation,
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
   *  is logged and says why, while the scores still show. Delayed as at `now` (`delayedAt`). */
  async commentary(teamIds: readonly TeamId[], failure: string, now: number): Promise<MatchupCommentary> {
    try {
      const read = await readCommentary(this.ctx, this.inGameweek, teamIds, now, this.reads, { countingOnly: false });
      return { kind: "read", ...read };
    } catch (error) {
      return { kind: "unread", reason: logFailure(failure, error) };
    }
  }

  private async starter(slotPoints: SlotPoints, scored: TeamInGameweek): Promise<MatchupStarter> {
    return { ...(await this.slot(slotPoints, scored)), role: pricedRole(slotPoints), place: placeOf(slotPoints) };
  }

  /** A bench player has a role and a place only once he has come on: until then he plays none,
   *  though the scorer prices his greyed points at his bench cell's first. */
  private async benchSlot(slotPoints: SlotPoints, scored: TeamInGameweek): Promise<MatchupBenchSlot> {
    const cameOn = scored.autoSubs.substitutions.some((each) => each.on === slotPoints.playerCode);
    return { ...(await this.slot(slotPoints, scored)), role: cameOn ? pricedRole(slotPoints) : null, place: cameOn ? placeOf(slotPoints) : null };
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
      breakdown: await this.breakdown(slotPoints, matchesOf.get(playerCode) ?? []),
    };
  }

  /** Each of his matches as his slot scored it, kickoff first: its categories, his role's line and
   *  the league's override, from the scorer's own points, so they add up to his. */
  private async breakdown(slotPoints: SlotPoints, matches: readonly HeldMatch[]): Promise<MatchBreakdown[]> {
    const { playerCode } = slotPoints;
    const { ownStats } = this.inGameweek.set;
    const scored = scoredByMatch(slotPoints, matches).toSorted((one, other) => byKickoffOrder(one.match.fixture, other.match.fixture));
    return Promise.all(
      scored.map(async ({ match: { fixture, overrides }, points: { total, categories, role }, counted }) => {
        const overridden = overrides.has(playerCode) ? await overrideOf(this.ctx, this.leagueId, fixture.code, playerCode) : null;
        return {
          fixtureCode: fixture.code,
          kickoff: fixture.kickoff,
          points: total,
          counted,
          categories: namedCategoriesOf(categories, ownStats),
          ...(role === undefined ? {} : { role: roleLineOf(role, ownStats) }),
          override: overridden === null ? null : { points: overridden.points, reason: overridden.reason },
        };
      }),
    );
  }

  /** On while any of his matches is; over once all are (at full time, though his points stay
   *  provisional until the match locks), naming the last to kick off; otherwise yet to play, at
   *  the next kickoff. */
  private async status(matches: readonly HeldMatch[]): Promise<SlotStatus> {
    if (matches.length === 0) return { kind: "noMatch" };
    const states = await Promise.all(matches.map(async (match) => ({ match, score: await this.score(match.fixture.code) })));
    for (const { match, score } of states) {
      if (!isFinished(match) && score !== null && isPlaying(score.state)) {
        return { kind: "playing", fixtureCode: match.fixture.code, state: score.state, minute: score.minutes, clockLabel: score.clockLabel };
      }
    }
    const toCome = states.filter(({ match, score }) => !isFinished(match) && score?.state !== "fullTime").map(({ match }) => match.fixture);
    if (toCome.length === 0) return { kind: "finished", fixtureCode: byKickoff(matches.map(({ fixture }) => fixture)).at(-1)!.code };
    const [next] = byKickoff(toCome);
    return { kind: "yetToPlay", fixtureCode: next.code, kickoff: next.kickoff };
  }
}

/** The role the scorer priced him in at his cell, so the matchup and the table never disagree. Its
 *  run is read from the role set at his place (spec/05 Runs), so only its key is sent. */
function pricedRole({ playerCode, cell, role }: SlotPoints): Pick<Role, "key" | "name"> {
  if (role === undefined) throw new Error(`player ${playerCode} plays at ${cell.area} ${cell.lane}, which has no roles`);
  return namedRole(roleIn(cell, role));
}

/** The slot he plays in: its lane and its position label, as the Tactics pitch labels it. */
const placeOf = ({ cell }: SlotPoints): MatchupPlace => ({ lane: cell.lane, label: positionOfSlot(cell) });

type KicksOff = { kickoff: number | null };

/** Two matches in kickoff order, any with no time yet last. */
const byKickoffOrder = (one: KicksOff, other: KicksOff) =>
  (one.kickoff === null ? 1 : 0) - (other.kickoff === null ? 1 : 0) || (one.kickoff ?? 0) - (other.kickoff ?? 0);

/** Matches by kickoff, any with no time yet last. */
const byKickoff = <Fixture extends KicksOff>(fixtures: readonly Fixture[]): Fixture[] => fixtures.toSorted(byKickoffOrder);
