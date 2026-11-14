import { describe, expect, test } from "vitest";
import { lineupProblems, namedCodes, STARTER_COUNT, type AreaLimit, type LineupProblem, type LineupRules } from "../../../../convex/lineup/lineup";
import { problemWords } from "../../../../convex/lineup/lineupWords";
import { AREAS, areasOf, cellsOf, LANES, playsCell, positionOfSlot, type Area, type Cell } from "../../../../convex/lineup/pitch";
import { everyRoleOf } from "../../../../convex/lineup/roles";
import { FIRST_PRESETS, type Preset } from "../../../../convex/lineup/presets";
import { FIRST_CLASSIC_FORMATIONS, inClassicFormationShape } from "../../../../convex/lineup/classicFormations";
import { POSITIONS, type Position } from "../../../../convex/positions/positionTables";
import { NO_DATA, UNSURE, type RoleStars } from "../../../../convex/stars/starsShape";
import { AVAILABILITIES } from "../../../../convex/availability/availabilities";
import { benchedAt, startersInOrder, swapped, type EditedLineup } from "../../../../src/myTeam/tactics/lineupEdits";
import { reshaped } from "../../../../src/myTeam/tactics/reshape";
import { onClassicFormation } from "../../../../src/myTeam/tactics/classicFormationLineup";
import { loadedPlan } from "../../../../src/myTeam/tactics/savedPlans";
import { quickPick, type PickedFrom } from "../../../../src/myTeam/tactics/quickPick";
import { dropOutcome } from "../../../../src/myTeam/tactics/swaps";
import { drawn, drawnFrom } from "../../../support/seededDraw";

// Every client function that reshapes a lineup on the Tactics tab (#2128; #1025, where a preset
// benched starters and the save failed in silence): a preset, a classic formation, a saved plan,
// Quick Pick, a drag (a swap) and a bench reorder. Each is run on random squads under random league
// rules, and its lineup passes the server's own check (convex/lineup/lineup.ts `lineupProblems`)
// whenever the squad can fill the shape: no slot left empty that someone plays (S05.36), and each
// on a role he may take (S05.29). Where it can't, the lineup is short of eleven only for the
// slots nobody can fill, and the save's refusal has words for every problem, which the screen shows
// under the toolbar (useLineupEdits.ts). The tab has no auto-sub of its own: auto-subs are the
// server's (convex/lineup/autoSubs.ts), which already judge by lineupProblems.

const SEEDS = 150;
const DROPS = 25;
/** The most players a drawn squad holds: short of a league's cap (leagueLimits.ts), so the runs stay quick. */
const MOST_DRAWN = 18;
const STARS = [NO_DATA, UNSURE, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;
/** Positions as the feed holds them: none known yet among them (spec/06). */
const DRAWN_POSITIONS: readonly (readonly Position[])[] = [[], ...POSITIONS.map((position) => [position])];

type Draw = (count: number) => number;

/** A league's rules: some of the first presets, at least one, and area limits that hold every one
 *  of them (leagueRulesCheck.ts refuses a preset outside them), widened by a draw. */
function drawnRules(draw: Draw): LineupRules & { presets: readonly Preset[] } {
  const kept = FIRST_PRESETS.filter(() => draw(2) === 0);
  const presets = kept.length > 0 ? kept : [drawnFrom(draw, FIRST_PRESETS)];
  const counts = (area: Area) => presets.map(({ cells }) => cells.filter((cell) => cell.area === area).length);
  const limit = (area: Area): AreaLimit => ({
    minimum: Math.max(0, Math.min(...counts(area)) - draw(2)),
    maximum: Math.min(LANES.length, Math.max(...counts(area)) + draw(2)),
  });
  return { presets, areaLimits: Object.fromEntries(AREAS.map((area) => [area, limit(area)])) as LineupRules["areaLimits"] };
}

/** Stars for every role in every area his positions play, each drawn, "?" and "—" among them. */
const drawnStars = (draw: Draw, positions: readonly Position[]): RoleStars[] =>
  areasOf(positions).flatMap((area) =>
    [...new Set(cellsOf(area, LANES).flatMap((cell) => everyRoleOf(cell).map(({ key }) => key)))].map((role) => ({ area, role, stars: drawnFrom(draw, STARS) })),
  );

/** A squad of 11 to 18. Half the seeds start from a preset's slots, each player playing his and
 *  maybe another, so the shapes mostly fill; the rest are drawn at random, so some never do. */
function drawnSquad(draw: Draw): PickedFrom[] {
  const size = STARTER_COUNT + draw(MOST_DRAWN - STARTER_COUNT + 1);
  const slots = draw(2) === 0 ? drawnFrom(draw, FIRST_PRESETS).cells : [];
  return Array.from({ length: size }, (_, index) => {
    const own = slots[index] === undefined ? [] : [positionOfSlot(slots[index])];
    const positions = [...new Set([...own, ...drawnFrom(draw, DRAWN_POSITIONS)])];
    return { playerCode: index + 1, positions, stars: drawnStars(draw, positions), availability: drawnFrom(draw, [...AVAILABILITIES, null]), unheld: draw(10) === 0 };
  });
}

/** Whether the squad can fill every cell, each player in a cell he plays: the matching worked out
 *  here, apart from the reshapers' own (convex/shared/matching.ts). */
function canFill(cells: readonly Cell[], squad: readonly PickedFrom[]): boolean {
  const holderOf = new Map<number, number>();
  const place = (player: number, tried: Set<number>): boolean =>
    cells.some((cell, index) => {
      if (tried.has(index) || !playsCell(squad[player].positions, cell)) return false;
      tried.add(index);
      const holder = holderOf.get(index);
      if (holder !== undefined && !place(holder, tried)) return false;
      holderOf.set(index, player);
      return true;
    });
  squad.forEach((_, player) => place(player, new Set()));
  return holderOf.size === cells.length;
}

/** What a seed draws: the league's rules, the squad, and its lineup in one of the league's presets. */
function drawnCase(seed: number) {
  const draw = drawn(seed);
  const rules = drawnRules(draw);
  const squad = drawnSquad(draw);
  const byCode = new Map(squad.map((member) => [member.playerCode, member]));
  const positionsOf = (playerCode: number) => byCode.get(playerCode)?.positions ?? [];
  const ratingsOf = (playerCode: number) => byCode.get(playerCode)?.stars ?? [];
  const positions = new Map(squad.map(({ playerCode, positions }) => [playerCode, positions]));
  const opening = reshaped({ starters: [], bench: squad.map(({ playerCode }) => playerCode) }, drawnFrom(draw, rules.presets).cells, { positionsOf }, ratingsOf);
  return { draw, rules, squad, positions, positionsOf, ratingsOf, opening };
}

type Drawn = ReturnType<typeof drawnCase>;

/** The kinds a lineup short of eleven may have: the count, and an area under its minimum. */
const SHORT_KINDS: readonly LineupProblem["kind"][] = ["wrongStarterCount", "belowMinimum"];

/** The reshaper's lineup stands under the league's rules whenever the squad can fill the shape;
 *  where it can't, it is short only of the slots nobody plays, and every problem has words. Either
 *  way every squad player is named once. */
function expectStands(after: EditedLineup, cells: readonly Cell[], { rules, squad, positions }: Drawn, label: string) {
  expect(namedCodes(after).toSorted((one, other) => one - other), label).toEqual(squad.map(({ playerCode }) => playerCode));
  const problems = lineupProblems(after, positions, rules);
  if (canFill(cells, squad)) {
    expect(problems, label).toEqual([]);
    return;
  }
  expect(after.starters.length, label).toBeLessThan(STARTER_COUNT);
  expect(problems.filter(({ kind }) => !SHORT_KINDS.includes(kind)), label).toEqual([]);
  for (const problem of problems) expect(problemWords(problem, (playerCode) => `Player ${playerCode}`), label).not.toBe("");
}

const eachSeed = (run: (drawnOne: Drawn, seed: number) => void) => {
  for (let seed = 1; seed <= SEEDS; seed++) run(drawnCase(seed), seed);
};

describe("every reshaper's lineup stands under the league's rules, or its refusal is worded", () => {
  test("a preset picked, from each of the league's presets to each", () => {
    const filled = { yes: 0, no: 0 };
    eachSeed((drawnCase, seed) => {
      const { rules, opening, positionsOf, ratingsOf, squad } = drawnCase;
      for (const preset of rules.presets) {
        expectStands(reshaped(opening, preset.cells, { positionsOf }, ratingsOf), preset.cells, drawnCase, `seed ${seed}, ${preset.name}`);
        filled[canFill(preset.cells, squad) ? "yes" : "no"] += 1;
      }
    });
    // The draws reach both: shapes the squad fills, and shapes it can't.
    expect(filled.yes).toBeGreaterThan(0);
    expect(filled.no).toBeGreaterThan(0);
  });

  test("a classic formation picked, of those standing in one of the league's presets", () => {
    eachSeed((drawnCase, seed) => {
      const { rules, opening, positionsOf, ratingsOf } = drawnCase;
      const held = FIRST_CLASSIC_FORMATIONS.filter((classic) => rules.presets.some(({ cells }) => inClassicFormationShape(cells, classic)));
      for (const classic of held) {
        expectStands(onClassicFormation(opening, classic, { positionsOf }, ratingsOf), classic.cells, drawnCase, `seed ${seed}, ${classic.name}`);
      }
    });
  });

  test("a saved plan loaded, each slot on a role drawn from every role its position holds", () => {
    eachSeed((drawnCase, seed) => {
      const { draw, rules, opening, positionsOf, ratingsOf } = drawnCase;
      const { cells } = drawnFrom(draw, rules.presets);
      const plan = { name: "Drawn", slots: cells.map((cell) => ({ ...cell, role: drawnFrom(draw, everyRoleOf(cell)).key })) };
      const loaded = loadedPlan(opening, plan, rules.presets, { positionsOf }, ratingsOf);
      expectStands(loaded!.lineup, cells, drawnCase, `seed ${seed}, plan on ${loaded!.preset.name}`);
    });
  });

  // As the screen asks it (LineupEditor.tsx): on the preset last picked, the lineup reshaped to it.
  test("Quick Pick, on one of the league's presets just picked", () => {
    eachSeed((drawnCase, seed) => {
      const { draw, rules, opening, squad, positionsOf, ratingsOf } = drawnCase;
      const preset = drawnFrom(draw, rules.presets);
      const picked = reshaped(opening, preset.cells, { positionsOf }, ratingsOf);
      expectStands(quickPick(picked, preset.cells, squad), preset.cells, drawnCase, `seed ${seed}, Quick Pick on ${preset.name}`);
    });
  });

  test("drags and bench reorders, one after another: each swap the drop allows, and each bench move", () => {
    eachSeed((drawnCase, seed) => {
      const { draw, rules, opening, positionsOf, ratingsOf, positions } = drawnCase;
      const kindsOf = (lineup: EditedLineup) => [...new Set(lineupProblems(lineup, positions, rules).map(({ kind }) => kind))].toSorted();
      const before = kindsOf(opening);
      let draft = opening;
      for (let drop = 1; drop <= DROPS; drop++) {
        const label = `seed ${seed}, drop ${drop}`;
        const picked = drawnFrom(draw, namedCodes(draft));
        const other = drawnFrom(draw, namedCodes(draft));
        if (!startersInOrder(draft).some(({ playerCode }) => playerCode === picked) && draw(2) === 0) {
          draft = benchedAt(draft, picked, draw(draft.bench.length));
        } else {
          const outcome = dropOutcome(draft, picked, { playerCode: other }, { ...rules, positionsOf });
          if ("swapWith" in outcome) draft = swapped(draft, picked, outcome.swapWith, ratingsOf, positionsOf);
        }
        // A move never adds a kind of problem: a lineup that stood still stands, and one short stays
        // short only as it was.
        expect(kindsOf(draft), label).toEqual(before);
        expect(draft.starters.length, label).toBe(opening.starters.length);
      }
    });
  });
});
