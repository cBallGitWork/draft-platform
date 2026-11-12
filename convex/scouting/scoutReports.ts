import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { saveGameweekOf } from "../gameweeks/saveGameweek";
import { seasonGameweekCount } from "../gameweeks/seasonGameweeks";
import { lastPlayedGameweek } from "../gameweeks/usedGameweeks";
import { lineupInGameweek } from "../lineup/lineups";
import { positionOfSlot } from "../lineup/pitch";
import { roleIn, roleName } from "../lineup/roles";
import { fileLetter } from "../mail/letters";
import { CLAUDE_RETRY_MS, CLAUDE_TRIES_MOST, writeWithClaude } from "../outbound/claude";
import { nextFixtures, seasonMatches } from "../playerCard/playerCard";
import { positionsNow } from "../positions/playerPositions";
import { gameModeOf } from "../rules/gameMode";
import { seasonRules } from "../rules/rulesHistory";
import { logFailure } from "../shared/errors";
import { clubsByCode, hasLeft, playerByCode } from "../shared/players";
import { MINUTE_MS } from "../shared/time";
import { starsLookup } from "../stars/playerStars";
import { notFiledLetter, playerLeftLetter, REPORT_MAX_TOKENS, REPORT_SYSTEM, reportInLetter, reportPrompt, type ScoutBrief } from "./scoutWords";

// A scout's report (spec/19, The report; #375), written when his 24 hours are up: a few plain
// sentences by Claude, from the player's figures and the team's shape, dated. Once it lands the
// scout is free again and Mail tells the manager it is in, and nothing more. A player who left the
// Premier League while the scout was out gets no report: the scout comes back free, and Mail says
// so (Craig, 6 Nov 2026, on #375). So does one whose report a day of tries couldn't write (#1437).

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
    if (player === null || hasLeft(player)) return { kind: "gone" as const };
    const league = await ctx.db.get("leagues", scout.leagueId);
    if (league === null) throw new Error(`Scout ${scoutId}'s league ${scout.leagueId} doesn't exist`);
    const positions = await (await positionsNow(ctx, league._id))(player.code);
    const clubs = clubsByCode(ctx);
    const club = await clubs(player.clubCode);
    const mode = gameModeOf((await seasonRules(ctx, league._id)).latest);
    const stars = mode.showsStars ? (await starsLookup(ctx, [player.code]))(player.code) : [];
    const lineup = await lineupInGameweek(ctx, league._id, scout.teamId, await shapeGameweek(ctx, league, now));
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
      // A slot whose starter left is still the formation's: the bench fills it (spec/05).
      shape: [...lineup.starters, ...lineup.vacated].map((starter) => ({ position: positionOfSlot(starter), role: roleIn(starter, starter.role).name })),
      matches: (await seasonMatches(ctx, league, player, positions, clubs)).map((match) => ({
        ...opponentOf(match),
        minutes: match.minutes,
        points: match.points.map(({ position, total }) => ({ position, total })),
      })),
      fixtures: (await nextFixtures(ctx, player.clubCode, now, clubs)).map((fixture) => ({ ...opponentOf(fixture), gameweek: fixture.gameweek })),
    };
    return { kind: "brief" as const, prompt: reportPrompt(facts, mode) };
  },
});

/** The gameweek whose lineup gives the manager's formation: the one a save at `now` goes to, as
 *  every other screen reads it, or the league's last played once its season is over. */
async function shapeGameweek(ctx: QueryCtx, league: Doc<"leagues">, now: number): Promise<number> {
  const next = await saveGameweekOf(ctx, league._id, now);
  return next.kind === "open" ? next.gameweek : lastPlayedGameweek(league, await seasonGameweekCount(ctx));
}

/** Writes the scout's report when his 24 hours are up (scheduled by scouts.ts's `send`): Claude
 *  writes it from `brief`, and it lands; or the player has left, and the scout comes back with none.
 *  A failed write is logged, kept on the scout's row and tried again CLAUDE_RETRY_MS later, up to
 *  CLAUDE_TRIES_MOST tries. */
export const write = internalAction({
  args: { scoutId: v.id("scouts") },
  returns: v.null(),
  handler: async (ctx, { scoutId }) => {
    let text: string | null;
    try {
      // The brief is read inside the try: one that throws is a failed write too, kept and tried again,
      // never a scout left out for good.
      const facts = await ctx.runQuery(internal.scouting.scoutReports.brief, { scoutId, now: Date.now() });
      if (facts === null) return null;
      text = facts.kind === "gone" ? null : await writeWithClaude({ system: REPORT_SYSTEM, prompt: facts.prompt, maxTokens: REPORT_MAX_TOKENS });
    } catch (error) {
      const failure = logFailure(`Scout ${scoutId}'s report wasn't written; trying again in ${CLAUDE_RETRY_MS / MINUTE_MS} minutes`, error);
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
    const playerName = await scoutedName(ctx, scout);
    if (text === null) await ctx.db.patch("scouts", scoutId, { state: "playerLeft" });
    else await ctx.db.patch("scouts", scoutId, { state: "reported", report: { text, writtenAt: Date.now() } });
    await tellManager(ctx, scout, text === null ? playerLeftLetter(playerName) : reportInLetter(playerName));
    return null;
  },
});

/** Keeps a failed write on the scout's row and tries again CLAUDE_RETRY_MS later, while tries are
 *  left. After the last, the scout comes back free with no report, and Mail tells the manager
 *  (Craig, 12 Nov 2026, on #1437: "Retry a day, then tell him"). */
export const failed = internalMutation({
  args: { scoutId: v.id("scouts"), failure: v.string() },
  returns: v.null(),
  handler: async (ctx, { scoutId, failure }) => {
    const scout = await ctx.db.get("scouts", scoutId);
    if (scout === null || scout.state !== "out") return null;
    const failedTries = (scout.failedTries ?? 0) + 1;
    if (failedTries < CLAUDE_TRIES_MOST) {
      await ctx.db.patch("scouts", scoutId, { failedTries, lastFailure: failure });
      await ctx.scheduler.runAfter(CLAUDE_RETRY_MS, internal.scouting.scoutReports.write, { scoutId });
      return null;
    }
    await ctx.db.patch("scouts", scoutId, { failedTries, lastFailure: failure, state: "notFiled" });
    await tellManager(ctx, scout, notFiledLetter(await scoutedName(ctx, scout)));
    return null;
  },
});

/** The scouted player's name for a letter, or his code once the football data no longer holds him. */
async function scoutedName(ctx: QueryCtx, scout: Doc<"scouts">): Promise<string> {
  return (await playerByCode(ctx, scout.playerCode))?.name ?? `player ${scout.playerCode}`;
}

/** Files the letter to the team's manager alone: no other team can tell whom it scouts. A team
 *  with no manager gets none. */
async function tellManager(ctx: MutationCtx, scout: Doc<"scouts">, letter: { subject: string; body: string }): Promise<void> {
  const league = await ctx.db.get("leagues", scout.leagueId);
  const team = await ctx.db.get("teams", scout.teamId);
  if (league === null || team === null) throw new Error(`Scout ${scout._id}'s league or team doesn't exist`);
  if (team.managerEmail === undefined) return;
  await fileLetter(ctx, league, [team.managerEmail], letter);
}
