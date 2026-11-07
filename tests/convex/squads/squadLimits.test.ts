import { describe, expect, test } from "vitest";
import type { Position } from "../../../convex/positions/positionTables";
import { minimumsFilled } from "../../../convex/squads/areaMinimums";
import { squadLimits, type LimitPlayer } from "../../../convex/squads/squadLimits";
import { areasOf } from "../../../convex/lineup/pitch";
import { NO_AREA_MINIMUMS } from "../../support/convex/leagueRules.harness";
import { ARSENAL, CHELSEA } from "../../support/convex/footballRows.harness";

// The Squad tab's Rules view (#1006): one row per limit, each naming the players it counts; a club
// row only with a club maximum, an area row only for an area with a minimum, and a player who
// plays two areas named once, in whichever minimum helps (Craig, 6 Nov 2026; spec/03).

const player = (code: number, club: LimitPlayer["club"], ...positions: Position[]): LimitPlayer => ({ code, club, positions });
const KEEPER = player(1, ARSENAL, "GK");
const WING_BACK = player(2, ARSENAL, "WB");
const CENTRE_MID = player(3, CHELSEA, "CM");
const CENTRE_BACK = player(4, ARSENAL, "CB");
const squad = [KEEPER, WING_BACK, CENTRE_MID, CENTRE_BACK];
const NO_LIMITS = { size: null, minimumByArea: null, maxPerClub: null };

describe("the rows", () => {
  test("none for a league with no rules, or none of the limits set", () => {
    expect(squadLimits(squad, 0, null)).toEqual([]);
    expect(squadLimits(squad, 0, NO_LIMITS)).toEqual([]);
  });

  test("the squad's size counts every player, those the football sync no longer holds too", () => {
    expect(squadLimits(squad, 1, { ...NO_LIMITS, size: { minimum: 3, maximum: 4 } })).toEqual([{ kind: "size", players: [1, 2, 3, 4], count: 5, minimum: 3, maximum: 4 }]);
  });

  test("one row per area with a minimum, back to front, a two-area player named once where he helps", () => {
    // The wing back fills midfield's second place: the centre back already fills defence's one.
    const minimums = { ...NO_AREA_MINIMUMS, goalkeeper: 1, defence: 1, midfield: 2 };
    expect(squadLimits(squad, 0, { ...NO_LIMITS, minimumByArea: minimums })).toEqual([
      { kind: "area", area: "goalkeeper", players: [1], minimum: 1 },
      { kind: "area", area: "defence", players: [4], minimum: 1 },
      { kind: "area", area: "midfield", players: [2, 3], minimum: 2 },
    ]);
  });

  test("a player who fills no minimum is named under the first area with a row he plays", () => {
    const minimums = { ...NO_AREA_MINIMUMS, defence: 3 };
    expect(squadLimits([CENTRE_BACK, WING_BACK], 0, { ...NO_LIMITS, minimumByArea: minimums })).toEqual([{ kind: "area", area: "defence", players: [4, 2], minimum: 3 }]);
    expect(squadLimits([CENTRE_BACK, player(5, ARSENAL, "CB")], 0, { ...NO_LIMITS, minimumByArea: { ...NO_AREA_MINIMUMS, defence: 1 } })).toEqual([
      { kind: "area", area: "defence", players: [4, 5], minimum: 1 },
    ]);
  });

  test("one row per club the squad holds, most players first, with the league's maximum", () => {
    expect(squadLimits(squad, 0, { ...NO_LIMITS, maxPerClub: 2 })).toEqual([
      { kind: "club", club: ARSENAL, players: [1, 2, 4], maximum: 2 },
      { kind: "club", club: CHELSEA, players: [3], maximum: 2 },
    ]);
  });
});

describe("the minimums each player fills", () => {
  test("one area each at most, as many places filled as can be", () => {
    const areas = squad.map(({ positions }) => areasOf(positions));
    expect(minimumsFilled(areas, { ...NO_AREA_MINIMUMS, defence: 1, midfield: 2 })).toEqual([null, "midfield", "midfield", "defence"]);
  });
});
