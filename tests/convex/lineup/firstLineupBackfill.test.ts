import { beforeEach, expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { lineupInGameweek } from "../../../convex/lineup/lineups";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { addManagers, adminCreatesLeague, type TestConvex, ANN, BOB, CAT, DAN } from "../../support/convex/leagues.harness";
import { BOBS, FOUR_FOUR_TWO, holdSquad, NEXT, passNextDeadline, SQUAD } from "../../support/convex/lineupSquad.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The #637 and #1040 migration: every team with players gets a saved lineup and no score moves. A
// team whose squad was made before teams held a first lineup gets one from the next gameweek not
// begun, a gameweek already begun stays as it was scored, and a first lineup becomes saved unless
// the league's draft is still to come.

/** Cat's one player, held on her first lineup. */
const CATS = 997;

let t: TestConvex;
let leagueId: Id<"leagues">;
let annsTeam: Id<"teams">;
let bobsTeam: Id<"teams">;
let catsTeam: Id<"teams">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: NEXT });
  leagueId = await adminCreatesLeague(t);
  [annsTeam, bobsTeam, catsTeam] = await addManagers(t, leagueId, [ANN, BOB, CAT]);
  // Ann's written as squads were before #637: players and no lineup row. Bob saved his; Cat holds
  // the first lineup her squad was given.
  await holdSquad(t, leagueId, annsTeam, SQUAD, { withoutLineup: true });
  await holdSquad(t, leagueId, bobsTeam, [BOBS], { withoutLineup: true });
  await t.run((ctx) => ctx.db.insert("lineups", { leagueId, teamId: bobsTeam, fromGameweek: NEXT, starters: [], bench: [BOBS] }));
  await holdSquad(t, leagueId, catsTeam, [CATS]);
  // Gameweek NEXT begins with Ann holding no lineup.
  await passNextDeadline(t);
});

const migrate = () => t.mutation(internal.lineup.firstLineupBackfill.saveTeamsTheirLineup, {});
const lineupOf = (teamId: Id<"teams">, gameweek: number) => t.run((ctx) => lineupInGameweek(ctx, leagueId, teamId, gameweek));
const rowsOf = (teamId: Id<"teams">) => t.run(async (ctx) => (await ctx.db.query("lineups").collect()).filter((row) => row.teamId === teamId));

test("a team with players and no lineup gets its first, saved, from the next gameweek not begun; the begun one stays as scored", async () => {
  expect(await migrate()).toEqual({ teamsGiven: [annsTeam], teamsSaved: [annsTeam, catsTeam], scoresUnmarked: 0 });

  expect(await lineupOf(annsTeam, NEXT + 1)).toMatchObject({ fromGameweek: NEXT + 1, starters: FOUR_FOUR_TWO.starters, bench: FOUR_FOUR_TWO.bench });
  expect(await lineupOf(annsTeam, NEXT)).toMatchObject({ fromGameweek: null, starters: [], bench: SQUAD });
  expect(await rowsOf(annsTeam)).toMatchObject([{ fromGameweek: NEXT + 1 }]);
  expect((await rowsOf(annsTeam))[0].firstLineup).toBeUndefined();
});

test("a first lineup is saved as it stands, so the lineup it holds doesn't move", async () => {
  const before = await lineupOf(catsTeam, NEXT);
  await migrate();
  expect(await lineupOf(catsTeam, NEXT)).toEqual(before);
  expect((await rowsOf(catsTeam)).map((row) => row.firstLineup)).toEqual([undefined]);
});

test("a saved lineup, or a team with nobody in its squad, is left alone", async () => {
  const [dansTeam] = await addManagers(t, leagueId, [DAN]);
  const bobsBefore = await rowsOf(bobsTeam);
  await migrate();
  expect(await rowsOf(bobsTeam)).toEqual(bobsBefore);
  expect(await rowsOf(dansTeam)).toEqual([]);
});

test("in a league whose draft is still to come, a first lineup stays first, for the draft's end to save", async () => {
  await t.run((ctx) => ctx.db.insert("drafts", { leagueId }));
  await migrate();
  expect((await rowsOf(catsTeam)).map((row) => row.firstLineup)).toEqual([true]);
});

test("a final score marked as held by no lineup loses the mark and keeps its 0", async () => {
  const row = await t.run((ctx) => ctx.db.insert("finalScores", { leagueId, gameweek: NEXT - 1, teamId: annsTeam, points: 0, noLineup: true, fixtureCodes: [], storedAt: 0 }));
  expect((await migrate()).scoresUnmarked).toBe(1);
  const after = await t.run((ctx) => ctx.db.get("finalScores", row));
  expect(after?.points).toBe(0);
  expect(after).not.toHaveProperty("noLineup");
});

test("run again, it does nothing", async () => {
  await migrate();
  const rows = await rowsOf(annsTeam);
  expect(await migrate()).toEqual({ teamsGiven: [], teamsSaved: [], scoresUnmarked: 0 });
  expect(await rowsOf(annsTeam)).toEqual(rows);
});
