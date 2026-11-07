import { expect, test, vi } from "vitest";
import { COMMENTARY_BEHIND_MINUTES } from "../../../convex/football/matchCommentary";
import { MINUTE_MS } from "../../../convex/shared/time";
import {
  annsScoredGame,
  EVERTON_STARTERS,
  GAMEWEEK,
  HULL_BENCH,
  HULL_KEEPER,
  HULL_SCORER,
  lineupOf,
  nameOf,
  PHILLIPS,
  scoresLeague,
  slotOf,
} from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords, scoreRead } from "../../support/convex/gameweekScoresMatch.harness";
import { MIDFIELD_GOAL } from "../../support/convex/gameweekScoresFixes.harness";
import { holdLines, storedLine, STREAM_BEHIND_SINCE_KICKOFF } from "../../support/convex/matchPage.harness";
import { HULL_EVERTON } from "../../support/convex/matchStats.harness";

// The matchup's commentary (#434; spec/10, The matchup): Hull v Everton's stored lines as Ann's
// matchup reads them, Ann fielding Hull and Bob Everton, each line priced for the men it names.

test("the commentary is the match's stored lines, the goal priced for its scorer, the full-time line listing both lineups' men's points, and says when delayed", async () => {
  const league = await scoresLeague();
  expect((await annsScoredGame(league, GAMEWEEK)).commentary).toEqual({ kind: "read", lines: [], delayed: false });

  await fullTimeRecords(league);
  const scorer = await nameOf(league, HULL_SCORER);
  await holdLines(
    league,
    [storedLine(3, "FT HUL 1–2 EVE", 1, "end 14"), storedLine(2, `64' GOAL ${scorer}`, 64, "goal", [HULL_SCORER]), storedLine(1, "KO HUL v EVE", 0, "start")],
    STREAM_BEHIND_SINCE_KICKOFF,
  );

  const { commentary, team, opponent } = await annsScoredGame(league, GAMEWEEK);
  if (commentary.kind !== "read") throw new Error(`the commentary wasn't read: ${commentary.reason}`);
  const scorerSlot = slotOf(team, HULL_SCORER);
  expect(commentary.delayed).toBe(true);
  expect(commentary.lines.map((each) => each.text).slice(1)).toEqual([`64' GOAL ${scorer}`, "KO HUL v EVE"]);
  expect(commentary.lines[1].points).toBe(`+${MIDFIELD_GOAL}`);
  expect(commentary.lines[0].text).toMatch(/^FT HUL 1–2 EVE: /);
  expect(commentary.lines[0].text).toContain(`${scorer} ${scorerSlot.points}`);
  const evertonKeeper = EVERTON_STARTERS[0].playerCode;
  expect(commentary.lines[0].text).toContain(`${await nameOf(league, evertonKeeper)} ${slotOf(opponent, evertonKeeper).points}`);
  // Phillips, Hull's unused keeper, didn't play, so isn't listed.
  expect(commentary.lines[0].text).not.toContain(await nameOf(league, PHILLIPS));
});

// "If the commentary stream falls behind or stops, the matchup and the match page say so" (spec/10,
// The commentary; #917): with the live tick stopped, nothing reads the stream to mark it, so the
// read judges it, the match clock run on from the held score's read.
test("with the tick stopped mid-match, the commentary says delayed once its newest line trails the clock by over 10 minutes", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  const readAt = Date.now();
  await scoreRead(league, "live", 60);
  await holdLines(league, [storedLine(2, "58' YELLOW Bench", 58, "yellow card"), storedLine(1, "KO HUL v EVE", 0, "start")]);
  const delayedAt = async (minutesLater: number) => {
    vi.setSystemTime(readAt + minutesLater * MINUTE_MS);
    const { commentary } = await annsScoredGame(league, GAMEWEEK);
    if (commentary.kind !== "read") throw new Error(`the commentary wasn't read: ${commentary.reason}`);
    return commentary.delayed;
  };

  expect(await delayedAt(0)).toBe(false);
  // The clock at 68', ten behind the newest line: not over.
  expect(await delayedAt(COMMENTARY_BEHIND_MINUTES - 2)).toBe(false);
  expect(await delayedAt(COMMENTARY_BEHIND_MINUTES - 1)).toBe(true);

  // At half-time and at full time the clock stops, so nothing trails it.
  await scoreRead(league, "halfTime", 60);
  expect(await delayedAt(COMMENTARY_BEHIND_MINUTES + 5)).toBe(false);
  await scoreRead(league, "fullTime", 90);
  expect(await delayedAt(COMMENTARY_BEHIND_MINUTES + 30)).toBe(false);
});

// "for every player, owned or not, bench included" (spec/10, The commentary; #835).
test("a line naming a man on a lineup's bench is priced for him, as his greyed slot is", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  const benchMan = HULL_BENCH.find((code) => code !== HULL_KEEPER)!;
  const booked = storedLine(1, "80' YELLOW Bench", 80, "yellow card", [benchMan]);
  await holdLines(league, [booked]);
  const { commentary, team } = await annsScoredGame(league, GAMEWEEK);
  expect(lineupOf(team).bench.map((slot) => slot.playerCode)).toContain(benchMan);
  expect(commentary).toEqual({ kind: "read", lines: [{ key: `${HULL_EVERTON}:1`, text: booked.text, points: "−1" }], delayed: false });
});
