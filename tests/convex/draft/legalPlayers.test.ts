import { describe, expect, test } from "vitest";
import { legalPlayers, type DraftPlayer } from "../../../convex/draft/legalPlayers";
import { areasOf } from "../../../convex/lineup/pitch";
import { POSITIONS, type Position } from "../../../convex/positions/positionTables";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import { NO_AREA_MINIMUMS } from "../../support/convex/leagueRules.harness";

// Which players a team may draft (spec/04, The picks; #1088): a pick that would break the squad's
// rules is greyed out, so every finished squad is legal; so is one leaving no legal finish from the
// players still undrafted, unless no legal finish exists at all (Craig, 5 Nov 2026).

const ARSENAL = 3;
const CHELSEA = 8;
const LIVERPOOL = 14;

const player = (clubCode: number, ...positions: Position[]): DraftPlayer => ({ clubCode, areas: areasOf(positions) });
const KEEPER = player(ARSENAL, "GK");
const CENTRE_BACK = player(ARSENAL, "CB");
const CENTRE_MID = player(ARSENAL, "CM");
const STRIKER = player(ARSENAL, "ST");
const WING_BACK = player(ARSENAL, "WB");

/** Undrafted players enough for any finish: every kind, at twenty clubs. */
const PLENTY: DraftPlayer[] = Array.from({ length: 20 }, (_, club) =>
  POSITIONS.map((position) => player(club + 1, position)),
).flat();

const squadRules = (change: Partial<LeagueRules["squad"]>): LeagueRules["squad"] => ({
  size: { minimum: 15, maximum: 15 },
  minimumByArea: null,
  maxPerClub: null,
  ...change,
});

describe("the club maximum", () => {
  const rules = squadRules({ maxPerClub: 2 });

  test("a player whose club the team is already at the maximum for is greyed out", () => {
    const legal = legalPlayers([player(ARSENAL, "CB"), player(ARSENAL, "ST")], 10, rules, PLENTY);
    expect(legal(player(ARSENAL, "CM"))).toBe(false);
    expect(legal(player(CHELSEA, "CM"))).toBe(true);
  });

  test("one under the maximum, the club's players can still be picked", () => {
    expect(legalPlayers([player(ARSENAL, "CB")], 10, rules, PLENTY)(player(ARSENAL, "CM"))).toBe(true);
  });

  test("with no maximum, any number from one club can be picked", () => {
    const squad = Array.from({ length: 10 }, () => player(ARSENAL, "CB"));
    expect(legalPlayers(squad, 5, squadRules({}), PLENTY)(player(ARSENAL, "CM"))).toBe(true);
  });
});

describe("the area minimums", () => {
  test("2 picks left and 2 keepers needed: every outfielder is greyed out, a keeper isn't", () => {
    const rules = squadRules({ minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 2 } });
    const legal = legalPlayers([CENTRE_BACK, CENTRE_MID, STRIKER], 2, rules, PLENTY);
    expect([CENTRE_BACK, CENTRE_MID, STRIKER, WING_BACK].map(legal)).toEqual([false, false, false, false]);
    expect(legal(KEEPER)).toBe(true);
  });

  test("3 picks left and 2 keepers needed: an outfielder can still be picked", () => {
    const rules = squadRules({ minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 2 } });
    expect(legalPlayers([CENTRE_BACK], 3, rules, PLENTY)(STRIKER)).toBe(true);
  });

  test("a minimum the squad already fills greys out no one", () => {
    const rules = squadRules({ minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 1 } });
    expect(legalPlayers([KEEPER], 1, rules, PLENTY)(STRIKER)).toBe(true);
  });

  test("short in two areas with as many picks left: only a player for one of them can be picked", () => {
    const rules = squadRules({ minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 1, attack: 1 } });
    const legal = legalPlayers([CENTRE_BACK], 2, rules, PLENTY);
    expect([KEEPER, STRIKER, CENTRE_MID].map(legal)).toEqual([true, true, false]);
  });

  test("no picks left: no one can be picked", () => {
    expect(legalPlayers([], 0, squadRules({}), PLENTY)(KEEPER)).toBe(false);
  });
});

describe("positions with two areas", () => {
  const rules = squadRules({ minimumByArea: { ...NO_AREA_MINIMUMS, defence: 1, midfield: 1 } });

  test("a wing back fills one short area, so with one pick left after him he is legal", () => {
    expect(legalPlayers([], 2, rules, PLENTY)(WING_BACK)).toBe(true);
  });

  test("a wing back can't fill both short areas with the last pick", () => {
    expect(legalPlayers([], 1, rules, PLENTY)(WING_BACK)).toBe(false);
  });

  test("a wing back moves to midfield when a centre back fills defence, so the last pick can be him", () => {
    // The squad's wing back fills defence until the centre back comes, then midfield.
    expect(legalPlayers([WING_BACK], 1, rules, PLENTY)(CENTRE_BACK)).toBe(true);
  });

  test("the squad's wing back moves to midfield when only centre backs are left for defence", () => {
    const left = [player(CHELSEA, "CB"), player(CHELSEA, "ST")];
    expect(legalPlayers([WING_BACK], 2, rules, left)(player(LIVERPOOL, "ST"))).toBe(true);
  });
});

describe("both rules at once", () => {
  test("a keeper the team needs is greyed out when his club is at the maximum", () => {
    const rules = squadRules({ maxPerClub: 1, minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 1 } });
    const legal = legalPlayers([player(ARSENAL, "CB")], 1, rules, PLENTY);
    expect(legal(player(ARSENAL, "GK"))).toBe(false);
    expect(legal(player(CHELSEA, "GK"))).toBe(true);
  });
});

describe("the players still undrafted", () => {
  test("a pick that would put the team at the maximum for the only club with keepers left is greyed out", () => {
    const rules = squadRules({ maxPerClub: 2, minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 1 } });
    const left = [player(ARSENAL, "GK"), player(ARSENAL, "ST"), player(CHELSEA, "ST")];
    const legal = legalPlayers([player(ARSENAL, "CB")], 2, rules, left);
    expect(legal(player(ARSENAL, "ST"))).toBe(false);
    expect(legal(player(CHELSEA, "ST"))).toBe(true);
    expect(legal(player(ARSENAL, "GK"))).toBe(true);
  });

  test("a player picked is gone from those left: two keepers needed, one picked leaves the other", () => {
    const rules = squadRules({ maxPerClub: 1, minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 2 } });
    const left = [player(CHELSEA, "GK"), player(CHELSEA, "GK"), player(LIVERPOOL, "GK"), player(LIVERPOOL, "ST"), player(ARSENAL, "ST")];
    const legal = legalPlayers([], 3, rules, left);
    // After a Chelsea keeper, only Liverpool's can be the second: a Liverpool striker would block him.
    expect(legal(player(CHELSEA, "GK"))).toBe(true);
    expect(legalPlayers([player(CHELSEA, "GK")], 2, rules, left.slice(1))(player(LIVERPOOL, "ST"))).toBe(false);
  });

  test("with no legal finish at all, the squad-only checks apply", () => {
    const rules = squadRules({ maxPerClub: 1, minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 1 } });
    // Every keeper left plays for Arsenal, the team's at its maximum for: no finish fills the minimum.
    const left = [player(ARSENAL, "GK"), player(CHELSEA, "ST"), player(LIVERPOOL, "ST")];
    const legal = legalPlayers([player(ARSENAL, "CB")], 2, rules, left);
    expect(legal(player(CHELSEA, "ST"))).toBe(true);
    expect(legal(player(ARSENAL, "GK"))).toBe(false);
  });
});
