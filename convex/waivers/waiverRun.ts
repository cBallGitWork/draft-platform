import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { draftIsOver } from "../draft/draftRow";
import type { LeagueDeadlines } from "../gameweeks/deadline";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { scheduleHeartbeat } from "../heartbeats/heartbeat";
import { leagueOpens } from "../leagues/leagueOpens";
import { MOST_IN_SQUAD } from "../leagues/leagueLimits";
import { pickFirstLineupAgain } from "../lineup/lineups";
import { claimFailedLetter, type ClaimFailure } from "../mail/waiverLetterWords";
import { fileLetter, recordEvent } from "../mail/letters";
import type { LeagueRules } from "../rules/leagueRulesShape";
import { historyOf, newestRow, seasonRules } from "../rules/rulesHistory";
import { everyLeague, takeAllOrThrow } from "../shared/cappedRead";
import { tellShortlistersCleared } from "../scouting/shortlist";
import { teamIn } from "../shared/leagueAccess";
import { playerByCode } from "../shared/players";
import { readOnce } from "../shared/readOnce";
import { MINUTE_MS } from "../shared/time";
import { placeOf, squadOf } from "../squads/squadPlace";
import { limitsReader, type LimitsBroken, type SquadWarning } from "../squads/squads";
import { heldInReview } from "../trades/tradeClose";
import { claimedName, leagueClaims } from "./waiverClaims";
import { latestEnded, runInWaiverLock } from "./waiverLock";
import { waiverOrderOf, waiverOrderRow, winnersNow, withWinnersLast, wonBy } from "./waiverOrder";
import { dropAndTell } from "./waiverPlayers";
import { latestRunAt, wasRunTime } from "./waiverTimes";

// The waiver run (#1198, spec/08 Waivers and free agency). At each of the league's run times
// (waiverTimes.ts) every player on waivers whose 24 hours are up is claimed in the waiver order
// (waiverOrder.ts): the team at the top has its first claim still standing tried; one that
// succeeds sends the team to the bottom for the rest of the run and after, and one that fails is
// gone, its manager told why, and the team's next is tried. A claim fails if another team got the
// player first, if the player has left the Premier League (#1327), if the player he named to drop is no longer his or is held in a trade under review
// (../trades/, Craig, 6 Nov 2026), or if it would break the squad's
// limits. A player nobody claims is a free agent straight after, and each manager whose shortlist
// holds him is told (../scouting/shortlist.ts). A run that falls from the deadline
// until the gameweek's last match is over, or while the draft is live, is skipped. One internal
// function, `run`, makes a run, for the cron here and for any later caller.

/** How often the cron looks for a league whose run time has come: Claude's choice, so a run is at
 *  most this late. */
export const WAIVER_CHECK_EVERY = { minutes: 5 } as const;
const CHECK_MS = WAIVER_CHECK_EVERY.minutes * MINUTE_MS;

/** The most players on waivers in one league one run reads: Claude's sizing, far above a week's
 *  drops and new Premier League players. Past it the run throws rather than leave some out. */
export const WAIVER_PLAYERS_READ_MOST = 2000;

/** Whether the claim's squad breaks a limit the squad before it didn't, or breaks one further:
 *  more over the squad's or a club's maximum, or fewer filling an area's minimum. A claim never
 *  shrinks a squad, so being under its minimum size is never the claim's doing. Pure. */
export function breaksLimits(before: readonly SquadWarning[], after: readonly SquadWarning[]): boolean {
  return newlyBroken(before, after).some((warning) => warning.kind !== "underMinimum");
}

/** The limits the squad after a change breaks that the squad before didn't, or breaks further:
 *  more over a maximum, or fewer filling a minimum. A trade's warnings (../trades/tradeReview.ts). Pure. */
export function newlyBroken(before: readonly SquadWarning[], after: readonly SquadWarning[]): SquadWarning[] {
  const keyOf = (warning: SquadWarning) =>
    warning.kind === "overClubMaximum" ? `club ${warning.clubShortName}` : warning.kind === "underAreaMinimum" ? `area ${warning.area}` : warning.kind;
  const was = new Map(before.map((warning) => [keyOf(warning), warning.players]));
  return after.filter((warning) => {
    const players = was.get(keyOf(warning));
    if (players === undefined) return true;
    return warning.kind === "underAreaMinimum" || warning.kind === "underMinimum" ? warning.players < players : warning.players > players;
  });
}

/** Whether the player joining the team, `dropCode` going for him if anyone, would break the
 *  squad's limits (`breaksLimits`) or the platform's most in a squad: a claim at the run, or a
 *  free agent pickup (freeAgents.ts). */
export async function joiningBreaksLimits(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  teamId: Id<"teams">,
  playerCode: number,
  dropCode: number | null,
  squadRules: LeagueRules["squad"] | null,
): Promise<boolean> {
  const squad = (await squadOf(ctx, teamId)).map((row) => row.playerCode);
  return joinBreaks(squad, playerCode, dropCode, await limitsReader(ctx, leagueId, squadRules));
}

/** `joiningBreaksLimits` for the squad `squad`, its limits read by `limits`. */
async function joinBreaks(squad: readonly number[], playerCode: number, dropCode: number | null, limits: LimitsBroken): Promise<boolean> {
  const after = [...squad.filter((code) => code !== dropCode), playerCode];
  if (after.length > MOST_IN_SQUAD) return true;
  const [before, broken] = await Promise.all([limits(squad), limits(after)]);
  return breaksLimits(before, broken);
}

/** A failed claim's `why` is null when its team already holds the player, won by its own earlier
 *  claim this run or put there by the commissioner: it goes quietly, with no letter (Craig, 11 Nov
 *  2026, #1465). */
type Tried = { won: true; toWaivers: boolean | null } | { won: false; why: ClaimFailure | null };

/** Everything a claim at the run is tried against. */
type Run = {
  league: Doc<"leagues">;
  /** The league's squad limits, each player's club and positions read once for the run (#1538). */
  limits: LimitsBroken;
  deadlines: LeagueDeadlines;
  now: number;
  /** The run's own time, which a claim's drop starts its 24 hours from (#1481). */
  at: number;
  /** The players this run may take, by code: on waivers with their 24 hours up, and not yet taken. */
  claimable: Map<number, Doc<"waiverPlayers">>;
  /** The players in a trade in review, by code, read once for the run: none can be dropped. */
  held: Set<number>;
  /** Each team's squad by code, read once for the run at its first claim and kept up as its claims
   *  win (#1538): nothing else in a run changes a squad. */
  squads: Map<Id<"teams">, number[]>;
  /** Each player's row and name, read once for the run however many claims name him (#1538). */
  playerOf: (code: number) => Promise<Doc<"players"> | null>;
  nameOf: (code: number) => Promise<string>;
};

/** The team's squad by code, as the run has it. */
async function squadInRun(ctx: QueryCtx, run: Run, teamId: Id<"teams">): Promise<number[]> {
  const kept = run.squads.get(teamId);
  if (kept !== undefined) return kept;
  const squad = (await squadOf(ctx, teamId)).map((row) => row.playerCode);
  run.squads.set(teamId, squad);
  return squad;
}

/** Tries the claim for its team, making it if it stands. */
async function tryClaim(ctx: MutationCtx, run: Run, claim: Doc<"waiverClaims">): Promise<Tried> {
  const { league, limits, deadlines, now, at, claimable, held } = run;
  const squad = await squadInRun(ctx, run, claim.teamId);
  const onWaivers = claimable.get(claim.playerCode);
  if (onWaivers === undefined) return { won: false, why: squad.includes(claim.playerCode) ? null : "ahead" };
  if ((await run.playerOf(claim.playerCode))?.droppedAt !== undefined) return { won: false, why: "playerGone" };
  if (claim.dropCode !== null && !squad.includes(claim.dropCode)) return { won: false, why: "dropGone" };
  if (claim.dropCode !== null && held.has(claim.dropCode)) return { won: false, why: "dropHeld" };
  if (await joinBreaks(squad, claim.playerCode, claim.dropCode, limits)) return { won: false, why: "limits" };

  claimable.delete(claim.playerCode);
  await ctx.db.delete("waiverPlayers", onWaivers._id);
  const drop = claim.dropCode === null ? null : await placeOf(ctx, league._id, claim.dropCode);
  if (claim.dropCode !== null && drop?.teamId !== claim.teamId) throw new Error(`The run has ${claim.dropCode} in team ${claim.teamId}'s squad, but he isn't there`);
  // The claim's own letter, from `report`, carries the drop: the run made it, so its copies go unread.
  const told = { deadlines, now, waiversFrom: at, letter: false, unread: true };
  const toWaivers =
    drop === null
      ? null
      : await dropAndTell(ctx, league, await teamIn(ctx, league._id, claim.teamId), drop, { code: drop.playerCode, name: await run.nameOf(drop.playerCode) }, claim.by, told);
  await ctx.db.insert("squadPlayers", { leagueId: league._id, teamId: claim.teamId, playerCode: claim.playerCode });
  run.squads.set(claim.teamId, [...squad.filter((code) => code !== claim.dropCode), claim.playerCode]);
  return { won: true, toWaivers };
}

/** Files what a tried claim did, its drop told already (`tryClaim`): the claim as a squad move, the
 *  league's letter for one that won, and its manager's alone for one that failed, unless it failed quietly. */
async function report(ctx: MutationCtx, { league, nameOf }: Run, claim: Doc<"waiverClaims">, tried: Tried): Promise<void> {
  const playerName = await nameOf(claim.playerCode);
  const dropName = claim.dropCode === null ? null : await nameOf(claim.dropCode);
  if (!tried.won) {
    if (tried.why !== null) await fileLetter(ctx, league, [claim.by], claimFailedLetter({ playerName, dropName, why: tried.why }));
    return;
  }
  const team = await teamIn(ctx, league._id, claim.teamId);
  const onTeam = { teamId: team._id, teamName: team.name };
  const dropped =
    claim.dropCode === null || dropName === null || tried.toWaivers === null
      ? null
      : { playerCode: claim.dropCode, playerName: dropName, toWaivers: tried.toWaivers };
  await recordEvent(ctx, league._id, claim.by, { kind: "playerClaimed", playerCode: claim.playerCode, playerName, ...onTeam, dropped }, { unread: true });
}

/** Runs the league's waivers for its run time `at`, once: skipped in the lock or until the draft
 *  is over (#1326). */
async function runWaivers(ctx: MutationCtx, leagueId: Id<"leagues">, at: number): Promise<void> {
  const league = await ctx.db.get("leagues", leagueId);
  const held = await waiverOrderRow(ctx, leagueId);
  if (league === null || !leagueOpens(league) || (held !== null && at <= held.ranAt)) return;
  const season = await seasonRules(ctx, leagueId);
  const now = Date.now();
  const deadlines = await leagueDeadlines(ctx, leagueId);
  // A run skipped in the lock keeps the winners: they stay at the bottom until the gameweek ends.
  const gameweek = await latestEnded(ctx, deadlines, now);
  let winners = winnersNow(season.latest.waivers.order, held, gameweek);
  // A skipped run keeps the last made one's moment: the window opens only with a made run.
  const save = (madeAt = held?.madeAt) =>
    held === null
      ? ctx.db.insert("waiverOrders", { leagueId, winners, gameweek, ranAt: at, madeAt })
      : ctx.db.patch("waiverOrders", held._id, { winners, gameweek, ranAt: at, madeAt });
  if (!(await draftIsOver(ctx, leagueId)) || (await runInWaiverLock(ctx, deadlines, now, at))) {
    await save();
    return;
  }

  const onWaivers = await takeAllOrThrow(
    ctx.db.query("waiverPlayers").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId)),
    WAIVER_PLAYERS_READ_MOST,
    `League ${leagueId} has more than ${WAIVER_PLAYERS_READ_MOST} players on waivers, so its run can't read them all`,
  );
  // By the run's own time, not the moment it executes: the cron may fire minutes late, and a player
  // whose 24 hours end in those minutes is the next run's, as his claims were told (spec/08).
  const due = onWaivers.filter(({ claimableFrom }) => claimableFrom <= at);
  const run: Run = {
    league,
    limits: await limitsReader(ctx, league._id, season.latest.squad),
    deadlines,
    now,
    at,
    claimable: new Map(due.map((row) => [row.playerCode, row])),
    held: await heldInReview(ctx, league._id),
    squads: new Map(),
    playerOf: readOnce((code: number) => playerByCode(ctx, code)),
    nameOf: readOnce((code: number) => claimedName(ctx, code)),
  };
  // A run tries every claim but those for a player whose 24 hours aren't up: one for a player no
  // longer on waivers at all, taken by the commissioner say, fails as another team's, or quietly
  // if its own team holds him.
  const waiting = new Set(onWaivers.filter(({ claimableFrom }) => claimableFrom > at).map(({ playerCode }) => playerCode));
  const queues = new Map<Id<"teams">, Doc<"waiverClaims">[]>();
  for (const claim of await leagueClaims(ctx, leagueId)) {
    if (!waiting.has(claim.playerCode)) queues.set(claim.teamId, [...(queues.get(claim.teamId) ?? []), claim]);
  }

  let order = await waiverOrderOf(ctx, league, season, winners, gameweek);
  const wonNow = new Set<Id<"teams">>();
  for (;;) {
    const team = order.find((teamId) => (queues.get(teamId)?.length ?? 0) > 0);
    if (team === undefined) break;
    const queue = queues.get(team) ?? [];
    for (let claim = queue.shift(); claim !== undefined; claim = queue.shift()) {
      const tried = await tryClaim(ctx, run, claim);
      await ctx.db.delete("waiverClaims", claim._id);
      await report(ctx, run, claim, tried);
      if (tried.won) {
        winners = wonBy(winners, team);
        order = withWinnersLast(order, [team]);
        wonNow.add(team);
        break;
      }
    }
  }
  // Each team that won picks its first lineup again once, from its squad after all its claims: the
  // run is one transaction, so nobody sees a lineup between them, and once per claim won read
  // too much for a busy run (#1538).
  for (const teamId of wonNow) await pickFirstLineupAgain(ctx, leagueId, teamId);
  // A claim for a team no longer in the league is never tried: it goes with its team.
  for (const [teamId, queue] of queues) {
    if (!order.includes(teamId)) for (const claim of queue) await ctx.db.delete("waiverClaims", claim._id);
  }
  for (const row of run.claimable.values()) await ctx.db.delete("waiverPlayers", row._id);
  await tellShortlistersCleared(ctx, league, [...run.claimable.keys()]);
  await save(at);
}

/** Runs the league's waivers for its run time `at`, unless already run for it. */
export const run = internalMutation({
  args: { leagueId: v.id("leagues"), at: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, at }) => {
    await runWaivers(ctx, leagueId, at);
    return null;
  },
});

/** The cron's: starts the run of each league whose latest run time has come and not been run, if
 *  it was a run time when it came (`wasRunTime`). A league that has never run waivers runs one
 *  only if its time came since the last check or so. */
export const runDue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const leagues = await everyLeague(ctx, "so waivers can't be run in every one");
    for (const league of leagues) {
      if (!leagueOpens(league)) continue;
      const history = await historyOf(ctx, league._id);
      const at = latestRunAt(newestRow(history, league._id).rules.waivers.runs, now);
      if (at === null || !wasRunTime(history, at)) continue;
      const held = await waiverOrderRow(ctx, league._id);
      if (held === null ? at <= now - 2 * CHECK_MS : at <= held.ranAt) continue;
      await ctx.scheduler.runAfter(0, internal.waivers.waiverRun.run, { leagueId: league._id, at });
    }
    await scheduleHeartbeat(ctx, "waiverRuns");
    return null;
  },
});
