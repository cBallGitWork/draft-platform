import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Lineup } from "../../../convex/lineup/lineup";
import { lineupRefusals } from "../../../convex/lineup/lineupWords";
import { lineupInGameweek } from "../../../convex/lineup/lineups";
import { sameCell } from "../../../convex/lineup/pitch";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { actingAs, addManagers, adminCreatesLeague, type TestConvex, ANN } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { FOUR_FOUR_TWO, holdSquad, NEXT } from "../../support/convex/lineupSquad.harness";
import { KEEGANS } from "../../support/convex/lineup.harness";

// A lineup saved on a classic formation (spec/05, The pitch; #991): it keeps the classic
// formation's name, saved as `classic`, until its manager picks another formation, and a classic
// formation's shape never changes.

/** The 4-4-2's eleven on Keegan's Newcastle's roles. */
const ON_KEEGANS: Lineup = {
  ...FOUR_FOUR_TWO,
  starters: FOUR_FOUR_TWO.starters.map((starter) => ({ ...starter, role: KEEGANS.cells.find((slot) => sameCell(slot, starter))!.role })),
};

let t: TestConvex;
let leagueId: Id<"leagues">;
let annsTeam: Id<"teams">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: NEXT });
  leagueId = await adminCreatesLeague(t);
  [annsTeam] = await addManagers(t, leagueId, [ANN]);
  await holdSquad(t, leagueId, annsTeam);
});

const save = async (lineup: Lineup, classicFormation?: string) =>
  (await actingAs(t, ANN)).mutation(api.lineup.lineups.save, { leagueId, lineup: { starters: [...lineup.starters], bench: [...lineup.bench], classic: classicFormation } });
const mine = () => t.run((ctx) => lineupInGameweek(ctx, leagueId, annsTeam, NEXT));

describe("a lineup saved on a classic", () => {
  test("is read back with its classic's name, and roles changed since stay its manager's (custom)", async () => {
    await save(ON_KEEGANS, KEEGANS.name);
    expect(await mine()).toMatchObject({ starters: ON_KEEGANS.starters, classic: KEEGANS.name });
    const [keeper, ...rest] = ON_KEEGANS.starters;
    await save({ ...ON_KEEGANS, starters: [{ ...keeper, role: "commandingKeeper" }, ...rest] }, KEEGANS.name);
    expect((await mine()).classic).toBe(KEEGANS.name);
  });

  test("loses its classic once saved on a formation, the roles kept", async () => {
    await save(ON_KEEGANS, KEEGANS.name);
    await save(ON_KEEGANS);
    const held = await mine();
    expect(held.classic).toBeUndefined();
    expect(held.starters).toEqual(ON_KEEGANS.starters);
  });

  test("is refused for a classic the league doesn't hold", async () => {
    await expectRefused(save(ON_KEEGANS, "Leeds 1972"), lineupRefusals.noSuchClassicFormation("Leeds 1972"));
  });

  test("is refused standing in another shape than the classic's", async () => {
    await expectRefused(save(FOUR_FOUR_TWO, "Hungary in the 50s"), lineupRefusals.notInClassicFormationShape("Hungary in the 50s"));
  });
});
