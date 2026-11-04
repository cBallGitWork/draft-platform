import { describe, expect, test } from "vitest";
import { legalPlayers, type DraftPlayer } from "../../../convex/draft/legalPlayers";
import { areasOf } from "../../../convex/lineup/pitch";
import type { Position } from "../../../convex/positions/positionTables";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import { NO_AREA_MINIMUMS } from "../../support/convex/leagueRules.harness";

// Which players a team may draft (spec/04, The picks; #1088): a pick that would break the squad's
// rules is greyed out, so every finished squad is legal.

const ARSENAL = 3;
const CHELSEA = 8;

const player = (clubCode: number, ...positions: Position[]): DraftPlayer => ({ clubCode, areas: areasOf(positions) });
const KEEPER = player(ARSENAL, "GK");
const CENTRE_BACK = player(ARSENAL, "CB");
const CENTRE_MID = player(ARSENAL, "CM");
const STRIKER = player(ARSENAL, "ST");
const WING_BACK = player(ARSENAL, "WB");

const squadRules = (change: Partial<LeagueRules["squad"]>): LeagueRules["squad"] => ({
  size: { minimum: 15, maximum: 15 },
  minimumByArea: null,
  maxPerClub: null,
  ...change,
});

describe("the club maximum", () => {
  const rules = squadRules({ maxPerClub: 2 });

  test("a player whose club the team is already at the maximum for is greyed out", () => {
    const legal = legalPlayers([player(ARSENAL, "CB"), player(ARSENAL, "ST")], 10, rules);
    expect(legal(player(ARSENAL, "CM"))).toBe(false);
    expect(legal(player(CHELSEA, "CM"))).toBe(true);
  });

  test("one under the maximum, the club's players can still be picked", () => {
    expect(legalPlayers([player(ARSENAL, "CB")], 10, rules)(player(ARSENAL, "CM"))).toBe(true);
  });

  test("with no maximum, any number from one club can be picked", () => {
    const squad = Array.from({ length: 10 }, () => player(ARSENAL, "CB"));
    expect(legalPlayers(squad, 5, squadRules({}))(player(ARSENAL, "CM"))).toBe(true);
  });
});

describe("the area minimums", () => {
  test("2 picks left and 2 keepers needed: every outfielder is greyed out, a keeper isn't", () => {
    const rules = squadRules({ minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 2 } });
    const legal = legalPlayers([CENTRE_BACK, CENTRE_MID, STRIKER], 2, rules);
    expect([CENTRE_BACK, CENTRE_MID, STRIKER, WING_BACK].map(legal)).toEqual([false, false, false, false]);
    expect(legal(KEEPER)).toBe(true);
  });

  test("3 picks left and 2 keepers needed: an outfielder can still be picked", () => {
    const rules = squadRules({ minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 2 } });
    expect(legalPlayers([CENTRE_BACK], 3, rules)(STRIKER)).toBe(true);
  });

  test("a minimum the squad already fills greys out no one", () => {
    const rules = squadRules({ minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 1 } });
    expect(legalPlayers([KEEPER], 1, rules)(STRIKER)).toBe(true);
  });

  test("short in two areas with as many picks left: only a player for one of them can be picked", () => {
    const rules = squadRules({ minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 1, attack: 1 } });
    const legal = legalPlayers([CENTRE_BACK], 2, rules);
    expect([KEEPER, STRIKER, CENTRE_MID].map(legal)).toEqual([true, true, false]);
  });

  test("no picks left: no one can be picked", () => {
    expect(legalPlayers([], 0, squadRules({}))(KEEPER)).toBe(false);
  });
});

describe("positions with two areas", () => {
  const rules = squadRules({ minimumByArea: { ...NO_AREA_MINIMUMS, defence: 1, midfield: 1 } });

  test("a wing back fills one short area, so with one pick left after him he is legal", () => {
    expect(legalPlayers([], 2, rules)(WING_BACK)).toBe(true);
  });

  test("a wing back can't fill both short areas with the last pick", () => {
    expect(legalPlayers([], 1, rules)(WING_BACK)).toBe(false);
  });

  test("a wing back moves to midfield when a centre back fills defence, so the last pick can be him", () => {
    // The squad's wing back fills defence until the centre back comes, then midfield.
    expect(legalPlayers([WING_BACK], 1, rules)(CENTRE_BACK)).toBe(true);
  });
});

describe("both rules at once", () => {
  test("a keeper the team needs is greyed out when his club is at the maximum", () => {
    const rules = squadRules({ maxPerClub: 1, minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 1 } });
    const legal = legalPlayers([player(ARSENAL, "CB")], 1, rules);
    expect(legal(player(ARSENAL, "GK"))).toBe(false);
    expect(legal(player(CHELSEA, "GK"))).toBe(true);
  });
});
