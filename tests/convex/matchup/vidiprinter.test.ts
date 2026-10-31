import { expect, test } from "vitest";
import { writeCommentary } from "../../../convex/football/commentary";
import { codesByOpta } from "../../../convex/football/feedIds";
import { commentaryLines } from "../../../convex/football/premierLeague/plCommentary";
import type { Cell } from "../../../convex/lineup/pitch";
import { vidiprinter, type StoredStep, type VidiprinterMatch, type VidiprinterPlayer } from "../../../convex/matchup/vidiprinter";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import type { ScoringSet } from "../../../convex/scoring/scoringSet";
import { MINUTE_MS } from "../../../convex/shared/time";
import { recordedLiveCommentary, recordedLiveFplPlayers, recordedLiveSheets } from "../../support/recorded/live.payloads";

// The matchup's commentary (#44; spec/10, The commentary): Ipswich 1–1 Nott'm Forest's recorded
// lines, priced for the men of two lineups under two scoring sets. The same match moves different
// points, and shows different threshold lines, under each.

const IPSWICH_FOREST = 1;
const KICKOFF = Date.parse("2026-10-23T19:00:00Z");
const ATTACK: Cell = { area: "attack", lane: "centre" };
const MIDFIELD: Cell = { area: "midfield", lane: "centre" };

const fplPlayers = recordedLiveFplPlayers();
const codeOf = (webName: string) => fplPlayers.find((element) => element.web_name === webName)!.code;
const CODE = { williams: codeOf("N.Williams"), munoz: codeOf("Muñoz"), enciso: codeOf("Enciso"), murillo: codeOf("Murillo") };

/** The full-time read's lines, written and stored as the live tick stores them, no points on the
 *  full-time line: each matchup adds its own. */
const STORED = writeCommentary(commentaryLines(recordedLiveSheets(), recordedLiveCommentary("final").events.content, codesByOpta(fplPlayers)).lines, {
  header: { home: "IPS", away: "NFO", homeGoals: 1, awayGoals: 1 },
  nameByCode: new Map(fplPlayers.map((element) => [element.code, element.web_name])),
}).lines;

/** A whole record with these stats, ninety minutes played. */
const played = (stats: Record<string, number>, points: number) => ({ stats: { minutes: 90, ...stats }, played: true, points });

/** Williams up front, who scored; Muñoz in midfield, who made it; Murillo, booked. Enciso, who
 *  scored Forest's, is in neither lineup. None plays a role the sets adjust. */
const PLAYERS = new Map<number, VidiprinterPlayer>([
  [CODE.williams, { name: "N.Williams", cell: ATTACK, role: undefined, inMatch: new Map([[IPSWICH_FOREST, played({ goals_scored: 1 }, 6)]]) }],
  [CODE.munoz, { name: "Muñoz", cell: MIDFIELD, role: undefined, inMatch: new Map([[IPSWICH_FOREST, played({ assists: 1 }, 5)]]) }],
  [CODE.murillo, { name: "Murillo", cell: { area: "defence", lane: "leftCentre" }, role: undefined, inMatch: new Map([[IPSWICH_FOREST, played({ yellow_cards: 1 }, 1)]]) }],
]);

/** Williams's running totals as the live reads showed them: past 60 minutes, and to two big
 *  chances made. */
const STEPS: StoredStep[] = [
  { playerCode: CODE.williams, stat: "minutes", from: 59, to: 60, minutes: 60, minute: 60 },
  { playerCode: CODE.williams, stat: "big_chance_created", from: 1, to: 2, minutes: 58, minute: 58 },
];

const MATCH: VidiprinterMatch = { fixtureCode: IPSWICH_FOREST, kickoff: KICKOFF, lines: STORED, steps: STEPS };

/** The first set, but a goal worth 7 anywhere, an assist 1, a yellow -2, and a point for every two
 *  big chances made. */
const OTHER_SET: ScoringSet = {
  ...FIRST_SCORING,
  rules: [
    ...FIRST_SCORING.rules.filter((rule) => !["goals_scored", "assists", "yellow_cards"].includes(rule.stat)),
    { shape: "perAction", stat: "goals_scored", values: { all: 7 } },
    { shape: "perAction", stat: "assists", values: { all: 1 } },
    { shape: "perAction", stat: "yellow_cards", values: { all: -2 } },
    { shape: "perCount", stat: "big_chance_created", values: { all: { every: 2, points: 1 } } },
  ],
} as ScoringSet;

const shown = (set: ScoringSet, matches = [MATCH]) => vidiprinter(matches, PLAYERS, set).map((line) => (line.points === null ? line.text : `${line.text} | ${line.points}`));

test("under the first set, the goal, the assist and the card show what they move, and the minutes band its threshold line", () => {
  const lines = shown(FIRST_SCORING as ScoringSet);
  expect(lines).toHaveLength(STORED.length + 1);
  expect(lines[0]).toBe("FT IPS 1–1 NFO: N.Williams 6, Muñoz 5, Murillo 1");
  expect(lines.slice(-2)).toEqual(["KO IPS v NFO", "Lineups out"]);
  // Only the lineups' men's lines carry points, in the match's own order.
  expect(lines.filter((line) => line.includes(" | ") || /GOAL|YELLOW/.test(line))).toEqual([
    "~60' N.Williams: 60 minutes | +1",
    "54' YELLOW Murillo | \u22121",
    "51' YELLOW Diop",
    "41' GOAL Enciso",
    "13' GOAL N.Williams, assist Muñoz | N.Williams +4, Muñoz +3",
  ]);
});

test("under another set the same lines move other points, and the big chances show a threshold line the first set has none for", () => {
  const lines = shown(OTHER_SET);
  expect(lines).toContain("13' GOAL N.Williams, assist Muñoz | N.Williams +7, Muñoz +1");
  expect(lines).toContain("54' YELLOW Murillo | \u22122");
  expect(lines).toContain("~58' N.Williams: 2 big chance created | +1");
  expect(shown(FIRST_SCORING as ScoringSet).filter((line) => line.includes("big chance"))).toEqual([]);
});

test("a goal shows his role's adjustment as his slot's points do: a poacher's goal 1 more, a false 9's 1 less", () => {
  const roles: ScoringSet = {
    ...FIRST_SCORING,
    roleAdjustments: [
      { role: "poacher", adjustments: [{ stat: "goals_scored", points: 1 }] },
      { role: "falseNine", adjustments: [{ stat: "goals_scored", points: -1 }] },
    ],
  } as ScoringSet;
  const goalIn = (role: string) => {
    const players = new Map(PLAYERS);
    players.set(CODE.williams, { ...PLAYERS.get(CODE.williams)!, role });
    return vidiprinter([MATCH], players, roles).find((line) => line.text.startsWith("13'"))!.points;
  };
  expect(goalIn("poacher")).toBe("N.Williams +5, Muñoz +3");
  expect(goalIn("falseNine")).toBe("N.Williams +3, Muñoz +3");
  // A role the set doesn't adjust moves nothing more.
  expect(goalIn("targetMan")).toBe("N.Williams +4, Muñoz +3");
});

test("a goal names its one man's points alone, and each further goal is priced at its own count", () => {
  const goal = (sourceId: number, minute: number) => ({ sourceId, text: `${minute}' GOAL N.Williams`, minute, addedMinute: 0, type: "goal", playerCodes: [CODE.williams] });
  const bands: ScoringSet = { ...OTHER_SET, rules: [{ shape: "bands", stat: "goals_scored", stack: false, values: { all: [{ atLeast: 1, points: 5 }, { atLeast: 2, points: 8 }] } }] };
  const twice = { ...PLAYERS.get(CODE.williams)!, inMatch: new Map([[IPSWICH_FOREST, played({ goals_scored: 2 }, 8)]]) };
  const lines = vidiprinter([{ ...MATCH, lines: [goal(2, 70), goal(1, 20)], steps: [] }], new Map([[CODE.williams, twice]]), bands);
  expect(lines.map((line) => [line.text, line.points])).toEqual([
    ["70' GOAL N.Williams", "+3"],
    ["20' GOAL N.Williams", "+5"],
  ]);
});

test("the matches' lines run newest first among each other, a later kickoff's after the earlier's, each match's own order kept", () => {
  const later: VidiprinterMatch = {
    fixtureCode: 2,
    kickoff: KICKOFF + 30 * MINUTE_MS,
    lines: [
      { sourceId: 9, text: "FT", minute: 1, addedMinute: 0, type: "end 14", playerCodes: [] },
      { sourceId: 8, text: "42' Corner", minute: 42, addedMinute: 0, type: "corner", playerCodes: [] },
      { sourceId: 7, text: "Lineups out", minute: null, addedMinute: null, type: "lineup", playerCodes: [] },
    ],
    steps: [],
  };
  const texts = vidiprinter([MATCH, later], new Map(), FIRST_SCORING as ScoringSet).map((line) => line.text);
  // 42' of the later match is the earlier's 57th minute, past its break: between 59' and 55'. Its
  // full-time line, which the feed gives minute 1, stays just above its last line.
  expect(texts.slice(texts.indexOf("59' Corner, conceded by Davis"), texts.indexOf("55' Offside Fatawu") + 1)).toEqual([
    "59' Corner, conceded by Davis",
    "FT",
    "42' Corner",
    "55' Offside Fatawu",
  ]);
  const priced = vidiprinter([MATCH, later], PLAYERS, OTHER_SET);
  expect(new Set(priced.map((line) => line.key)).size).toBe(priced.length);
});

test("a step to a total already shown is not shown again, nor is one for a man in neither lineup", () => {
  const steps: StoredStep[] = [...STEPS, { ...STEPS[1], from: 1, to: 2 }, { ...STEPS[1], playerCode: CODE.enciso }];
  const lines = vidiprinter([{ ...MATCH, steps }], PLAYERS, OTHER_SET).filter((line) => line.text.includes("big chance"));
  expect(lines.map((line) => line.text)).toEqual(["~58' N.Williams: 2 big chance created"]);
});

test("a line for a man whose record hasn't arrived shows no points yet", () => {
  const waiting = new Map(PLAYERS);
  waiting.set(CODE.munoz, { ...PLAYERS.get(CODE.munoz)!, inMatch: new Map([[IPSWICH_FOREST, { stats: null, played: true, points: null }]]) });
  const goal = vidiprinter([MATCH], waiting, FIRST_SCORING as ScoringSet).find((line) => line.text.startsWith("13'"));
  expect(goal?.points).toBe("N.Williams +4");
});

test("a step the clock gave no minute for sorts at its match's kickoff, after the lineups, not as the oldest line", () => {
  const unclocked: StoredStep = { ...STEPS[0], minute: null };
  const texts = vidiprinter([{ ...MATCH, steps: [unclocked] }], PLAYERS, FIRST_SCORING as ScoringSet).map((line) => line.text);
  expect(texts.at(-1)).toBe("Lineups out");
  expect(texts.indexOf("N.Williams: 60 minutes")).toBeLessThan(texts.indexOf("Lineups out"));
});
