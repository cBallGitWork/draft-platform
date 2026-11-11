import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { isPlaying } from "../football/matchScores";
import { deadlineOf, leagueDeadlines } from "../gameweeks/leagueDeadlines";
import type { SeasonRules } from "../rules/rulesHistory";
import { logFailure } from "../shared/errors";
import { teamsOf } from "../shared/leagueAccess";
import { begunGameweeks, tableGameweek, type GameweekTeams } from "../gameweekScorer/gameweekScores";
import { scheduleOf } from "../table/playedFixtures";
import { isFinished, overrideOf, type HeldMatch } from "../gameweekScorer/heldMatches";
import { leagueReads, scoredByMatch, type TeamInGameweek } from "../gameweekScorer/teamGameweek";
import { LEAGUE_AVERAGE, type GameweekFixtures } from "../table/roundRobin";
import { teamsInGameweek } from "../table/standings";
import { averageScore, BYE, gamesOf, type Against } from "../table/teamGames";
import type { SlotPoints } from "../scoring/teamPoints";
import { instructionLinesOf, namedCategoriesOf, roleLineOf } from "../scoring/breakdownShape";
import { siteVersionByGameweek } from "../scoring/siteVersions";
import { matchupTeam } from "./matchupGameweek";
import { heldMatchup, type HeldGame, type HeldTeamsCommentary, type MatchBreakdown, type MatchupBenchSlot, type MatchupSide, type MatchupSlot, type MatchupStarter, type SlotStatus } from "./matchupShape";
import { commentaryReads, readCommentary, type CommentaryReads } from "./readCommentary";
import { byKickoff, byKickoffOrder, namedMatch, placeOf, pricedRole, shirtOf } from "./slotParts";
import { findClubByCode } from "../shared/players";
import { readOnce } from "../shared/readOnce";
import { onAutoTeam } from "../trades/tradeShut";

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
type Opponent = Exclude<Against<TeamId>, { kind: typeof BYE }>;

/** One team's head-to-head in a gameweek.
 *  The team is the caller's own unless one is named; the gameweek is the one asked, or the screen's
 *  matchupGameweek.ts's `thisGameweek`, and null when that is; the game, in a league playing more
 *  than one a gameweek, is its number among the team's that gameweek as drawn, the first unless one
 *  is named or when the one named isn't drawn (#521). It takes no minute, so it is read again only
 *  when its data changes (#1550): its commentary's delay is a moment (commentaryAt.ts). */
export const ofTeam = query({
  args: {
    leagueId: v.id("leagues"),
    teamId: v.optional(v.id("teams")),
    gameweek: v.union(v.number(), v.null()),
    game: v.optional(v.number()),
  },
  returns: heldMatchup,
  handler: async (ctx, { leagueId, teamId, gameweek, game: askedGame }) => {
    const opened = await matchupTeam(ctx, leagueId, teamId);
    if (opened.kind !== "team") return { kind: opened.kind };
    const { league, season, team } = opened;

    const schedule = await scheduleOf(ctx, league, season);
    const games = gamesOf(schedule, team._id);
    const deadlineIn = deadlineOf(await leagueDeadlines(ctx, leagueId));
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
      game: await gameOf(ctx, league, season, team, teams, drawn, inGameweek.at(gameNumber - FIRST_GAME)),
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
): Promise<HeldGame> {
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
    const scorer = new SideScorer(ctx, league._id, inGameweek, teamsInGameweek(drawn), gameweek, teams);
    const sides = against.kind === "team" ? [team._id, against.team] : [team._id];
    return {
      kind: "scored",
      team: await scorer.team(team),
      opponent: await scorer.opponent(against),
      commentary: await scorer.commentary(sides, `League ${league._id} (${league.name}) can't read ${team.name}'s commentary in gameweek ${gameweek}`),
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
  /** Each club, read once, so a breakdown names its matches. */
  private readonly club: (code: number) => Promise<Doc<"clubs"> | null>;

  constructor(
    private readonly ctx: QueryCtx,
    private readonly leagueId: Id<"leagues">,
    private readonly inGameweek: GameweekTeams,
    /** The teams the league's average is over: the gameweek's own (standings.ts's teamsInGameweek). */
    private readonly averaged: readonly TeamId[],
    private readonly gameweek: number,
    private readonly teams: readonly Doc<"teams">[],
  ) {
    this.reads = commentaryReads(ctx);
    this.name = this.reads.name;
    this.score = this.reads.score;
    this.club = readOnce((code: number) => findClubByCode(ctx, code));
  }

  async team(team: Doc<"teams">): Promise<MatchupSide> {
    const teamId = team._id;
    const scored = await this.inGameweek.slotsOf(teamId);
    const { points, provisional } = await this.inGameweek.pointsOf(teamId);
    const starterOf = (slotPoints: SlotPoints) => this.starter(slotPoints, scored, teamId);
    const benchOf = (slotPoints: SlotPoints) => this.benchSlot(slotPoints, scored, teamId);
    return {
      kind: "team",
      teamId,
      teamName: team.name,
      points,
      provisional,
      overridden: this.inGameweek.overridden(teamId),
      autoTeam: onAutoTeam(team),
      lineup: { starters: await Promise.all(scored.team.starters.map(starterOf)), bench: await Promise.all(scored.team.bench.map(benchOf)) },
      formation: scored.formation,
    };
  }

  async opponent(against: Opponent): Promise<MatchupSide> {
    if (against.kind === "team") {
      const team = this.teams.find((each) => each._id === against.team);
      if (team === undefined) throw new Error(`gameweek ${this.gameweek}'s fixtures name team ${against.team}, which isn't in the league`);
      return this.team(team);
    }
    // The average of the gameweek's teams' points, as the table counts it.
    const every = await Promise.all(this.averaged.map((teamId) => this.inGameweek.pointsOf(teamId)));
    const sides = new Map(this.averaged.map((teamId, index) => [teamId, every[index]]));
    return { kind: LEAGUE_AVERAGE, ...averageScore(this.averaged, sides, this.gameweek) };
  }

  /** The commentary of every match the sides' men play in, priced for them. One that can't be read
   *  is logged and says why, while the scores still show. Held: its delay a moment (commentaryAt.ts). */
  async commentary(teamIds: readonly TeamId[], failure: string): Promise<HeldTeamsCommentary> {
    try {
      const read = await readCommentary(this.ctx, this.inGameweek, teamIds, this.reads, { countingOnly: false });
      return { kind: "read", ...read };
    } catch (error) {
      return { kind: "unread", reason: logFailure(failure, error) };
    }
  }

  private async starter(slotPoints: SlotPoints, scored: TeamInGameweek, teamId: TeamId): Promise<MatchupStarter> {
    return { ...(await this.slot(slotPoints, scored, teamId)), role: pricedRole(slotPoints), place: placeOf(slotPoints) };
  }

  /** A bench player has a role and a place only once he has come on: until then he plays none,
   *  though the scorer prices his greyed points at his bench cell's first. */
  private async benchSlot(slotPoints: SlotPoints, scored: TeamInGameweek, teamId: TeamId): Promise<MatchupBenchSlot> {
    const cameOn = scored.autoSubs.substitutions.some((each) => each.on === slotPoints.playerCode);
    return { ...(await this.slot(slotPoints, scored, teamId)), role: cameOn ? pricedRole(slotPoints) : null, place: cameOn ? placeOf(slotPoints) : null };
  }

  /** `teamId` is the side's, whose squad number he wears while it still holds him. */
  private async slot(slotPoints: SlotPoints, { autoSubs, matchesOf, instructions }: TeamInGameweek, teamId: TeamId): Promise<MatchupSlot> {
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
      ...(await shirtOf(this.ctx, this.leagueId, playerCode, teamId)),
      points,
      counts,
      provisional,
      status: await this.status(matchesOf.get(playerCode) ?? []),
      autoSub,
      breakdown: await this.breakdown(slotPoints, matchesOf.get(playerCode) ?? [], instructions),
    };
  }

  /** Each of his matches as his slot scored it, kickoff first: its categories, his role's line and
   *  the league's override, from the scorer's own points, so they add up to his. */
  private async breakdown(slotPoints: SlotPoints, matches: readonly HeldMatch[], instructions: TeamInGameweek["instructions"]): Promise<MatchBreakdown[]> {
    const { playerCode } = slotPoints;
    const { ownStats } = this.inGameweek.set;
    const scored = scoredByMatch(slotPoints, matches).toSorted((one, other) => byKickoffOrder(one.match.fixture, other.match.fixture));
    return Promise.all(
      scored.map(async ({ match: { fixture, overrides }, points: { total, categories, role, instructions: instructed }, counted }) => {
        const overridden = overrides.has(playerCode) ? await overrideOf(this.ctx, this.leagueId, fixture.code, playerCode) : null;
        return {
          fixtureCode: fixture.code,
          kickoff: fixture.kickoff,
          ...(await namedMatch(fixture, this.club, this.score)),
          points: total,
          counted,
          categories: namedCategoriesOf(categories, ownStats),
          ...(role === undefined ? {} : { role: roleLineOf(role, ownStats) }),
          ...(instructed === undefined ? {} : { instructions: instructionLinesOf(instructed, instructions, ownStats) }),
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
