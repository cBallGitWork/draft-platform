import { expect, test } from "vitest";
import { drawRulesOf, FIRST_RULES } from "../../../convex/rules/firstRules";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { fplStatLines } from "../../../convex/football/fpl/fplLive";
import bootstrap from "../../support/recorded/fpl-gw6-bootstrap.json";
import live from "../../support/recorded/fpl-gw6-live.json";
import { recordedGw6 } from "../../support/recorded/gw6.payloads";
import { centreOf } from "../../support/convex/scoring.example";
import { scoreMatch } from "../../../convex/scoring/scoring";
import type { Area } from "../../../convex/scoring/scoringSet";

// The first scoring set is FPL's without bonus and without its defensive contribution (spec/14, The
// first scoring set; Craig, 4 Nov 2026: "Drop it from scoring"), so for every man FPL recorded in
// gameweek 6 of 2026/27 it must give FPL's own points less his bonus and less FPL's 2 for his
// defensive contribution, scored in the area his FPL position plays.

/** The two things the raw types leave out: FPL's position, and its points with the bonus in them. */
const positionOf = new Map((bootstrap.elements as { code: number; element_type: number }[]).map((each) => [each.code, each.element_type]));
const fplPoints = live.elements as {
  id: number;
  stats: { minutes: number; total_points: number; bonus: number; defensive_contribution: number };
}[];

/** FPL's 2 for a defensive contribution: 10 or more as a defender, 12 or more as a midfielder or
 *  forward, none for a keeper (FPL's 2025/26 rules, the first set's until 4 Nov 2026). */
const FPL_DC_THRESHOLD: Record<number, number | null> = { 1: null, 2: 10, 3: 12, 4: 12 };
const fplDefensivePoints = (position: number, count: number) => {
  const threshold = FPL_DC_THRESHOLD[position];
  return threshold !== null && count >= threshold ? 2 : 0;
};

const AREA_OF_POSITION: Record<number, Area> = { 1: "goalkeeper", 2: "defence", 3: "midfield", 4: "attack" };

test("the first scoring set gives FPL's points less bonus and less its defensive contribution to all 40 recorded men", () => {
  const { fpl } = recordedGw6();
  const lines = fplStatLines(fpl.live, fpl.bootstrap.elements, fpl.fixtures);
  expect(fplPoints.filter((element) => element.stats.minutes > 0).length).toBeGreaterThan(20);
  for (const element of fplPoints) {
    const code = fpl.bootstrap.elements.find((each) => each.id === element.id)?.code;
    const line = lines.find((each) => each.playerCode === code);
    const position = positionOf.get(code ?? -1);
    if (line === undefined || position === undefined) throw new Error(`no recorded line for FPL player ${element.id}`);
    const { total } = scoreMatch(line.stats, FIRST_SCORING, centreOf(AREA_OF_POSITION[position]));
    const dropped = element.stats.bonus + fplDefensivePoints(position, element.stats.defensive_contribution);
    expect({ code, total }).toEqual({ code, total: element.stats.total_points - dropped });
  }
});

// What Hull v Everton never had, priced by hand from FPL's rules: each line is one stat on top of
// 90 minutes (2 points), in the area that stat's value differs by.
const RARE: [string, Area, Record<string, number>, number][] = [
  ["a keeper's goal", "goalkeeper", { goals_scored: 1 }, 10],
  ["a defender's goal", "defence", { goals_scored: 1 }, 6],
  ["a keeper's clean sheet", "goalkeeper", { clean_sheets: 1 }, 4],
  ["a defender's clean sheet", "defence", { clean_sheets: 1 }, 4],
  ["a midfielder's clean sheet", "defensiveMidfield", { clean_sheets: 1 }, 1],
  ["a forward's clean sheet", "attack", { clean_sheets: 1 }, 0],
  ["a penalty saved", "goalkeeper", { penalties_saved: 1 }, 5],
  ["a penalty missed", "attack", { penalties_missed: 1 }, -2],
  ["a red card", "midfield", { red_cards: 1 }, -3],
  ["an own goal", "defence", { own_goals: 1 }, -2],
];

test.each(RARE)("the first scoring set scores %s in %s as FPL does", (_name, area, stat, points) => {
  expect(scoreMatch({ minutes: 90, ...stat }, FIRST_SCORING, centreOf(area)).total).toBe(2 + points);
});

// FPL's defensive contribution scores nothing in any area (Craig, 4 Nov 2026: "Drop it from
// scoring"): FPL's threshold, and far past it.
const NO_DEFENSIVE_CONTRIBUTION: [Area, number][] = [
  ["defence", 10],
  ["attackingMidfield", 12],
  ["attack", 24],
  ["goalkeeper", 10],
];

test.each(NO_DEFENSIVE_CONTRIBUTION)("the first scoring set gives nothing for defensive contributions in %s (%i of them)", (area, count) => {
  expect(scoreMatch({ minutes: 90, defensive_contribution: count }, FIRST_SCORING, centreOf(area)).total).toBe(2);
});

test("the team left over plays the league's average, one game a gameweek, in the first rules and in rules saved before those were rules", () => {
  const firstDraw = { oddTeamOut: "leagueAverage", gamesPerGameweek: 1 };
  expect(drawRulesOf(FIRST_RULES)).toEqual(firstDraw);
  const { oddTeamOut: _odd, gamesPerGameweek: _games, ...savedBefore } = FIRST_RULES;
  expect(drawRulesOf(savedBefore)).toEqual(firstDraw);
  expect(drawRulesOf({ ...FIRST_RULES, oddTeamOut: "bye", gamesPerGameweek: 2 })).toEqual({ oddTeamOut: "bye", gamesPerGameweek: 2 });
});
