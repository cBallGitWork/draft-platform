import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { draftIsLive } from "../draft/draftRow";
import type { LeagueDeadlines } from "../gameweeks/deadline";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { leagueOpens } from "../leagues/leagueOpens";
import { MOST_IN_SQUAD } from "../leagues/leagueLimits";
import { pickFirstLineupAgain } from "../lineup/lineups";
import { claimFailedLetter, type ClaimFailure } from "../mail/waiverLetterWords";
import { fileEvent, fileLetter, recordEvent } from "../mail/letters";
import type { LeagueRules } from "../rules/leagueRulesShape";
import { latestRules, seasonRules } from "../rules/rulesHistory";
import { LEAGUES_READ_MOST, takeAllOrThrow } from "../shared/cappedRead";
import { tellShortlisters, tellShortlistersCleared } from "../scouting/shortlist";
import { teamIn } from "../shared/leagueAccess";
import { MINUTE_MS } from "../shared/time";
import { placeOf, squadOf } from "../squads/squadPlace";
import { limitsBroken, type SquadWarning } from "../squads/squads";
import { closeOffersHolding, reviewHolding } from "../trades/tradeClose";
import { claimedName, leagueClaims } from "./waiverClaims";
import { inWaiverLock, latestBegun } from "./waiverLock";
import { waiverOrderOf, waiverOrderRow, winnersNow, withWinnersLast, wonBy } from "./waiverOrder";
import { dropFromSquad } from "./waiverPlayers";
import { latestRunAt } from "./waiverTimes";

// The waiver run (#1198, spec/08 Waivers and free agency). At each of the league's run times
// (waiverTimes.ts) every player on waivers whose 24 hours are up is claimed in the waiver order
// (waiverOrder.ts): the team at the top has its first claim still standing tried; one that
// succeeds sends the team to the bottom for the rest of the run and after, and one that fails is
// gone, its manager told why, and the team's next is tried. A claim fails if another team got the
// player first, if the player he named to drop is no longer his or is held in a trade under review
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
  const keyOf = (warning: SquadWarning) =>
    warning.kind === "overClubMaximum" ? `club ${warning.clubShortName}` : warning.kind === "underAreaMinimum" ? `area ${warning.area}` : warning.kind;
  const was = new Map(before.map((warning) => [keyOf(warning), warning.players]));
  return after.some((warning) => {
    if (warning.kind === "underMinimum") return false;
    const players = was.get(keyOf(warning));
    if (players === undefined) return true;
    return warning.kind === "underAreaMinimum" ? warning.players < players : warning.players > players;
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
  const after = [...squad.filter((code) => code !== dropCode), playerCode];
  if (after.length > MOST_IN_SQUAD) return true;
  const [before, broken] = await Promise.all([limitsBroken(ctx, leagueId, squad, squadRules), limitsBroken(ctx, leagueId, after, squadRules)]);
  return breaksLimits(before, broken);
}

type Tried = { won: true; toWaivers: boolean | null } | { won: false; why: ClaimFailure };

/** Everything a claim at the run is tried against. */
type Run = {
  league: Doc<"leagues">;
  squadRules: LeagueRules["squad"];
  deadlines: LeagueDeadlines;
  now: number;
  /** The players this run may take, by code: on waivers with their 24 hours up, and not yet taken. */
  claimable: Map<number, Doc<"waiverPlayers">>;
};

/** Tries the claim for its team, making it if it stands. */
async function tryClaim(ctx: MutationCtx, run: Run, claim: Doc<"waiverClaims">): Promise<Tried> {
  const { league, squadRules, deadlines, now, claimable } = run;
  const onWaivers = claimable.get(claim.playerCode);
  if (onWaivers === undefined) return { won: false, why: "ahead" };
  const drop = claim.dropCode === null ? null : await placeOf(ctx, league._id, claim.dropCode);
  if (claim.dropCode !== null && drop?.teamId !== claim.teamId) return { won: false, why: "dropGone" };
  if (claim.dropCode !== null && (await reviewHolding(ctx, league._id, claim.dropCode)) !== null) return { won: false, why: "dropHeld" };
  if (await joiningBreaksLimits(ctx, league._id, claim.teamId, claim.playerCode, claim.dropCode, squadRules)) return { won: false, why: "limits" };

  claimable.delete(claim.playerCode);
  await ctx.db.delete("waiverPlayers", onWaivers._id);
  const toWaivers = drop === null ? null : await dropFromSquad(ctx, drop, deadlines, now);
  await ctx.db.insert("squadPlayers", { leagueId: league._id, teamId: claim.teamId, playerCode: claim.playerCode });
  return { won: true, toWaivers };
}

/** Files what a tried claim did: the drop and the claim as squad moves, the league's letter for
 *  one that won, and its manager's alone for one that failed. */
async function report(ctx: MutationCtx, league: Doc<"leagues">, claim: Doc<"waiverClaims">, tried: Tried): Promise<void> {
  const playerName = await claimedName(ctx, claim.playerCode);
  const dropName = claim.dropCode === null ? null : await claimedName(ctx, claim.dropCode);
  if (!tried.won) {
    await fileLetter(ctx, league, [claim.by], claimFailedLetter({ playerName, dropName, why: tried.why }));
    return;
  }
  const team = await teamIn(ctx, league._id, claim.teamId);
  const onTeam = { teamId: team._id, teamName: team.name };
  const dropped =
    claim.dropCode === null || dropName === null || tried.toWaivers === null
      ? null
      : { playerCode: claim.dropCode, playerName: dropName, toWaivers: tried.toWaivers };
  if (dropped !== null) {
    await fileEvent(ctx, league._id, claim.by, { kind: "playerDropped", ...dropped, ...onTeam });
    await closeOffersHolding(ctx, league._id, team._id, [dropped.playerCode]);
    const player = { code: dropped.playerCode, name: dropped.playerName };
    await tellShortlisters(ctx, league, player, team, claim.by, { released: false, toWaivers: dropped.toWaivers }, { unread: true });
  }
  await recordEvent(ctx, league._id, claim.by, { kind: "playerClaimed", playerCode: claim.playerCode, playerName, ...onTeam, dropped }, { unread: true });
  await pickFirstLineupAgain(ctx, league._id, team._id);
}

/** Runs the league's waivers for its run time `at`, once: skipped in the lock or while the draft
 *  is live. */
async function runWaivers(ctx: MutationCtx, leagueId: Id<"leagues">, at: number): Promise<void> {
  const league = await ctx.db.get("leagues", leagueId);
  const held = await waiverOrderRow(ctx, leagueId);
  if (league === null || !leagueOpens(league) || (held !== null && at <= held.ranAt)) return;
  const season = await seasonRules(ctx, leagueId);
  // runDue starts a run only for a league with rules, so none here is a fault, never a quiet skip.
  if (season === null) throw new Error(`League ${leagueId}'s rules can't be read, so its waiver run at ${new Date(at).toISOString()} can't be made`);
  const now = Date.now();
  const deadlines = await leagueDeadlines(ctx, leagueId);
  const gameweek = latestBegun(deadlines, now);
  let winners = winnersNow(season.latest.waivers.order, held, gameweek);
  // A skipped run keeps the last made one's moment: the window opens only with a made run.
  const save = (madeAt = held?.madeAt) =>
    held === null
      ? ctx.db.insert("waiverOrders", { leagueId, winners, gameweek, ranAt: at, madeAt })
      : ctx.db.patch("waiverOrders", held._id, { winners, gameweek, ranAt: at, madeAt });
  if ((await draftIsLive(ctx, leagueId)) || (await inWaiverLock(ctx, deadlines, now))) {
    await save();
    return;
  }

  const onWaivers = await takeAllOrThrow(
    ctx.db.query("waiverPlayers").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId)),
    WAIVER_PLAYERS_READ_MOST,
    `League ${leagueId} has more than ${WAIVER_PLAYERS_READ_MOST} players on waivers, so its run can't read them all`,
  );
  const due = onWaivers.filter(({ claimableFrom }) => claimableFrom <= now);
  const run: Run = { league, squadRules: season.latest.squad, deadlines, now, claimable: new Map(due.map((row) => [row.playerCode, row])) };
  // A run tries every claim but those for a player whose 24 hours aren't up: one for a player no
  // longer on waivers at all, taken by the commissioner say, fails as another team's.
  const waiting = new Set(onWaivers.filter(({ claimableFrom }) => claimableFrom > now).map(({ playerCode }) => playerCode));
  const queues = new Map<Id<"teams">, Doc<"waiverClaims">[]>();
  for (const claim of await leagueClaims(ctx, leagueId)) {
    if (!waiting.has(claim.playerCode)) queues.set(claim.teamId, [...(queues.get(claim.teamId) ?? []), claim]);
  }

  let order = await waiverOrderOf(ctx, league, season, winners);
  for (;;) {
    const team = order.find((teamId) => (queues.get(teamId)?.length ?? 0) > 0);
    if (team === undefined) break;
    const queue = queues.get(team) ?? [];
    for (let claim = queue.shift(); claim !== undefined; claim = queue.shift()) {
      const tried = await tryClaim(ctx, run, claim);
      await ctx.db.delete("waiverClaims", claim._id);
      await report(ctx, league, claim, tried);
      if (tried.won) {
        winners = wonBy(winners, team);
        order = withWinnersLast(order, [team]);
        break;
      }
    }
  }
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

/** The cron's: starts the run of each league whose latest run time has come and not been run. A
 *  league that has never run waivers runs one only if its time came since the last check or so. */
export const runDue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const leagues = await takeAllOrThrow(
      ctx.db.query("leagues"),
      LEAGUES_READ_MOST,
      `More than ${LEAGUES_READ_MOST} leagues are held, so waivers can't be run in every one`,
    );
    for (const league of leagues) {
      if (!leagueOpens(league)) continue;
      // A league made before rules were held (#25) has no run times, so it never runs waivers.
      const rules = await latestRules(ctx, league._id);
      const at = rules === null ? null : latestRunAt(rules.waivers.runs, now);
      if (at === null) continue;
      const held = await waiverOrderRow(ctx, league._id);
      if (held === null ? at <= now - 2 * CHECK_MS : at <= held.ranAt) continue;
      await ctx.scheduler.runAfter(0, internal.waivers.waiverRun.run, { leagueId: league._id, at });
    }
    return null;
  },
});
