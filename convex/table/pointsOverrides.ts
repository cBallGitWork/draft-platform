import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { recordEvent } from "../mail/letters";
import { matchWords } from "../mail/letterWords";
import { seasonRules } from "../rules/rulesHistory";
import { inTenths } from "../scoring/values";
import { fixtureByCode } from "../shared/fixtures";
import { refuse, refusals, runnerOf, teamsOf } from "../shared/leagueAccess";
import { clubByCode, playerByCode } from "../shared/players";
import { figureWords } from "../shared/numberWords";
import { typedText } from "../shared/typedText";
import { rescoreGameweek } from "./finalScores";
import { begunGameweeks, workedOutGameweek } from "../gameweekScorer/gameweekScores";
import { OVERRIDE_POINTS_MOST, OVERRIDE_REASON_MAX } from "./overrideLimits";
import { playsIn } from "../gameweekScorer/heldMatches";
import { leagueReads, pointsInMatch, type LeagueReads } from "../gameweekScorer/teamGameweek";

// A commissioner overrides one player's points for one match, with a reason (spec/14, Changes and
// corrections; #32). The override is a row teamGameweek.ts reads with the match's records, so the
// table, the matchup and the stored scores all score it alike. Setting one re-scores that
// gameweek's stored scores (finalScores.ts) and files a letter to the whole league saying what
// changed and why (spec/15: nothing changes quietly).
//
// Any match of a gameweek the league has begun may be overridden, open or locked, back to the
// start of the season: "b any match any time" (S14.2). An override stands over any later
// correction until it is changed or removed (S14.4); a second override of the same man in the
// same match replaces the first, and says so, and "remove override" puts his scored points back
// (S14.5). A man the football data has lost may be overridden in a match he has a saved record
// in: "we can always admin update later" (#810, S14.5). A team's override of its gameweek total
// (teamOverrides.ts) stands over all of these.

type TeamId = Id<"teams">;

/** Why an override was refused, as the commissioner is told it. */
export const overrideRefusals = {
  noRules: "This league was made before leagues had rules, so it has no scores to override.",
  noMatch: "There's no such match this season.",
  notBegun: (gameweek: number) => `Gameweek ${gameweek} hasn't begun for this league, so it has no points to override.`,
  notInMatch: (name: string) => `${name} wasn't in that match.`,
  notPoints: "Points are a number, kept to a tenth.",
  notWhole: "The scoring counts whole points only.",
  outOfRange: `An override is from ${figureWords(-OVERRIDE_POINTS_MOST)} to ${OVERRIDE_POINTS_MOST} points.`,
  blankReason: "Say why: the whole league is told.",
  reasonTooLong: `A reason is up to ${OVERRIDE_REASON_MAX} characters.`,
  noOverride: (name: string) => `${name}'s points in that match aren't overridden.`,
} as const;

/** How a letter names a man the football data has lost, who has no name left to give. */
export const lostPlayerName = (code: number) => `Player ${code}`;

/** The league's commissioner, co-commissioner or the admin sets the player's points in the match. */
export const override = mutation({
  args: { leagueId: v.id("leagues"), fixtureCode: v.number(), playerCode: v.number(), points: v.number(), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { leagueId, fixtureCode, playerCode, points, reason: typed }) => {
    const { by, match } = await overridable(ctx, leagueId, fixtureCode, playerCode);
    const reason = typedText(typed, OVERRIDE_REASON_MAX, { blank: overrideRefusals.blankReason, tooLong: overrideRefusals.reasonTooLong });
    if (!Number.isFinite(points) || inTenths(points) !== points) refuse(overrideRefusals.notPoints);
    if (Math.abs(points) > OVERRIDE_POINTS_MOST) refuse(overrideRefusals.outOfRange);
    if (match.reads.setIn(match.gameweek).wholePointsOnly && !Number.isInteger(points)) refuse(overrideRefusals.notWhole);

    const held = await heldOverride(ctx, leagueId, fixtureCode, playerCode);
    const row = { leagueId, gameweek: match.gameweek, fixtureCode, playerCode, points, reason, by, at: Date.now() };
    const { before, after } = await rescored(ctx, match, async () => {
      if (held === null) await ctx.db.insert("pointsOverrides", row);
      else await ctx.db.replace("pointsOverrides", held._id, row);
    });
    await recordEvent(ctx, leagueId, by, {
      kind: "pointsOverridden",
      ...match.named,
      from: before.playerPoints ?? held?.points ?? null,
      to: points,
      reason,
      teams: movedTeams(match.teams, before, after),
    });
    return null;
  },
});

/** The same three take a player's override away, and he scores what his record does there again. */
export const removeOverride = mutation({
  args: { leagueId: v.id("leagues"), fixtureCode: v.number(), playerCode: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, fixtureCode, playerCode }) => {
    const { by, match } = await overridable(ctx, leagueId, fixtureCode, playerCode);
    const held = (await heldOverride(ctx, leagueId, fixtureCode, playerCode)) ?? refuse(overrideRefusals.noOverride(match.named.playerName));
    const { after, before } = await rescored(ctx, match, () => ctx.db.delete("pointsOverrides", held._id));
    await recordEvent(ctx, leagueId, by, {
      kind: "pointsOverrideRemoved",
      ...match.named,
      from: held.points,
      to: after.playerPoints,
      teams: movedTeams(match.teams, before, after),
    });
    return null;
  },
});

/** One man in one match of a league, as an override reads them. */
interface OverriddenMatch {
  league: Doc<"leagues">;
  gameweek: number;
  teams: Doc<"teams">[];
  reads: LeagueReads;
  playerCode: number;
  fixtureCode: number;
  /** The man and the match as the letter names them. */
  named: { playerCode: number; playerName: string; fixtureCode: number; matchName: string; gameweek: number };
}

/** The caller, if they run the league, and the man in the match, refused with the reason where
 *  he can't be overridden there. */
async function overridable(ctx: MutationCtx, leagueId: Id<"leagues">, fixtureCode: number, playerCode: number) {
  const { email: by, league } = await runnerOf(ctx, leagueId);
  const season = (await seasonRules(ctx, leagueId)) ?? refuse(overrideRefusals.noRules);
  const fixture = await fixtureByCode(ctx, fixtureCode);
  if (fixture === null || fixture.droppedAt !== undefined || fixture.gameweek === null) refuse(overrideRefusals.noMatch);
  const { gameweek } = fixture;
  if (!(await begunGameweeks(ctx, league)).includes(gameweek)) refuse(overrideRefusals.notBegun(gameweek));
  const playerName = await nameInMatch(ctx, fixture, playerCode);
  const [home, away] = await Promise.all([clubByCode(ctx, fixture.homeClubCode), clubByCode(ctx, fixture.awayClubCode)]);
  const match: OverriddenMatch = {
    league,
    gameweek,
    teams: await teamsOf(ctx, leagueId),
    reads: await leagueReads(ctx, league, season),
    playerCode,
    fixtureCode,
    named: { playerCode, playerName, fixtureCode, matchName: matchWords(home.name, away.name), gameweek },
  };
  return { by, match };
}

/** His name, if a team sheet named him for the match or his club plays in it; for a man the
 *  football data has lost, `lostPlayerName`, if he has a saved record in it. Refused otherwise. */
async function nameInMatch(ctx: MutationCtx, fixture: Doc<"fixtures">, playerCode: number): Promise<string> {
  const record = await ctx.db
    .query("playerMatchStats")
    .withIndex("by_fixtureCode_and_playerCode", (q) => q.eq("fixtureCode", fixture.code).eq("playerCode", playerCode))
    .unique();
  const player = await playerByCode(ctx, playerCode);
  if (player === null) return record === null ? refuse(refusals.noPlayer) : lostPlayerName(playerCode);
  if (record === null && !playsIn(fixture, player.clubCode)) refuse(overrideRefusals.notInMatch(player.name));
  return player.name;
}

function heldOverride(ctx: MutationCtx, leagueId: Id<"leagues">, fixtureCode: number, playerCode: number) {
  return ctx.db
    .query("pointsOverrides")
    .withIndex("by_leagueId_and_fixtureCode_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("fixtureCode", fixtureCode).eq("playerCode", playerCode))
    .unique();
}

/** The gameweek worked out before and after `change`, which then re-scores its stored scores. */
async function rescored(ctx: MutationCtx, match: OverriddenMatch, change: () => Promise<unknown>) {
  const before = await workedOut(ctx, match);
  await change();
  const after = await workedOut(ctx, match);
  await rescoreGameweek(ctx, match.league, match.gameweek);
  return { before, after };
}

type WorkedOut = { totals: Map<TeamId, number>; playerPoints: number | null };

/** Each team whose total moved, by name, from what to what. */
function movedTeams(teams: readonly Doc<"teams">[], before: WorkedOut, after: WorkedOut) {
  return teams.flatMap((team) => {
    const [from, to] = [before.totals.get(team._id)!, after.totals.get(team._id)!];
    return from === to ? [] : [{ teamName: team.name, from, to }];
  });
}

/** The gameweek as the scorer works it out now, any saved total set aside: each team's total, and
 *  the player's points in the match, null while no lineup fields him. */
async function workedOut(ctx: MutationCtx, { reads, gameweek, teams, playerCode, fixtureCode }: OverriddenMatch): Promise<WorkedOut> {
  const teamIds = teams.map((team) => team._id);
  const { slotsOf, pointsOf } = await workedOutGameweek(ctx, reads, gameweek, teamIds);
  const totals = new Map<TeamId, number>();
  let playerPoints: number | null = null;
  for (const teamId of teamIds) {
    const scored = await slotsOf(teamId);
    totals.set(teamId, (await pointsOf(teamId)).points);
    const inMatch = pointsInMatch(scored, playerCode, fixtureCode);
    if (inMatch) playerPoints = inMatch.points;
  }
  return { totals, playerPoints };
}
