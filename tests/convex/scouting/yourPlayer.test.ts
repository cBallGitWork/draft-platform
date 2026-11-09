import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { positionOfSlot, type Cell } from "../../../convex/lineup/pitch";
import type { Position } from "../../../convex/positions/positionTables";
import { refusals } from "../../../convex/shared/leagueAccess";
import { changeEveryRules, holdGameweeks } from "../../support/convex/leagueRules.harness";
import { COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { FOUR_FOUR_TWO, holdSquad, nameOf, SQUAD } from "../../support/convex/lineupSquad.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";

// Whom the selected player's panel on Scouting offers to compare him with (#1028; Craig, 9 Nov
// 2026, on #1028, answers 1 and 4): the manager's starter at his main position in the current
// lineup, else the squad player whose main position it is with the most season points, else
// nobody; and whether the squad is full.

const [ANN] = MANAGERS;
/** A free agent whose positions each test sets. */
const SCOUTED = 999;

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: 9 });
  leagueId = await adminCreatesLeague(t);
  const [annsTeam] = await addManagers(t, leagueId, [ANN]);
  await holdSquad(t, leagueId, annsTeam, SQUAD);
  await t.run((ctx) => ctx.db.insert("players", { code: SCOUTED, name: "Scouted", fullName: "Scouted", clubCode: 1 }));
});

/** `code`'s positions set to `positions` alone. */
const setPositions = (code: number, positions: Position[]) =>
  t.run(async (ctx) => {
    const row = await ctx.db.query("playerPositions").withIndex("by_code", (q) => q.eq("code", code)).unique();
    if (row === null) await ctx.db.insert("playerPositions", { code, starts: [], approved: [], set: positions, removed: [] });
    else await ctx.db.patch("playerPositions", row._id, { set: positions });
  });

const yoursAs = async (email: string, playerCode = SCOUTED) => (await actingAs(t, email)).query(api.scouting.yourPlayer.at, { leagueId, playerCode, now: Date.now() });

/** The 4-4-2's starters, each with his slot's position. */
const starters = FOUR_FOUR_TWO.starters.map((each) => ({ playerCode: each.playerCode, slot: positionOfSlot(each as Cell) }));
/** The first 4-4-2 starter standing in a `position` slot. */
const starterAt = (position: Position) => starters.find(({ slot }) => slot === position)!.playerCode;

test("your starter in a slot of his main position, whatever that starter's own positions", async () => {
  await setPositions(SCOUTED, ["WM", "W"]);
  const code = starterAt("WM");
  expect(await yoursAs(ANN)).toEqual({ player: { position: "WM", code, name: nameOf(code) }, squadFull: false });
});

test("with none starting there, the squad player whose main position it is", async () => {
  await setPositions(SCOUTED, ["CAM"]);
  const benched = FOUR_FOUR_TWO.bench[0];
  await setPositions(benched, ["CAM"]);
  expect((await yoursAs(ANN))?.player).toEqual({ position: "CAM", code: benched, name: nameOf(benched) });
});

test("with nobody at his position, or no position held for him, no player", async () => {
  await setPositions(SCOUTED, ["CAM"]);
  expect((await yoursAs(ANN))?.player).toBeNull();
  await setPositions(SCOUTED, []);
  expect((await yoursAs(ANN))?.player).toBeNull();
});

test("your own player is never compared with himself", async () => {
  const striker = starterAt("ST");
  const other = starters.find(({ slot, playerCode }) => slot === "ST" && playerCode !== striker)!.playerCode;
  expect((await yoursAs(ANN, striker))?.player?.code).toBe(other);
});

test("the squad is full at the league's maximum", async () => {
  await changeEveryRules(t, leagueId, (rules) => ({ ...rules, squad: { ...rules.squad, size: { minimum: 1, maximum: SQUAD.length } } }));
  expect((await yoursAs(ANN))?.squadFull).toBe(true);
});

test("someone running no team gets nothing; someone not in the league is refused", async () => {
  expect(await yoursAs(COMMISSIONER)).toBeNull();
  await expectRefused(yoursAs(MANAGERS[3]), refusals.notInLeague);
});
