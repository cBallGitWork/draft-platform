import { expect, test } from "vitest";
import { codesByOpta, namedMen } from "./feedIds";
import { matchSlots, plStats, type MatchSlot } from "./plMatch";
import { fplElementsWithout, FULL_STATS, MATCH, recordedGw6, recordedPlFixture } from "./recorded/gw6.payloads";

const { fpl, pl } = recordedGw6();
const hullEverton = recordedPlFixture(MATCH.hullEverton.pl);
const codeByOpta = codesByOpta(fpl.bootstrap.elements);

// The recorded bootstrap lists only Hull's and Everton's men. For the other ten sheets, FPL's rule
// (opta_code is "p" + code, true of all its 668 players and pinned in feedIds.test.ts) stands in.
const everyMan = pl.fixtures.flatMap(namedMen);
const codeByOptaRule = new Map(everyMan.map((man) => [man.altIds!.opta, Number(man.altIds!.opta.slice(1))]));
const codeByPlId = new Map(everyMan.map((man) => [man.id, codeByOptaRule.get(man.altIds!.opta)!]));
const everySlot = pl.fixtures.flatMap((each) => matchSlots(each, codeByOptaRule).slots);

test("every man named for Hull v Everton has a slot: 22 starters and 18 on the bench", () => {
  const { slots, unmatched } = matchSlots(hullEverton, codeByOpta);

  expect(unmatched).toEqual([]);
  expect(slots.filter((slot) => slot.started)).toHaveLength(22);
  expect(slots.filter((slot) => !slot.started)).toHaveLength(18);
});

test("a starter's slot is his formation, his line and his place along it", () => {
  const slot = (code: number) => matchSlots(hullEverton, codeByOpta).slots.find((each) => each.playerCode === code);

  expect(slot(FULL_STATS.coyle.code)).toEqual<MatchSlot>({
    playerCode: FULL_STATS.coyle.code,
    fixtureCode: MATCH.hullEverton.code,
    started: true,
    formation: "5-4-1",
    line: 1,
    place: 0,
  });
  expect(slot(FULL_STATS.mcBurnie.code)).toMatchObject({ formation: "5-4-1", line: 3, place: 0 });
  expect(slot(FULL_STATS.grealish.code)).toMatchObject({ formation: "4-2-3-1", line: 3, place: 2 });
});

test("a substitute's slot has no formation, line or place, whether or not he came on", () => {
  const slots = matchSlots(hullEverton, codeByOpta).slots;
  for (const code of [FULL_STATS.phillips.code, FULL_STATS.belloumi.code]) {
    expect(slots.find((slot) => slot.playerCode === code)).toMatchObject({
      started: false,
      formation: null,
      line: null,
      place: null,
    });
  }
});

test("every starter on the twelve recorded sheets, with a back five, four or three, has a place", () => {
  const sheets = pl.fixtures.flatMap((each) => each.teamLists!.map((list) => list!.formation!.label));

  expect(sheets.sort()).toEqual([
    "3-4-2-1",
    "3-4-2-1",
    "3-4-2-1",
    "3-4-2-1",
    ...Array<string>(7).fill("4-2-3-1"),
    "5-4-1",
  ]);
  expect(everySlot.filter((slot) => slot.started)).toHaveLength(12 * 11);
  expect(everySlot.filter((slot) => slot.started && slot.line === 0)).toHaveLength(12);
});

// What #22 has to go on: Opta's own formation_place for each starter, laid out as the sheet draws
// him. Each formation's lines run from the side's right: a back four is 2 (right back), 5, 6, 3.
test("Opta's formation_place is fixed by a starter's formation, line and place", () => {
  const places = new Map<string, number[][]>();
  for (const { fixture: plId, player, payload } of pl.playerStats) {
    const code = codeByPlId.get(player);
    const slot = everySlot.find((each) => each.playerCode === code && each.fixtureCode === fixtureCodeOf(plId))!;
    if (!slot.started) continue;
    const layout = places.get(slot.formation!) ?? [];
    places.set(slot.formation!, layout);
    const line = (layout[slot.line!] ??= []);
    const place = plStats(payload).formation_place;
    if (line[slot.place!] !== undefined) expect(line[slot.place!]).toBe(place);
    line[slot.place!] = place;
  }

  expect(Object.fromEntries(places)).toEqual({
    "5-4-1": [[1], [2, 6, 5, 4, 3], [7, 8, 10, 11], [9]],
    "4-2-3-1": [[1], [2, 5, 6, 3], [8, 4], [7, 10, 11], [9]],
    "3-4-2-1": [[1], [6, 5, 4], [2, 7, 8, 3], [10, 11], [9]],
  });
});

test("a sheet with no formation still names its starters, with no line or place", () => {
  const bare = recordedPlFixture(MATCH.hullEverton.pl);
  delete bare.teamLists![0]!.formation;

  const starters = matchSlots(bare, codeByOpta).slots.filter((slot) => slot.started);

  expect(starters.filter((slot) => slot.formation === null && slot.line === null)).toHaveLength(11);
  expect(starters.filter((slot) => slot.formation === "4-2-3-1")).toHaveLength(11);
});

test("a side not yet named has no slots", () => {
  const halfNamed = { ...hullEverton, teamLists: [hullEverton.teamLists![0], null] };
  expect(matchSlots(halfNamed, codeByOpta).slots).toHaveLength(20);
});

test("a man FPL does not list has no slot and is reported", () => {
  const without = codesByOpta(fplElementsWithout(FULL_STATS.coyle.code));

  const { slots, unmatched } = matchSlots(hullEverton, without);

  expect(slots).toHaveLength(39);
  expect(unmatched.map((man) => man.plPlayerId)).toEqual([FULL_STATS.coyle.pl]);
});

test("a fixture with no FPL code throws rather than file slots under no match", () => {
  expect(() => matchSlots({ ...hullEverton, altIds: undefined }, codeByOpta)).toThrow(
    `PL fixture ${MATCH.hullEverton.pl} carries no FPL fixture code`,
  );
});

test.each([
  [
    "draws a man who is not starting",
    (lines: number[][]) => {
      lines[3][0] = FULL_STATS.phillips.pl;
    },
    "does not draw the 11 men",
  ],
  [
    "leaves a starter out",
    (lines: number[][]) => {
      lines[2].pop();
    },
    "draws lines of 1-5-3-1",
  ],
  [
    "draws a starter twice",
    (lines: number[][]) => {
      lines[3][0] = lines[1][0];
    },
    "does not draw the 11 men",
  ],
] as const)("a formation that %s is a changed payload, and throws", (_what, change, message) => {
  const changed = recordedPlFixture(MATCH.hullEverton.pl);
  change(changed.teamLists![0]!.formation!.players);

  expect(() => matchSlots(changed, codeByOpta)).toThrow(`team 41's 5-4-1 ${message}`);
});

test("a formation whose label does not count its lines throws", () => {
  const changed = recordedPlFixture(MATCH.hullEverton.pl);
  changed.teamLists![0]!.formation!.label = "4-4-2";

  expect(() => matchSlots(changed, codeByOpta)).toThrow("team 41's 4-4-2 draws lines of 1-5-4-1");
});

function fixtureCodeOf(plId: number): number {
  return Object.values(MATCH).find((match) => match.pl === plId)!.code;
}
