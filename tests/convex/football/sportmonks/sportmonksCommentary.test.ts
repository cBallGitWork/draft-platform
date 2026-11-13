import { expect, test } from "vitest";
import { STREAM_BEHIND } from "../../../../convex/football/matchCommentary";
import { mapSportmonksMatch, type SportmonksEvent } from "../../../../convex/football/sportmonks/sportmonksMatch";
import { SM_EVENT_TYPE, sportmonksCommentary, sportmonksCommentaryRead } from "../../../../convex/football/sportmonks/sportmonksCommentary";
import { SM, sportmonksLiveRead } from "../../../support/recorded/sportmonks.payloads";

// The vidiprinter from Sportmonks' events timeline (#1418, `S10.4`, `S10.5`), on Celtic v Rangers'
// live read (sportmonks-docs-fixture.json, shaped from Sportmonks' docs, as the real read of
// 10 Nov 2026 had no live match, #1391). That read has no assist and no second yellow, so two events are added to it here.

const NAMES = new Map<number, string>([
  [SM.kyogo, "Kyogo"],
  [SM.mcCowan, "McCowan"],
  [SM.tavernier, "Tavernier"],
]);

function oldFirm() {
  return mapSportmonksMatch(sportmonksLiveRead().data[0]!);
}

function event(fields: Partial<SportmonksEvent> & Pick<SportmonksEvent, "id" | "typeId" | "minute">): SportmonksEvent {
  return { extraMinute: null, teamId: null, playerId: null, relatedPlayerId: null, result: null, info: null, addition: null, ...fields };
}

/** Not in the read: Kyogo's goal from McCowan's pass, then Tavernier's second yellow. */
const ADDED = [
  event({ id: 601, typeId: SM_EVENT_TYPE.goal, minute: 74, teamId: SM.celtic, playerId: SM.kyogo, relatedPlayerId: SM.mcCowan, result: "3-1" }),
  event({ id: 602, typeId: SM_EVENT_TYPE.secondYellow, minute: 90, extraMinute: 3, teamId: SM.rangers, playerId: SM.tavernier }),
];

test("a match's events give its lines, newest first, each keyed on the event's id", () => {
  const { lines, unworded } = sportmonksCommentary([...oldFirm().events, ...ADDED], NAMES);
  expect(lines.map((line) => [line.sourceId, line.text])).toEqual([
    [602, "90+3' RED Tavernier, second yellow"],
    [601, "74' GOAL Kyogo, assist McCowan"],
    [501, "68' SUB McCowan on, Kyogo off"],
    [504, "55' GOAL Tavernier, penalty"],
    [505, "55' VAR Tavernier, penalty confirmed"],
    [503, "45+2' YELLOW Tavernier"],
    [506, "45+1' GOAL Kyogo"],
    [502, "12' GOAL Kyogo"],
  ]);
  expect(unworded).toEqual([]);
  // The Premier League's line types and men, so the matchup prices either feed's goal alike.
  expect(lines[1]).toMatchObject({ minute: 74, addedMinute: null, type: "goal", playerCodes: [SM.kyogo, SM.mcCowan] });
  expect(lines[0]).toMatchObject({ minute: 90, addedMinute: 3, type: "secondyellow card", playerCodes: [SM.tavernier] });
});

test("reading the same events again gives no new line, and a resent event replaces its line", () => {
  const { events } = oldFirm();
  const once = sportmonksCommentary(events, NAMES).lines;
  expect(sportmonksCommentary([...events, ...events], NAMES).lines).toEqual(once);
  const moved = events.map((each) => (each.id === 502 ? { ...each, minute: 13 } : each));
  const resent = sportmonksCommentary([...events, ...moved], NAMES).lines;
  expect(resent).toHaveLength(once.length);
  expect(resent.at(-1)).toMatchObject({ sourceId: 502, text: "13' GOAL Kyogo" });
});

test("a real read's VAR calls, worded in `addition`, keep their call; its goal names the assist", () => {
  // Events as the dev deployment's real read of Celtic 1-0 Kilmarnock sent them (#1450, 10 Nov 2026).
  const [baur, yang, nygren, scales, duran] = [37582048, 37563550, 19979885, 123659, 37709508];
  const names = new Map([[baur, "Baur"], [yang, "Yang"], [nygren, "Nygren"], [scales, "Scales"], [duran, "Durán"]]);
  const { lines, unworded } = sportmonksCommentary(
    [
      event({ id: 158609571, typeId: SM_EVENT_TYPE.goal, minute: 26, playerId: scales, relatedPlayerId: duran, result: "1-0", info: "Left foot shot", addition: "1st Goal" }),
      event({ id: 158609122, typeId: SM_EVENT_TYPE.var, minute: 15, playerId: baur, addition: "Goal disallowed" }),
      event({ id: 158612149, typeId: SM_EVENT_TYPE.var, minute: 73, playerId: yang, addition: "Penalty awarded" }),
      event({ id: 158612120, typeId: SM_EVENT_TYPE.missedPenalty, minute: 76, playerId: nygren, addition: "Goalkeeper save" }),
    ],
    names,
  );
  expect(lines.map((line) => line.text)).toEqual([
    "76' PENALTY Nygren, missed",
    "73' VAR Yang, penalty awarded",
    "26' GOAL Scales, assist Durán",
    "15' VAR Baur, goal disallowed",
  ]);
  expect(unworded).toEqual([]);
});

test("a man with no name given is unknown, and a VAR call with no man or words says VAR", () => {
  const { lines } = sportmonksCommentary(
    [
      event({ id: 1, typeId: SM_EVENT_TYPE.yellowCard, minute: 30, playerId: 999 }),
      event({ id: 2, typeId: SM_EVENT_TYPE.var, minute: 31 }),
    ],
    NAMES,
  );
  expect(lines.map((line) => line.text)).toEqual(["31' VAR", "30' YELLOW unknown"]);
});

test("the read keeps up while its newest line is within ten minutes of the clock", () => {
  const match = oldFirm();
  expect(match.score).toMatchObject({ state: "live", minutes: 67 });
  expect(sportmonksCommentaryRead(match.events, match.score, NAMES).delayed).toBeNull();
});

test("the read is behind once its newest line trails the clock by over ten minutes", () => {
  const match = oldFirm();
  // The newest line is the 68th minute's substitution.
  expect(sportmonksCommentaryRead(match.events, { ...match.score, minutes: 78 }, NAMES).delayed).toBeNull();
  expect(sportmonksCommentaryRead(match.events, { ...match.score, minutes: 79 }, NAMES).delayed).toBe(STREAM_BEHIND);
  expect(sportmonksCommentaryRead(match.events, { ...match.score, state: "halfTime", minutes: 90 }, NAMES).delayed).toBeNull();
});

test("an event of a type with no wording is left out and delays the commentary, never dropped unseen", () => {
  const match = oldFirm();
  const shootout = event({ id: 700, typeId: 23, minute: 120, playerId: SM.kyogo });
  const { lines, delayed } = sportmonksCommentaryRead([...match.events, shootout], match.score, NAMES);
  expect(lines?.map((line) => line.sourceId)).not.toContain(700);
  expect(delayed).toBe("1 events of a type with no wording (23)");
});
