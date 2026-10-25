import { describe, expect, test } from "vitest";
import { areasShort } from "../../../convex/squads/areaMinimums";
import { areasOf } from "../../../convex/lineup/pitch";
import { NO_AREA_MINIMUMS } from "../../support/convex/leagueRules.harness";
import type { Position } from "../../../convex/positions/positionTables";

// A squad against the league's minimum per area (spec/03, Squad make-up; #317): a player who can
// play two areas fills one minimum, whichever helps the squad.

const areas = (...positions: Position[]) => areasOf(positions);
const WING_BACK = areas("WB");
const CENTRE_BACK = areas("CB");
const CENTRE_MID = areas("CM");

describe("a player's areas", () => {
  test("a wing back's are defence and both midfield rows his wide lanes reach", () => {
    expect(WING_BACK).toEqual(["defence", "defensiveMidfield", "midfield"]);
  });

  test("a shadow striker's are attacking midfield and attack; a player with no positions has none", () => {
    expect(areas("SS")).toEqual(["attackingMidfield", "attack"]);
    expect(areas()).toEqual([]);
  });
});

describe("the minimums", () => {
  test("an area short of its minimum is warned, with how many fill it", () => {
    expect(areasShort([CENTRE_BACK, CENTRE_MID], { ...NO_AREA_MINIMUMS, defence: 2, midfield: 1 })).toEqual([{ area: "defence", players: 1, minimum: 2 }]);
  });

  test("a wing back fills the one minimum that helps: midfield, once a centre back fills defence", () => {
    // Taken first, the wing back would fill defence; the centre back, who can fill only defence,
    // moves him on to midfield.
    expect(areasShort([WING_BACK, CENTRE_BACK], { ...NO_AREA_MINIMUMS, defence: 1, midfield: 1 })).toEqual([]);
  });

  test("one wing back can't fill both defence and midfield", () => {
    expect(areasShort([WING_BACK], { ...NO_AREA_MINIMUMS, defence: 1, midfield: 1 })).toEqual([{ area: "midfield", players: 0, minimum: 1 }]);
  });

  test("a player with no positions fills nothing", () => {
    expect(areasShort([[]], { ...NO_AREA_MINIMUMS, goalkeeper: 1 })).toEqual([{ area: "goalkeeper", players: 0, minimum: 1 }]);
  });

  test("no minimums, nothing short", () => {
    expect(areasShort([WING_BACK], NO_AREA_MINIMUMS)).toEqual([]);
  });
});
