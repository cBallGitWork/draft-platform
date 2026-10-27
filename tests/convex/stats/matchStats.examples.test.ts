// spec/07's example tables, run row by row (#454): S07.2's lock times through the sync, and
// S07.5's feed for each stat through the merge. A row Craig changes fails here until the code agrees.

import { beforeEach, expect, test, vi } from "vitest";
import spec from "../../../spec/07-scoring.md?raw";
import { internal } from "../../../convex/_generated/api";
import { mergeStats } from "../../../convex/stats/matchRecords";
import { elapse, FULL_TIME_READ, heldMatch, syncAt, withHullEverton, withPlReadEmpty } from "../../support/convex/matchStats.harness";
import { FULL_STATS, recordedGw6 } from "../../support/recorded/gw6.payloads";
import { exampleTable } from "../../support/specExamples";
import { MINUTE_MS } from "../../../convex/shared/time";

beforeEach(() => vi.useFakeTimers());

/** A table's "17:40" as minutes into the day. */
function minutesOf(clock: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock);
  if (match === null) throw new Error(`"${clock}" is not a time like 17:00`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** The answers whose tables this file runs. */
const LOCKS = "S07.2";
const FEEDS = "S07.5";

const locks = exampleTable(spec, LOCKS);
const windowMinutes = Number(/window at (\d+) minutes/.exec(locks.caption)?.[1] ?? NaN);

test(`${LOCKS}'s caption names the window its rows assume`, () => {
  expect(windowMinutes).toBeGreaterThan(0);
});

test.each(locks.rows.map((row) => [row["full time"]!, row["last record arrives"]!, row["locks"]!]))(
  `${LOCKS}: full time at %s, the last record arriving at %s, locks at %s`,
  async (fullTime, arrives, locksAt) => {
    // Each time is read against the table's full time, which the harness's full-time read stands for.
    const at = (clock: string) => FULL_TIME_READ + (minutesOf(clock) - minutesOf(fullTime)) * MINUTE_MS;
    const t = await withHullEverton();
    await t.mutation(internal.admin.platformSettings.setStatCorrectionWindow, { minutes: windowMinutes });

    if (at(arrives) > FULL_TIME_READ) {
      // Coyle is the record still to come.
      await syncAt(t, FULL_TIME_READ, withPlReadEmpty(recordedGw6(), FULL_STATS.coyle.pl));
      await elapse(t, at(arrives) - FULL_TIME_READ);
    }
    await syncAt(t, at(arrives), recordedGw6());
    // A due lock runs when the test lets time pass, and stamps that moment: so the row is checked
    // a minute before its lock and at it, never by how far the test happened to elapse.
    await elapse(t, at(locksAt) - at(arrives) - MINUTE_MS);
    expect((await heldMatch(t)).status?.state).not.toBe("locked");

    await elapse(t, MINUTE_MS);
    expect((await heldMatch(t)).status).toMatchObject({ state: "locked", lockedAt: at(locksAt) });
  },
);

/** Each stat FEEDS' table names, under FPL's name and the Premier League's (Opta's). */
const FEED_NAMES: Record<string, { fpl: string; pl: string }> = {
  goals: { fpl: "goals_scored", pl: "goals" },
  assists: { fpl: "assists", pl: "goal_assist" },
  minutes: { fpl: "minutes", pl: "mins_played" },
  "yellow cards": { fpl: "yellow_cards", pl: "yellow_card" },
  "red cards": { fpl: "red_cards", pl: "red_card" },
  saves: { fpl: "saves", pl: "saves" },
  "clean sheets": { fpl: "clean_sheets", pl: "clean_sheet" },
  "goals conceded": { fpl: "goals_conceded", pl: "goals_conceded" },
  "penalties saved": { fpl: "penalties_saved", pl: "penalty_save" },
  "penalties missed": { fpl: "penalties_missed", pl: "att_pen_miss" },
  "own goals": { fpl: "own_goals", pl: "own_goals" },
  starts: { fpl: "starts", pl: "game_started" },
};

const feeds = exampleTable(spec, FEEDS);

test.each(feeds.rows.map((row) => [row["stat"]!, row["counts from"]!]))(
  `${FEEDS}: where both feeds send %s, %s's count is kept`,
  (stat, countsFrom) => {
    const names = FEED_NAMES[stat];
    if (names === undefined) throw new Error(`${FEEDS} names "${stat}", which this test can't map to the feeds' names`);
    // FPL sends 1 and the Premier League 2, so the value kept says whose count it is.
    const merged = mergeStats({ [names.fpl]: 1 }, { [names.pl]: 2 });
    if (countsFrom === "FPL") expect(merged).toEqual({ [names.fpl]: 1 });
    else if (countsFrom === "Premier League") expect(merged).toEqual({ [names.pl]: 2 });
    else throw new Error(`${FEEDS}'s "${countsFrom}" is neither FPL nor Premier League`);
  },
);
