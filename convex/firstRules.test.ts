import { expect, test } from "vitest";
import { FIRST_RULES } from "./firstRules";
import { fplStatLines } from "./fplLive";
import bootstrap from "./recorded/fpl-gw6-bootstrap.json";
import live from "./recorded/fpl-gw6-live.json";
import { recordedGw6 } from "./recorded/gw6.payloads";
import { scoreMatch } from "./scoring";
import type { Area } from "./scoringSet";

// The first scoring set is FPL's without bonus (spec/14, The first scoring set), so for every man
// FPL recorded in gameweek 6 of 2026/27 it must give FPL's own points less his bonus, scored in
// the area his FPL position plays.

/** The two things the raw types leave out: FPL's position, and its points with the bonus in them. */
const positionOf = new Map((bootstrap.elements as { code: number; element_type: number }[]).map((each) => [each.code, each.element_type]));
const fplPoints = live.elements as { id: number; stats: { minutes: number; total_points: number; bonus: number } }[];

const AREA_OF_POSITION: Record<number, Area> = { 1: "goalkeeper", 2: "defence", 3: "midfield", 4: "attack" };

test("the first scoring set gives FPL's points less bonus to all 40 recorded men", () => {
  const { fpl } = recordedGw6();
  const lines = fplStatLines(fpl.live, fpl.bootstrap.elements, fpl.fixtures);
  expect(fplPoints.filter((element) => element.stats.minutes > 0).length).toBeGreaterThan(20);
  for (const element of fplPoints) {
    const code = fpl.bootstrap.elements.find((each) => each.id === element.id)?.code;
    const line = lines.find((each) => each.playerCode === code);
    const position = positionOf.get(code ?? -1);
    if (line === undefined || position === undefined) throw new Error(`no recorded line for FPL player ${element.id}`);
    const { total } = scoreMatch(line.stats, FIRST_RULES.scoring, AREA_OF_POSITION[position]);
    expect({ code, total }).toEqual({ code, total: element.stats.total_points - element.stats.bonus });
  }
});
