import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalAction, internalMutation, internalQuery, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { matchdayMargins } from "../admin/platformSettings";
import { tableGameweek, type TeamGameweekTotal } from "../gameweekScorer/gameweekScores";
import { leagueReads } from "../gameweekScorer/teamGameweek";
import { GAMEWEEKS } from "../gameweeks/usedGameweeks";
import { leagueAverageWords } from "../mail/letterWords";
import { fileLetter, wholeLeague } from "../mail/letters";
import { writeWithClaude } from "../outbound/claude";
import { seasonRules } from "../rules/rulesHistory";
import { recapTeamPoints } from "../schema/recaps";
import { takeAllOrThrow } from "../shared/cappedRead";
import { logFailure } from "../shared/errors";
import { GAMEWEEK_MATCHES_MOST } from "../shared/fixtures";
import { memberOf, teamsOf } from "../shared/leagueAccess";
import { playerByCode } from "../shared/players";
import { MINUTE_MS } from "../shared/time";
import { standingsOf } from "../table/leagueTable";
import { scoredFixtures } from "../table/sentTables";
import { RECAP_MAX_TOKENS, RECAP_PLAYERS, RECAP_SYSTEM, recapPrompt, recapUpLetter, type RecapPlayer } from "./recapWords";

// League home's weekly recap (spec/12, League home; #387). Once every match of a gameweek is final,
// the first time the league stores it final (table/finalScores.ts), Claude writes one recap for the
// league from facts only, about 150 words: the results, three top performers and three letdowns
// from the starting elevens by their points for their team, and each team's points left on the
// bench. Mail tells the whole league it is up. League home shows it until the next gameweek's first
// matchday mode begins, and Read the recap opens it whole. It is written once and never rewritten:
// a score that changes after puts a line under it, linking to that matchup (Craig, 6 Nov 2026).

/** How long after a failed write it is tried again, and the most tries, a day's worth: each failure
 *  is logged and kept on the recap's row, so a lasting one (no API key, say) shows. */
export const RECAP_RETRY_MS = 30 * MINUTE_MS;
export const RECAP_TRIES_MOST = 48;

type TeamId = Id<"teams">;

/** Starts the league's recap of the gameweek, newly stored final, unless it has one already: it is
 *  written once. */
export async function startRecap(ctx: MutationCtx, leagueId: Id<"leagues">, gameweek: number): Promise<void> {
  const held = await recapOf(ctx, leagueId, gameweek);
  if (held !== null) return;
  const recapId = await ctx.db.insert("recaps", { leagueId, gameweek, state: "writing", teamPoints: [] });
  await ctx.scheduler.runAfter(0, internal.home.recaps.write, { recapId });
}

const recapOf = (ctx: QueryCtx, leagueId: Id<"leagues">, gameweek: number) =>
  ctx.db
    .query("recaps")
    .withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId).eq("gameweek", gameweek))
    .unique();

/** What the recap is written from, and each team's points it was written from; null once it is
 *  written. Throws while the gameweek has no score. */
export const brief = internalQuery({
  args: { recapId: v.id("recaps") },
  returns: v.union(v.null(), v.object({ prompt: v.string(), teamPoints: recapTeamPoints })),
  handler: async (ctx, { recapId }) => {
    const recap = await ctx.db.get("recaps", recapId);
    if (recap === null || recap.state !== "writing") return null;
    const league = await ctx.db.get("leagues", recap.leagueId);
    const season = await seasonRules(ctx, recap.leagueId);
    if (league === null) throw new Error(`Recap ${recapId}'s league ${recap.leagueId} doesn't exist`);
    const { gameweek } = recap;
    const { rules, teamIds, schedule, results, named } = await standingsOf(ctx, league, season);
    const scored = results.get(gameweek);
    if (scored === undefined) throw new Error(`League ${league._id} has no score for gameweek ${gameweek}`);
    const drawn = rules.format === "headToHead" ? schedule.find((each) => each.gameweek === gameweek) : undefined;
    const headToHeads = drawn === undefined ? [] : scoredFixtures(drawn, results, named);

    const inGameweek = await tableGameweek(ctx, await leagueReads(ctx, league, season), gameweek, teamIds);
    const starters: RecapPlayer[] = [];
    const teams = [];
    for (const teamId of teamIds) {
      const { team } = await inGameweek.slotsOf(teamId);
      const benchPoints = team.bench.filter((slot) => !slot.counts).reduce((sum, slot) => sum + (slot.points ?? 0), 0);
      teams.push({ team: named(teamId), points: scored.get(teamId)!.points, benchPoints });
      for (const slot of team.starters) {
        if (!slot.counts || slot.points === null) continue;
        const player = await playerByCode(ctx, slot.playerCode);
        starters.push({ player: player?.name ?? `Player ${slot.playerCode}`, team: named(teamId), points: slot.points });
      }
    }
    const { topPerformers, letdowns } = performersOf(starters);
    const prompt = recapPrompt({
      gameweek,
      results: headToHeads.flatMap(({ team, opponent, points }) =>
        points === null ? [] : [{ team, teamPoints: points.team, opponent: opponent ?? leagueAverageWords, opponentPoints: points.opponent }],
      ),
      teams: teams.toSorted((one, other) => other.points - one.points),
      topPerformers,
      letdowns,
    });
    return { prompt, teamPoints: teamIds.map((teamId) => ({ teamId, points: scored.get(teamId)!.points })) };
  },
});

/** The RECAP_PLAYERS starters who scored most for their team, and the RECAP_PLAYERS who scored least
 *  among the rest; ties by name, so the same facts always pick the same men. */
export function performersOf(starters: readonly RecapPlayer[]): { topPerformers: RecapPlayer[]; letdowns: RecapPlayer[] } {
  const ranked = starters.toSorted((one, other) => other.points - one.points || one.player.localeCompare(other.player));
  const topPerformers = ranked.slice(0, RECAP_PLAYERS);
  const letdowns = ranked.slice(RECAP_PLAYERS).reverse().slice(0, RECAP_PLAYERS);
  return { topPerformers, letdowns };
}

/** Writes the recap (scheduled by `startRecap`): Claude writes it from `brief`, and it lands. A
 *  failed write is logged, kept on the recap's row and tried again RECAP_RETRY_MS later, up to
 *  RECAP_TRIES_MOST tries. */
export const write = internalAction({
  args: { recapId: v.id("recaps") },
  returns: v.null(),
  handler: async (ctx, { recapId }) => {
    let written: { text: string; teamPoints: Infer<typeof recapTeamPoints> };
    try {
      const facts = await ctx.runQuery(internal.home.recaps.brief, { recapId });
      if (facts === null) return null;
      written = { text: await writeWithClaude({ system: RECAP_SYSTEM, prompt: facts.prompt, maxTokens: RECAP_MAX_TOKENS }), teamPoints: facts.teamPoints };
    } catch (error) {
      const failure = logFailure(`Recap ${recapId} wasn't written; trying again in ${RECAP_RETRY_MS / MINUTE_MS} minutes`, error);
      await ctx.runMutation(internal.home.recaps.failed, { recapId, failure });
      return null;
    }
    await ctx.runMutation(internal.home.recaps.landed, { recapId, ...written });
    return null;
  },
});

/** The recap is written, and Mail tells the whole league it is up. Nothing for one written already. */
export const landed = internalMutation({
  args: { recapId: v.id("recaps"), text: v.string(), teamPoints: recapTeamPoints },
  returns: v.null(),
  handler: async (ctx, { recapId, text, teamPoints }) => {
    const recap = await ctx.db.get("recaps", recapId);
    if (recap === null || recap.state !== "writing") return null;
    const league = await ctx.db.get("leagues", recap.leagueId);
    if (league === null) throw new Error(`Recap ${recapId}'s league ${recap.leagueId} doesn't exist`);
    await ctx.db.patch("recaps", recapId, { state: "written", text, writtenAt: Date.now(), teamPoints });
    await fileLetter(ctx, league, await wholeLeague(ctx, league), recapUpLetter(recap.gameweek));
    return null;
  },
});

/** Keeps a failed write on the recap's row and tries again RECAP_RETRY_MS later, while tries are
 *  left. */
export const failed = internalMutation({
  args: { recapId: v.id("recaps"), failure: v.string() },
  returns: v.null(),
  handler: async (ctx, { recapId, failure }) => {
    const recap = await ctx.db.get("recaps", recapId);
    if (recap === null || recap.state !== "writing") return null;
    const failedTries = (recap.failedTries ?? 0) + 1;
    await ctx.db.patch("recaps", recapId, { failedTries, lastFailure: failure });
    if (failedTries < RECAP_TRIES_MOST) await ctx.scheduler.runAfter(RECAP_RETRY_MS, internal.home.recaps.write, { recapId });
    return null;
  },
});

export const shownRecap = v.object({
  gameweek: v.number(),
  text: v.string(),
  writtenAt: v.number(),
  /** A team whose score has changed since the recap was written, for the line under it linking to
   *  its matchup; null while none has. */
  changedTeamId: v.union(v.id("teams"), v.null()),
});

/** The first team whose points now differ from those the recap was written from, or null. */
async function changedTeam(recap: Doc<"recaps">, pointsOf: (teamId: TeamId) => Promise<TeamGameweekTotal | undefined>): Promise<TeamId | null> {
  for (const { teamId, points } of recap.teamPoints) {
    const now = await pointsOf(teamId);
    if (now !== undefined && now.points !== points) return teamId;
  }
  return null;
}

function shown(recap: Doc<"recaps">, changedTeamId: TeamId | null) {
  return { gameweek: recap.gameweek, text: recap.text!, writtenAt: recap.writtenAt!, changedTeamId };
}

/** The recap League home shows at `now`: the league's latest written, until the next gameweek's
 *  first matchday mode begins; null with none. `results` are the league's scores, the table's. */
export async function homeRecap(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  results: ReadonlyMap<number, ReadonlyMap<TeamId, TeamGameweekTotal>>,
  now: number,
): Promise<ReturnType<typeof shown> | null> {
  let latest: Doc<"recaps"> | null = null;
  for await (const recap of ctx.db.query("recaps").withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId)).order("desc")) {
    if (recap.state === "written") {
      latest = recap;
      break;
    }
  }
  if (latest === null || now >= (await nextMatchdayStart(ctx, latest.gameweek))) return null;
  return shown(latest, await changedTeam(latest, async (teamId) => results.get(latest.gameweek)?.get(teamId)));
}

/** When the first matchday mode of the next gameweek after `gameweek` with a match on begins:
 *  `beforeMs` before its first kickoff (matchday.ts). Never, with none. */
async function nextMatchdayStart(ctx: QueryCtx, gameweek: number): Promise<number> {
  for (let next = gameweek + 1; next <= GAMEWEEKS; next++) {
    const fixtures = await takeAllOrThrow(
      ctx.db.query("fixtures").withIndex("by_gameweek_and_droppedAt", (q) => q.eq("gameweek", next).eq("droppedAt", undefined)),
      GAMEWEEK_MATCHES_MOST,
      `Gameweek ${next} holds more than ${GAMEWEEK_MATCHES_MOST} matches, so its first kickoff may be missed`,
    );
    const kickoffs = fixtures.flatMap(({ kickoff }) => (kickoff === null ? [] : [kickoff]));
    if (kickoffs.length > 0) return Math.min(...kickoffs) - (await matchdayMargins(ctx)).beforeMs;
  }
  return Infinity;
}

/** The league's recap of the gameweek, whole, for Read the recap; null while there is none. For
 *  anyone with a part in the league. */
export const ofGameweek = query({
  args: { leagueId: v.id("leagues"), gameweek: v.number() },
  returns: v.union(shownRecap, v.null()),
  handler: async (ctx, { leagueId, gameweek }) => {
    const { league } = await memberOf(ctx, leagueId);
    const recap = await recapOf(ctx, leagueId, gameweek);
    if (recap === null || recap.state !== "written") return null;
    const season = await seasonRules(ctx, leagueId);
    const teamIds = (await teamsOf(ctx, leagueId)).map((team) => team._id);
    const inGameweek = await tableGameweek(ctx, await leagueReads(ctx, league, season), gameweek, teamIds);
    const held = new Set(teamIds);
    return shown(recap, await changedTeam(recap, async (teamId) => (held.has(teamId) ? inGameweek.pointsOf(teamId) : undefined)));
  },
});
