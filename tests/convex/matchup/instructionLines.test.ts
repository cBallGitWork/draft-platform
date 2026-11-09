import { expect, test } from "vitest";
import { FIRST_INSTRUCTIONS } from "../../../convex/lineup/instructions";
import type { Cell } from "../../../convex/lineup/pitch";
import { vidiprinter, type StoredStep, type VidiprinterPlayer, type VidiprinterTeam } from "../../../convex/matchup/vidiprinter";
import { FIRST_INSTRUCTION_SCORING } from "../../../convex/scoring/draftedInstructionScoring";
import { FIRST_ROLE_OWN_STATS } from "../../../convex/scoring/draftedRoleAdjustments";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import type { ScoringSet } from "../../../convex/scoring/scoringSet";

// The team instructions' live lines (#990; Craig, 9 Nov 2026: "instruction moves get live lines
// like a role's, worded with the instruction's name"): "~71' Rice: Get stuck in", +1, its own line
// beside the one that moved it.

const SET = { ...FIRST_SCORING, ownStats: [...FIRST_ROLE_OWN_STATS], instructions: [...FIRST_INSTRUCTION_SCORING] } as ScoringSet;
const MATCH = 1;
const KICKOFF = Date.parse("2026-11-07T15:00:00Z");
const RICE = 101;
const MIDFIELD: Cell = { area: "midfield", lane: "centre" };

const team = (...instructions: string[]): VidiprinterTeam => ({ scoring: { instructions, backLine: null }, instructions: FIRST_INSTRUCTIONS });

/** Rice in midfield, his record whole, ninety minutes played, under `picked`. */
const rice = (stats: Record<string, number>, picked: VidiprinterTeam | undefined): Map<number, VidiprinterPlayer> =>
  new Map([[RICE, { name: "Rice", cell: MIDFIELD, role: undefined, inLineup: true, team: picked, inMatch: new Map([[MATCH, { stats: { minutes: 90, ...stats }, played: true, points: 0 }]]) }]]);

const step = (stat: string, from: number, to: number, minute: number): StoredStep => ({ playerCode: RICE, stat, from, to, minutes: minute, minute });

const shown = (players: Map<number, VidiprinterPlayer>, { steps = [], lines = [] }: { steps?: StoredStep[]; lines?: Parameters<typeof vidiprinter>[0][number]["lines"] }) =>
  vidiprinter([{ fixtureCode: MATCH, kickoff: KICKOFF, lines, steps }], players, SET).map(({ text, points }) => (points === null ? text : `${text} | ${points}`));

test("a step that moves an instruction shows its own line, worded with its name: Rice's fifth tackle under Get stuck in", () => {
  const players = rice({ won_tackle: 5 }, team("getItWide", "getStuckIn"));
  expect(shown(players, { steps: [step("won_tackle", 4, 5, 71)] })).toEqual(["~71' Rice: Get stuck in | +1"]);
  // A step that moves no whole `every` shows nothing.
  expect(shown(players, { steps: [step("won_tackle", 3, 4, 65)] })).toEqual([]);
});

test("its move counts in his team's column, as the line's own move for him", () => {
  const [line] = vidiprinter([{ fixtureCode: MATCH, kickoff: KICKOFF, lines: [], steps: [step("won_tackle", 4, 5, 71)] }], rice({ won_tackle: 5 }, team("getStuckIn")), SET);
  expect(line.priced).toEqual({ fixtureCode: MATCH, about: [RICE], moves: [{ playerCode: RICE, points: 1 }] });
});

test("no line for an instruction his team didn't pick, nor for a man in no lineup", () => {
  expect(shown(rice({ won_tackle: 5 }, team("getItWide", "clearIt")), { steps: [step("won_tackle", 4, 5, 71)] })).toEqual([]);
  expect(shown(rice({ won_tackle: 5 }, undefined), { steps: [step("won_tackle", 4, 5, 71)] })).toEqual([]);
});

test("a card's line shows its instruction's move on a line of its own, above it", () => {
  const card = { sourceId: 7, text: "54' YELLOW Rice", minute: 54, addedMinute: 0, type: "yellow card", playerCodes: [RICE] };
  expect(shown(rice({ yellow_cards: 1 }, team("getItWide", "getStuckIn")), { lines: [card] })).toEqual([
    "54' Rice: Get stuck in | −2",
    "54' YELLOW Rice | −1",
  ]);
});

test("Keep it tight early's move shows at the read that brings the half-time score", () => {
  const players = rice({ clean_sheet_half_time: 1, goals_conceded_half_time: 0 }, team("playOutFromTheBack", "keepItTightEarly"));
  expect(shown(players, { steps: [step("clean_sheet_half_time", 0, 1, 45)] })).toEqual(["~45' Rice: Keep it tight early | +1"]);
});

test("a step that moves both his points by the rules and an instruction shows both lines", () => {
  // Park the bus: a clean sheet past 60 minutes is +1 more for a defender, on top of base scoring's.
  const players = new Map([[RICE, { ...rice({ clean_sheets: 1 }, team("getItWide", "parkTheBus")).get(RICE)!, cell: { area: "defence", lane: "leftCentre" } as Cell }]]);
  expect(shown(players, { steps: [step("clean_sheets", 1, 1, 60)] })).toEqual(["~60' Rice: Park the bus | +1", "~60' Rice: 1 clean sheets | +4"]);
});
