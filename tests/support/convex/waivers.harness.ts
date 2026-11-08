// The waiver claim and run tests' shared league (#1198): Ann, Bob and Cat each manage a team, in
// that draft order, so its reverse puts Bob above Ann; Ann holds the 4-4-2 squad; Saka, Palmer and
// Rice are held for claiming; the draft is over; gameweek 4 is over and gameweek 5 still to come.

import { vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { recordPassedDeadlines } from "../../../convex/gameweeks/deadlineRecorder";
import { MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import { holdGameweeks, holdMatchState } from "./leagueRules.harness";
import { actingAs, addManagers, adminCreatesLeague, MANAGERS, teamsIn, type TestConvex } from "./leagues.harness";
import { holdPlayers, holdSquad, passNextDeadline, SQUAD } from "./lineupSquad.harness";
import { fakeResend, signInDeployment } from "./signIn.harness";

export const [ANN, BOB, CAT] = MANAGERS;
/** The gameweek holdGameweeks kicks off next: gameweek 4, a day ago, is the latest begun. */
export const NEXT = 5;
export const [SAKA, PALMER, RICE] = [9001, 9002, 9003];
export const [ANNS_FIRST_DROP, ANNS_SECOND_DROP] = [SQUAD[SQUAD.length - 1], SQUAD[SQUAD.length - 2]];

/** The letters `email` has been sent, oldest first, as their subjects and bodies. */
export const lettersTo = (t: TestConvex, email: string) =>
  t.run(async (ctx) => (await ctx.db.query("letters").withIndex("by_to_and_at", (q) => q.eq("to", email)).collect()).map(({ subject, body }) => ({ subject, body })));

/** The league's draft over: started with no rounds, so no pick is left on the clock. Free agency
 *  and waivers wait for it (#1326). */
export const draftOver = (t: TestConvex, leagueId: Id<"leagues">, teamIds: Id<"teams">[]) =>
  t.run(async (ctx) => {
    await ctx.db.insert("drafts", { leagueId, started: { at: Date.now(), teamIds, rounds: 0 } });
  });

/** The league's draft row gone, as before its commissioner set a start. */
export const noDraft = (t: TestConvex, leagueId: Id<"leagues">) =>
  t.run(async (ctx) => {
    const draft = await ctx.db.query("drafts").withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId)).unique();
    if (draft !== null) await ctx.db.delete("drafts", draft._id);
  });

export async function waiverLeague() {
  const t: TestConvex = await signInDeployment();
  fakeResend();
  const leagueId = await adminCreatesLeague(t);
  const [annsTeam, bobsTeam, catsTeam] = await addManagers(t, leagueId, [ANN, BOB, CAT]);
  const teams = (await teamsIn(t, leagueId)).map(({ _id }) => _id);
  const others = teams.filter((id) => ![annsTeam, bobsTeam, catsTeam].includes(id));
  await t.run((ctx) => ctx.db.patch("leagues", leagueId, { draftOrder: [annsTeam, bobsTeam, catsTeam, ...others] }));
  await holdGameweeks(t, { next: NEXT });

  /** The gameweek's one match (holdGameweeks gives each gameweek one, coded by its number) at `state`. */
  const matchIs = (gameweek: number, state: "live" | "fullTime") => holdMatchState(t, gameweek, state);
  await matchIs(NEXT - 1, "fullTime");
  await holdSquad(t, leagueId, annsTeam);
  await holdPlayers(t, [SAKA, PALMER, RICE]);
  await draftOver(t, leagueId, teams);

  return {
    t,
    leagueId,
    teams,
    annsTeam,
    bobsTeam,
    catsTeam,
    matchIs,
    /** `codes` on waivers, a run able to take them from `from` (now unless given). */
    onWaivers: (codes: readonly number[], from = Date.now()) =>
      t.run(async (ctx) => {
        for (const playerCode of codes) await ctx.db.insert("waiverPlayers", { leagueId, playerCode, claimableFrom: from });
      }),
    claim: async (email: string, playerCode: number, dropCode: number | null = null) =>
      (await actingAs(t, email)).mutation(api.waivers.waiverClaims.putIn, { leagueId, playerCode, dropCode }),
    pending: async (email: string) => (await actingAs(t, email)).query(api.waivers.waiverClaims.pending, { leagueId }),
    stateOf: async (playerCode: number) => (await actingAs(t, BOB)).query(api.waivers.waivers.stateOf, { leagueId, playerCode }),
    squadCodes: (teamId: Id<"teams">) =>
      t.run(async (ctx) => (await ctx.db.query("squadPlayers").withIndex("by_teamId", (q) => q.eq("teamId", teamId)).collect()).map(({ playerCode }) => playerCode)),
    lettersTo: (email: string) => lettersTo(t, email),
    /** A minute on, then the league's waivers run for now, as the cron starts them. The clock is
     *  set, never advanced, so no scheduled timer fires. */
    runWaivers: async () => {
      vi.setSystemTime(Date.now() + MINUTE_MS);
      await t.mutation(internal.waivers.waiverRun.run, { leagueId, at: Date.now() });
    },
    /** The gameweek's deadline passed and its match over: it has begun and ended. NEXT first, then
     *  each after it a week on. */
    gameweekEnds: async (gameweek: number) => {
      if (gameweek === NEXT) await passNextDeadline(t);
      else {
        vi.setSystemTime(Date.now() + WEEK_MS);
        await t.run((ctx) => recordPassedDeadlines(ctx));
      }
      await matchIs(gameweek, "fullTime");
    },
  };
}
export type WaiverLeague = Awaited<ReturnType<typeof waiverLeague>>;
