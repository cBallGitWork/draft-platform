import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { recordEvent } from "../mail/letters";
import { matchWords } from "../mail/letterWords";
import { seasonRules } from "../rules/rulesHistory";
import { inTenths } from "../scoring/scoringSet";
import { fixtureByCode } from "../shared/fixtures";
import { refuse, refusals, runnerOf, teamsOf } from "../shared/leagueAccess";
import { clubByCode, playerByCode } from "../shared/players";
import { typedText } from "../shared/typedText";
import { statusOf } from "../stats/matchStats";
import { rescoreGameweek } from "./finalScores";
import { begunGameweeks } from "./gameweekScores";
import { OVERRIDE_POINTS_MOST, OVERRIDE_REASON_MAX } from "./overrideLimits";
import { gameweekInputs, heldFixtures, leagueReads, playsIn, teamInGameweek, type LeagueReads } from "./teamGameweek";

// A commissioner overrides one player's points for one match, with a reason (spec/14, Changes and
// corrections; #32). The override is a row teamGameweek.ts reads with the match's records, so the
// table, the matchup and the stored scores all score it alike. Setting one re-scores that
// gameweek's stored scores (finalScores.ts) and files a letter to the whole league saying what
// changed and why (spec/15: nothing changes quietly). Only a locked match may be overridden: until
// it locks, its own corrections still move its points (spec/07). A second override of the same man
// in the same match replaces the first, and says so; there is no undoing one but overriding again.

type TeamId = Id<"teams">;

/** Why an override was refused, as the commissioner is told it. */
export const overrideRefusals = {
  noRules: "This league was made before leagues had rules, so it has no scores to override.",
  noMatch: "There's no such match this season.",
  notBegun: (gameweek: number) => `Gameweek ${gameweek} hasn't begun for this league, so it has no points to override.`,
  notLocked: "That match isn't final yet: its points can still be corrected, so it can be overridden once it locks.",
  notInMatch: (name: string) => `${name} wasn't in that match.`,
  notPoints: "Points are a number, kept to a tenth.",
  notWhole: "The scoring counts whole points only.",
  outOfRange: `An override is from -${OVERRIDE_POINTS_MOST} to ${OVERRIDE_POINTS_MOST} points.`,
  blankReason: "Say why: the whole league is told.",
  reasonTooLong: `A reason is up to ${OVERRIDE_REASON_MAX} characters.`,
} as const;

/** The league's commissioner, co-commissioner or the admin sets the player's points in the match. */
export const override = mutation({
  args: { leagueId: v.id("leagues"), fixtureCode: v.number(), playerCode: v.number(), points: v.number(), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { leagueId, fixtureCode, playerCode, points, reason: typed }) => {
    const { email: by, league } = await runnerOf(ctx, leagueId);
    const reason = typedText(typed, OVERRIDE_REASON_MAX, { blank: overrideRefusals.blankReason, tooLong: overrideRefusals.reasonTooLong });
    const season = (await seasonRules(ctx, leagueId)) ?? refuse(overrideRefusals.noRules);
    const fixture = await fixtureByCode(ctx, fixtureCode);
    if (fixture === null || fixture.droppedAt !== undefined || fixture.gameweek === null) refuse(overrideRefusals.noMatch);
    const { gameweek } = fixture;
    if (!(await begunGameweeks(ctx, league)).includes(gameweek)) refuse(overrideRefusals.notBegun(gameweek));
    if ((await statusOf(ctx, fixtureCode))?.state !== "locked") refuse(overrideRefusals.notLocked);
    const player = (await playerByCode(ctx, playerCode)) ?? refuse(refusals.noPlayer);
    if (!(await wasInMatch(ctx, fixture, player))) refuse(overrideRefusals.notInMatch(player.name));
    if (!Number.isFinite(points) || inTenths(points) !== points) refuse(overrideRefusals.notPoints);
    if (Math.abs(points) > OVERRIDE_POINTS_MOST) refuse(overrideRefusals.outOfRange);
    const reads = await leagueReads(ctx, league, season);
    if (reads.setIn(gameweek).wholePointsOnly && !Number.isInteger(points)) refuse(overrideRefusals.notWhole);

    const teams = await teamsOf(ctx, leagueId);
    const fixtures = await heldFixtures(ctx, gameweek);
    const asWorkedOut = () => workedOut(ctx, reads, gameweek, fixtures, teams, playerCode, fixtureCode);
    const before = await asWorkedOut();
    const held = await ctx.db
      .query("pointsOverrides")
      .withIndex("by_leagueId_and_fixtureCode_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("fixtureCode", fixtureCode).eq("playerCode", playerCode))
      .unique();
    const row = { leagueId, gameweek, fixtureCode, playerCode, points, reason, by, at: Date.now() };
    if (held === null) await ctx.db.insert("pointsOverrides", row);
    else await ctx.db.replace("pointsOverrides", held._id, row);
    const after = await asWorkedOut();
    await rescoreGameweek(ctx, league, gameweek);

    const [home, away] = await Promise.all([clubByCode(ctx, fixture.homeClubCode), clubByCode(ctx, fixture.awayClubCode)]);
    await recordEvent(ctx, leagueId, by, {
      kind: "pointsOverridden",
      playerCode,
      playerName: player.name,
      fixtureCode,
      matchName: matchWords(home.name, away.name),
      gameweek,
      from: before.playerPoints ?? held?.points ?? null,
      to: points,
      reason,
      teams: teams.flatMap((team) => {
        const [from, to] = [before.totals.get(team._id)!, after.totals.get(team._id)!];
        return from === to ? [] : [{ teamName: team.name, from, to }];
      }),
    });
    return null;
  },
});

/** Whether a team sheet named him for the match, or his club plays in it. */
async function wasInMatch(ctx: MutationCtx, fixture: Doc<"fixtures">, player: Doc<"players">): Promise<boolean> {
  const record = await ctx.db
    .query("playerMatchStats")
    .withIndex("by_fixtureCode_and_playerCode", (q) => q.eq("fixtureCode", fixture.code).eq("playerCode", player.code))
    .unique();
  return record !== null || playsIn(fixture, player.clubCode);
}

/** The gameweek as teamGameweek.ts works it out now: each team's total, and the player's points in
 *  the match, null while no lineup fields him. */
async function workedOut(
  ctx: MutationCtx,
  reads: LeagueReads,
  gameweek: number,
  fixtures: readonly Doc<"fixtures">[],
  teams: readonly Doc<"teams">[],
  playerCode: number,
  fixtureCode: number,
): Promise<{ totals: Map<TeamId, number>; playerPoints: number | null }> {
  const teamIds = teams.map((team) => team._id);
  const inputs = await gameweekInputs(ctx, reads, gameweek, fixtures, teamIds);
  const totals = new Map<TeamId, number>();
  let playerPoints: number | null = null;
  for (const teamId of teamIds) {
    const scored = await teamInGameweek(reads, inputs, teamId);
    // A team that never saved a lineup scores 0 (gameweekScores.ts), before and after alike.
    totals.set(teamId, scored?.team.total ?? 0);
    const slot = scored && [...scored.team.starters, ...scored.team.bench].find((each) => each.playerCode === playerCode);
    const index = slot ? scored.matchesOf.get(playerCode)!.findIndex((match) => match.fixture.code === fixtureCode) : -1;
    if (slot && index !== -1) playerPoints = slot.matches[index].total;
  }
  return { totals, playerPoints };
}
