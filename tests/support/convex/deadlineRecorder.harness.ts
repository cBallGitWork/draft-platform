// The deadline recorder's tests' shared setup (#150, #748): a signed-in deployment with a league and
// FPL's recorded whole season synced, gameweek 8's opener and how to postpone it, and the reads of
// what the recorder left.

import { beforeEach } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { recordPassedDeadlines } from "../../../convex/gameweeks/deadlineRecorder";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { MINUTE_MS } from "../../../convex/shared/time";
import { recordedSeason } from "../recorded/fpl.payloads";
import { syncWith } from "./footballSync.harness";
import { setUsed } from "./leagueRules.harness";
import { actingAs, adminCreatesLeague, COMMISSIONER, type TestConvex } from "./leagues.harness";
import { fakeResend, signInDeployment } from "./signIn.harness";

/** Gameweek 8 in FPL's recorded season, its matches all after the harness's clock starts. */
export const GAMEWEEK = 8;
/** FPL's recorded whole season, synced before each test. */
export const payloads = recordedSeason();
export const kickoffsOf = (gameweek: number) =>
  payloads.fixtures.flatMap((fixture) => (fixture.event === gameweek && fixture.kickoff_time !== null ? [Date.parse(fixture.kickoff_time)] : [])).toSorted((a, b) => a - b);
export const [OPENER, SECOND] = kickoffsOf(GAMEWEEK);
/** The first rules' deadline, before a kickoff. */
export const deadlineBefore = (kickoff: number) => kickoff - FIRST_RULES.deadline.minutesBeforeFirstKickoff * MINUTE_MS;

/** FPL's season with gameweek 8's opener postponed, as FPL sends one: no gameweek, no kickoff. */
export function openerPostponed() {
  const moved = recordedSeason();
  const opener = moved.fixtures.find((fixture) => fixture.event === GAMEWEEK && fixture.kickoff_time !== null && Date.parse(fixture.kickoff_time) === OPENER)!;
  opener.event = null;
  opener.kickoff_time = null;
  return moved;
}

/** The test's deployment and its league, fresh for each test once `useDeadlineRecorderDeployment` has run. */
export let t: TestConvex;
export let leagueId: Id<"leagues">;

/** Gives each test of the file a fresh deployment with a league, and FPL's recorded season synced. */
export function useDeadlineRecorderDeployment(): void {
  beforeEach(async () => {
    t = await signInDeployment();
    fakeResend();
    leagueId = await adminCreatesLeague(t);
    await syncWith(t, payloads);
  });
}

export const recordPassed = () => t.run((ctx) => recordPassedDeadlines(ctx));
export const passedRows = () => t.run((ctx) => ctx.db.query("passedDeadlines").collect());
export const shownDeadline = async (gameweek: number) =>
  (await (await actingAs(t, COMMISSIONER)).query(api.gameweeks.leagueGameweeks.ofLeague, { leagueId }))[gameweek - 1].deadline;
export const setUsedIn = (gameweek: number, used: boolean) => setUsed(t, leagueId, gameweek, used);
/** Gameweek 8's opener as held, less its system fields. */
export const heldOpener = () =>
  t.run(async (ctx) => {
    const row = (await ctx.db.query("fixtures").collect()).find((fixture) => fixture.kickoff === OPENER)!;
    const { _id, _creationTime, droppedAt, ...fields } = row;
    return fields;
  });

/** markDropped run on the held fixtures as if the feed had sent every one but gameweek 8's opener. */
export async function markOpenerDropped() {
  const opener = await heldOpener();
  return t.mutation(internal.football.footballSync.markDropped, {
    table: "fixtures",
    sentKeys: payloads.fixtures.map((fixture) => fixture.code).filter((code) => code !== opener.code),
    droppedAt: Date.now(),
    paginationOpts: { cursor: null, numItems: payloads.fixtures.length },
  });
}
