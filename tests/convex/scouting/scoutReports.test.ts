import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { positionOfSlot } from "../../../convex/lineup/pitch";
import { roleIn } from "../../../convex/lineup/roles";
import { WEEK_MS } from "../../../convex/shared/time";
import { PL_GAMEWEEKS } from "../../support/convex/footballRows.harness";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { MANAGERS, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { holdPlayers, holdSquad, NEXT, SQUAD_CLUB, STARTERS } from "../../support/convex/lineupSquad.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The manager's formation a scout's report is written from (spec/19, The report; #1738): the
// lineup every other screen reads, through lineups.ts, so a slot whose starter has left the squad
// is still part of it (spec/05: the bench fills it), and once the season is over it is the
// lineup of the league's last gameweek.

const [ANN] = MANAGERS;
/** The free agent the scout is sent to watch. */
const SCOUTED = 999;
/** The other club in holdGameweeks' matches. */
const OPPONENT = { code: 2, name: "Chelsea", shortName: "CHE" };

let t: TestConvex;
let leagueId: Id<"leagues">;
let teamId: Id<"teams">;
let scoutId: Id<"scouts">;
beforeEach(async () => {
  vi.useFakeTimers();
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: NEXT });
  leagueId = await adminCreatesLeague(t);
  [teamId] = (await addManagers(t, leagueId, [ANN])) as [Id<"teams">];
  await holdSquad(t, leagueId, teamId);
  await holdPlayers(t, [SCOUTED]);
  scoutId = await t.run(async (ctx) => {
    for (const club of [SQUAD_CLUB, OPPONENT]) await ctx.db.insert("clubs", club);
    return ctx.db.insert("scouts", { leagueId, teamId, playerCode: SCOUTED, sentAt: Date.now(), dueAt: Date.now(), state: "out" });
  });
});

/** The "Manager's formation" line of the brief's prompt at `now`. */
const formationLine = async () => {
  const brief = await t.query(internal.scouting.scoutReports.brief, { scoutId, now: Date.now() });
  if (brief?.kind !== "brief") throw new Error(`No brief: ${JSON.stringify(brief)}`);
  return brief.prompt.split("\n").find((line) => line.startsWith("Manager's formation:"));
};

/** The line as the team's stored lineup gives it, every starter in his slot and role. */
const storedFormationLine = async () => {
  const row = await t.run((ctx) => ctx.db.query("lineups").withIndex("by_leagueId_and_teamId_and_fromGameweek", (q) => q.eq("leagueId", leagueId).eq("teamId", teamId)).first());
  return `Manager's formation: ${row!.starters.map((starter) => `${positionOfSlot(starter)} as ${roleIn(starter, starter.role).name}`).join(", ")}.`;
};

/** The line's slots, in pitch-free order, to compare with another's. */
const slotsOf = (line: string | undefined) => line?.replace(/^Manager's formation: |\.$/g, "").split(", ").sort();

test("a starter who has left the squad still has his slot and role in the formation", async () => {
  const expected = await storedFormationLine();
  const [dropped] = STARTERS;
  await t.run(async (ctx) => {
    const held = await ctx.db.query("squadPlayers").withIndex("by_teamId", (q) => q.eq("teamId", teamId)).collect();
    await ctx.db.delete("squadPlayers", held.find(({ playerCode }) => playerCode === dropped)!._id);
  });
  // His slot is listed after those still filled, as lineups.ts gives it in `vacated`.
  expect(slotsOf(await formationLine())).toEqual(slotsOf(expected));
});

test("once the season is over, the formation is still the newest lineup's", async () => {
  const expected = await storedFormationLine();
  vi.advanceTimersByTime((PL_GAMEWEEKS - NEXT + 1) * WEEK_MS);
  expect(await formationLine()).toBe(expected);
});
