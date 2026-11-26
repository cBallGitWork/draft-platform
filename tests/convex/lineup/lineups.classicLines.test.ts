import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Lineup } from "../../../convex/lineup/lineup";
import { problemWords } from "../../../convex/lineup/lineupWords";
import { lineupInGameweek } from "../../../convex/lineup/lineups";
import { setLines } from "../../support/convex/footballRows.harness";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { actingAs, ANN, freshLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { FOUR_FOUR_TWO, holdSquad, nameOf, NEXT, saved, sent } from "../../support/convex/lineupSquad.harness";

// Saving a classic league's lineup (spec/22, The lineup): it stands on each starter's line inside
// the league's line limits alone, whatever cell he is put in (`S22.8`, `S22.9`).

let t: TestConvex;
let leagueId: Id<"leagues">;
let annsTeam: Id<"teams">;
beforeEach(async () => {
  ({ t, leagueId, teams: [annsTeam] } = await freshLeague({ managers: [ANN], classic: true, before: (t) => holdGameweeks(t, { next: NEXT }) }));
  await holdSquad(t, leagueId, annsTeam);
  // The 4-4-2's men: GK, four DEF, four CM and two FWD.
  await t.run((ctx) => setLines(ctx));
});

const save = async (lineup: Lineup) => (await actingAs(t, ANN)).mutation(api.lineup.lineups.save, { leagueId, lineup: sent(lineup) });

const inArea = (area: string) => FOUR_FOUR_TWO.starters.filter((starter) => starter.area === area);
const [defender] = inArea("defence");
const [striker] = inArea("attack");
const [oneMidfielder, otherMidfielder] = inArea("midfield");

test("S22.8 any eleven whose lines sit inside the limits stand: a defender and a striker swapped into each other's cells are saved, as no cell or position is read", async () => {
  const swapped: Lineup = {
    ...FOUR_FOUR_TWO,
    starters: FOUR_FOUR_TWO.starters.map((starter) => {
      if (starter === striker) return { ...striker, playerCode: defender.playerCode };
      if (starter === defender) return { ...defender, playerCode: striker.playerCode };
      return starter;
    }),
  };
  expect(await save(swapped)).toBe(NEXT);
  expect(await t.run((ctx) => lineupInGameweek(ctx, leagueId, annsTeam, NEXT))).toEqual(saved(swapped, NEXT));
});

test("S22.9 a lineup starting more of a line than its limit is refused: two midfielders moved to FWD make four up front, past the first limit of three", async () => {
  await t.run((ctx) => setLines(ctx, new Map([[oneMidfielder.playerCode, "FWD"], [otherMidfielder.playerCode, "FWD"]])));
  const reason = problemWords({ kind: "lineAboveMaximum", line: "FWD", starterCount: 4, maximum: 3 }, nameOf);
  await expectRefused(save(FOUR_FOUR_TWO), reason);
});
