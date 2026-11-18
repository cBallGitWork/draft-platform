import { expect, test } from "vitest";
import { FEED_TYPE } from "../../../convex/football/commentary";
import { NO_SUB, subsOf } from "../../../convex/match/matchSubs";
import { HULL_SCORER } from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords } from "../../support/convex/gameweekScoresMatch.harness";
import { ANN } from "../../support/convex/leagues.harness";
import { holdLines, manOf, matchAs, matchLeague, storedLine } from "../../support/convex/matchPage.harness";
import { silenceConsoleWarn } from "../../support/convex/test.harness";

// Who came on for whom, and when, for the match page's pitch (spec/10 S10.9; the approved picture
// `1440-pitch.png`: the man who went off "Off 62'", the sub "On 62'"), read from the stored lines,
// newest first, a substitution naming the man on first and the man off second.

const STARTER = 1;
const SUB = 2;
const SECOND_SUB = 3;
const LOGGED_AS = "Match 7";

let sourceId = 0;
const line = (type: string, minute: number | null, playerCodes: (number | null)[], addedMinute: number | null = null) => ({
  sourceId: ++sourceId,
  text: type,
  minute,
  addedMinute,
  type,
  playerCodes,
});

test("S10.9: a substitute came on for the man he replaced at its minute, who went off then; a sub taken off again goes off too", () => {
  const newestFirst = [line(FEED_TYPE.substitution, 90, [SECOND_SUB, SUB], 2), line(FEED_TYPE.goal, 70, [SUB]), line(FEED_TYPE.substitution, 62, [SUB, STARTER])];
  const subs = subsOf(newestFirst, LOGGED_AS);
  expect(subs.get(STARTER)).toEqual({ cameOn: null, wentOff: { minute: "62'" } });
  expect(subs.get(SUB)).toEqual({ cameOn: { minute: "62'", replaced: STARTER }, wentOff: { minute: "90+2'" } });
  expect(subs.get(SECOND_SUB)).toEqual({ cameOn: { minute: "90+2'", replaced: SUB }, wentOff: null });
});

test("S10.9: a substitution naming one man or no minute is left out, not guessed, and logged", () => {
  const warned = silenceConsoleWarn();
  const newestFirst = [line(FEED_TYPE.substitution, null, [SUB, STARTER]), line(FEED_TYPE.substitution, 62, [SUB])];
  expect(subsOf(newestFirst, LOGGED_AS).size).toBe(0);
  expect(warned).toHaveBeenCalledTimes(2);
});

test("S10.9: the match page carries each man's substitution from its stored lines, and none for a man who stayed on", async () => {
  const league = await matchLeague();
  await fullTimeRecords(league);
  const before = (await matchAs(league, ANN))!;
  const other = before.men.find((man) => man.playerCode !== HULL_SCORER && man.side === manOf(before.men, HULL_SCORER).side)!;
  await holdLines(league, [storedLine(1, "62' SUB", 62, FEED_TYPE.substitution, [other.playerCode, HULL_SCORER])]);
  const page = (await matchAs(league, ANN))!;
  expect(manOf(page.men, HULL_SCORER).sub).toEqual({ cameOn: null, wentOff: { minute: "62'" } });
  expect(manOf(page.men, other.playerCode).sub).toEqual({ cameOn: { minute: "62'", replaced: HULL_SCORER }, wentOff: null });
  const stayedOn = page.men.filter((man) => man.playerCode !== HULL_SCORER && man.playerCode !== other.playerCode);
  expect(stayedOn.map((man) => man.sub)).toEqual(stayedOn.map(() => NO_SUB));
});
