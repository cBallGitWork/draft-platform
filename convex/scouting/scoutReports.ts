import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { positionOfSlot } from "../lineup/pitch";
import { roleIn, roleName } from "../lineup/roles";
import { fileLetter } from "../mail/letters";
import { writeWithClaude } from "../outbound/claude";
import { nextFixtures, seasonMatches } from "../playerCard/playerCard";
import { positionsNow } from "../positions/playerPositions";
import { logFailure } from "../shared/errors";
import { clubsByCode, playerByCode } from "../shared/players";
import { MINUTE_MS } from "../shared/time";
import { starsOfPlayers } from "../stars/playerStars";
import { playerLeftLetter, REPORT_MAX_TOKENS, REPORT_SYSTEM, reportInLetter, reportPrompt, type ScoutBrief } from "./scoutWords";

// A scout's report (spec/19, The report; #375), written when his 24 hours are up: a few plain
// sentences by Claude, from the player's figures and the team's shape, dated. Once it lands the
// scout is free again and Mail tells the manager it is in, and nothing more. A player who left the
// Premier League while the scout was out gets no report: the scout comes back free, and Mail says
// so (Craig, 6 Nov 2026, on #375).

/** How long after a failed write it is tried again. The scout stays out meanwhile, and every
 *  failure is logged and kept on his row, so a lasting one (no API key, say) shows. */
export const REPORT_RETRY_MS = 30 * MINUTE_MS;

const briefOrGone = v.union(
  v.null(),
  v.object({ kind: v.literal("gone") }),
  v.object({ kind: v.literal("brief"), prompt: v.string() }),
);

/** What the report on a scout's player is written from at `now`, or that he has left the Premier
 *  League; null once the scout is back (already written). */
export const brief = internalQuery({
  args: { scoutId: v.id("scouts"), now: v.number() },
  returns: briefOrGone,
  handler: async (ctx, { scoutId, now }) => {
    const scout = await ctx.db.get("scouts", scoutId);
    if (scout === null || scout.state !== "out") return null;
    const player = await playerByCode(ctx, scout.playerCode);
    if (player === null || player.droppedAt !== undefined) return { kind: "gone" as const };
    const league = await ctx.db.get("leagues", scout.leagueId);
    if (league === null) throw new Error(`Scout ${scoutId}'s league ${scout.leagueId} doesn't exist`);
    const positions = await (await positionsNow(ctx, league._id))(player.code);
    const clubs = clubsByCode(ctx);
    const club = await clubs(player.clubCode);
    const stars = (await starsOfPlayers(ctx, [player.code])).get(player.code)!;
    const lineup = await ctx.db
      .query("lineups")
      .withIndex("by_leagueId_and_teamId_and_fromGameweek", (q) => q.eq("leagueId", league._id).eq("teamId", scout.teamId))
      .order("desc")
      .first();
    const opponentOf = (match: { home: { code: number; name: string }; away: { code: number; name: string } }) => {
      const home = match.home.code === player.clubCode;
      return { opponent: (home ? match.away : match.home).name, home };
    };
    const facts: ScoutBrief = {
      playerName: player.fullName,
      clubName: club.name,
      positions,
      news: player.news || null,
      chanceOfPlaying: player.chanceOfPlaying ?? null,
      stars: stars.map(({ area, role, stars }) => ({ area, role: roleName(role), stars })),
      shape: (lineup?.starters ?? []).map((starter) => ({ position: positionOfSlot(starter), role: roleIn(starter, starter.role).name })),
      matches: (await seasonMatches(ctx, league, player, positions, clubs)).map((match) => ({
        ...opponentOf(match),
        minutes: match.minutes,
        points: match.points.map(({ position, total }) => ({ position, total })),
      })),
      fixtures: (await nextFixtures(ctx, player.clubCode, now, clubs)).map((fixture) => ({ ...opponentOf(fixture), gameweek: fixture.gameweek })),
    };
    return { kind: "brief" as const, prompt: reportPrompt(facts) };
  },
});

/** Writes the scout's report when his 24 hours are up (scheduled by scouts.ts's `send`): Claude
 *  writes it from `brief`, and it lands; or the player has left, and the scout comes back with none.
 *  A failed write is logged, kept on the scout's row and tried again REPORT_RETRY_MS later. */
export const write = internalAction({
  args: { scoutId: v.id("scouts") },
  returns: v.null(),
  handler: async (ctx, { scoutId }) => {
    const facts = await ctx.runQuery(internal.scouting.scoutReports.brief, { scoutId, now: Date.now() });
    if (facts === null) return null;
    if (facts.kind === "gone") {
      await ctx.runMutation(internal.scouting.scoutReports.comeBack, { scoutId, text: null });
      return null;
    }
    let text: string;
    try {
      text = await writeWithClaude({ system: REPORT_SYSTEM, prompt: facts.prompt, maxTokens: REPORT_MAX_TOKENS });
    } catch (error) {
      const failure = logFailure(`Scout ${scoutId}'s report wasn't written; trying again in ${REPORT_RETRY_MS / MINUTE_MS} minutes`, error);
      await ctx.runMutation(internal.scouting.scoutReports.failed, { scoutId, failure });
      return null;
    }
    await ctx.runMutation(internal.scouting.scoutReports.comeBack, { scoutId, text });
    return null;
  },
});

/** The scout comes back, free again: with his report, or, with none (`text` null), because the
 *  player has left the Premier League. Mail tells the team's manager. Nothing for a scout already
 *  back. */
export const comeBack = internalMutation({
  args: { scoutId: v.id("scouts"), text: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { scoutId, text }) => {
    const scout = await ctx.db.get("scouts", scoutId);
    if (scout === null || scout.state !== "out") return null;
    const player = await playerByCode(ctx, scout.playerCode);
    const playerName = player?.name ?? `player ${scout.playerCode}`;
    if (text === null) await ctx.db.patch("scouts", scoutId, { state: "playerLeft" });
    else await ctx.db.patch("scouts", scoutId, { state: "reported", report: { text, writtenAt: Date.now() } });
    await tellManager(ctx, scout, text === null ? playerLeftLetter(playerName) : reportInLetter(playerName));
    return null;
  },
});

/** Keeps a failed write on the scout's row and tries again REPORT_RETRY_MS later. */
export const failed = internalMutation({
  args: { scoutId: v.id("scouts"), failure: v.string() },
  returns: v.null(),
  handler: async (ctx, { scoutId, failure }) => {
    const scout = await ctx.db.get("scouts", scoutId);
    if (scout === null || scout.state !== "out") return null;
    await ctx.db.patch("scouts", scoutId, { failedTries: (scout.failedTries ?? 0) + 1, lastFailure: failure });
    await ctx.scheduler.runAfter(REPORT_RETRY_MS, internal.scouting.scoutReports.write, { scoutId });
    return null;
  },
});

/** Files the letter to the team's manager alone: no other team can tell whom it scouts. A team
 *  with no manager gets none. */
async function tellManager(ctx: MutationCtx, scout: Doc<"scouts">, letter: { subject: string; body: string }): Promise<void> {
  const league = await ctx.db.get("leagues", scout.leagueId);
  const team = await ctx.db.get("teams", scout.teamId);
  if (league === null || team === null) throw new Error(`Scout ${scout._id}'s league or team doesn't exist`);
  if (team.managerEmail === undefined) return;
  await fileLetter(ctx, league, [team.managerEmail], letter);
}
