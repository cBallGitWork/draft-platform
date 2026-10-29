import { beforeEach, expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { lineupInGameweek } from "../../../convex/lineup/lineups";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { addManagers, adminCreatesLeague, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { FOUR_FOUR_TWO, holdSquad, passNextDeadline, SQUAD } from "../../support/convex/lineupSquad.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The #637 migration: a team whose squad was made before teams held a first lineup gets one from
// the next gameweek not begun, and a gameweek already begun stays as it was scored.

const [ANN, BOB, CAT] = MANAGERS;
const NEXT = 9;
/** Bob's one player, whose lineup he saved. */
const BOBS = 998;

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
  // Written as squads were before #637: players and no lineup row, but for Bob's, which he saved.
  await holdSquad(t, leagueId, annsTeam);
  await holdSquad(t, leagueId, bobsTeam, [BOBS]);
  await t.run((ctx) => ctx.db.insert("lineups", { leagueId, teamId: bobsTeam, fromGameweek: NEXT, starters: [], bench: [BOBS] }));
  // Gameweek NEXT begins with Ann holding no lineup.
  await passNextDeadline(t);
});

const migrate = () => t.mutation(internal.lineup.firstLineupBackfill.giveTeamsTheirFirstLineup, {});
const lineupOf = (teamId: Id<"teams">, gameweek: number) => t.run((ctx) => lineupInGameweek(ctx, leagueId, teamId, gameweek));
const rowsOf = (teamId: Id<"teams">) => t.run(async (ctx) => (await ctx.db.query("lineups").collect()).filter((row) => row.teamId === teamId));

test("a team with players and no lineup gets its first from the next gameweek not begun; the begun one stays as scored", async () => {
  expect(await migrate()).toEqual({ teamsGiven: [annsTeam] });

  expect(await lineupOf(annsTeam, NEXT + 1)).toMatchObject({ fromGameweek: NEXT + 1, noLineup: false, starters: FOUR_FOUR_TWO.starters, bench: FOUR_FOUR_TWO.bench });
  expect(await lineupOf(annsTeam, NEXT)).toMatchObject({ fromGameweek: null, noLineup: true, starters: [], bench: SQUAD });
  expect(await rowsOf(annsTeam)).toMatchObject([{ fromGameweek: NEXT + 1, firstLineup: true }]);
});

test("a team with a lineup row, or with nobody in its squad, is left alone", async () => {
  const bobsBefore = await rowsOf(bobsTeam);
  await migrate();
  expect(await rowsOf(bobsTeam)).toEqual(bobsBefore);
  expect(await rowsOf(catsTeam)).toEqual([]);
});

test("run again, it gives nobody anything", async () => {
  await migrate();
  const rows = await rowsOf(annsTeam);
  expect(await migrate()).toEqual({ teamsGiven: [] });
  expect(await rowsOf(annsTeam)).toEqual(rows);
});
