import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { InstructionPair } from "../../../convex/lineup/instructions";
import type { Lineup } from "../../../convex/lineup/lineup";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { FOUR_FOUR_TWO, holdSquad, NEXT, SQUAD_CLUB } from "../../support/convex/lineupSquad.harness";

// A lineup's two team instructions, saved with it (spec/05, Team instructions; #990): only ones its
// formation offers, and until its manager picks, the formation's defaults.

const [ANN] = MANAGERS;

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: NEXT });
  leagueId = await adminCreatesLeague(t);
  const [annsTeam] = await addManagers(t, leagueId, [ANN]);
  await t.run((ctx) => ctx.db.insert("clubs", SQUAD_CLUB));
  await holdSquad(t, leagueId, annsTeam);
});

const ann = async () => {
  const person = await actingAs(t, ANN);
  return {
    save: (lineup: Lineup, instructions?: InstructionPair) =>
      person.mutation(api.lineup.lineups.save, { leagueId, lineup: { starters: [...lineup.starters], bench: [...lineup.bench], instructions } }),
    picked: async () => {
      const tactics = await person.query(api.lineup.tactics.ofMyTeam, { leagueId, now: Date.now() });
      if (tactics.kind !== "open") throw new Error(`No gameweek open: ${tactics.kind}`);
      return tactics.picked;
    },
  };
};

test("a 4-4-2 saved with none picked holds its defaults, Play out from the back and Keep it tight early", async () => {
  const manager = await ann();
  await manager.save(FOUR_FOUR_TWO);
  expect(await manager.picked()).toEqual({ attacking: "playOutFromTheBack", defensive: "keepItTightEarly" });
});

test("a pair the formation offers is saved and read back", async () => {
  const manager = await ann();
  await manager.save(FOUR_FOUR_TWO, { attacking: "getItWide", defensive: "pressHigh" });
  expect(await manager.picked()).toEqual({ attacking: "getItWide", defensive: "pressHigh" });
});

test("one the formation blocks is refused, saying what it needs", async () => {
  const manager = await ann();
  await expectRefused(manager.save(FOUR_FOUR_TWO, { attacking: "playOutFromTheBack", defensive: "parkTheBus" }), "Park the bus needs 5 at the back, which this lineup's formation doesn't have.");
});

test("one the league doesn't hold, or on the wrong side, is refused", async () => {
  const manager = await ann();
  await expectRefused(manager.save(FOUR_FOUR_TWO, { attacking: "pressHigh", defensive: "clearIt" }), `"pressHigh" isn't one of this league's attacking instructions.`);
});
