// A player's line in a classic league (spec/22, Lines; #2623): one of five over his positions,
// starting as the line he has most starts in, moved by a run of starts in another line, and the
// admin's line winning over all of it.

import { describe, expect, test } from "vitest";
import { lineOf, lineOfPosition, LINE_NAMES, type LineInputs } from "../../../convex/positions/lines";
import { FIRST_THRESHOLDS } from "../../../convex/positions/positionChanges";
import { POSITIONS } from "../../../convex/positions/positionTables";
import type { Start } from "../../../convex/positions/positions";
import { CENTRE_BACK, HOLDING, LEFT_WINGER, played, RIGHT_BACK, times } from "../../support/convex/positionStarts.harness";
import { DAY_MS } from "../../../convex/shared/time";

const inputs = (starts: Start[], more: Partial<LineInputs> = {}): LineInputs => ({
  starts,
  adminLine: null,
  thresholds: FIRST_THRESHOLDS,
  judgedBefore: null,
  ...more,
});
const lineFrom = (starts: Start[], more?: Partial<LineInputs>) => lineOf(inputs(starts, more));

describe("S22.3 the lines", () => {
  test("S22.3 are GK, DEF (CB, FB, WB), CM (CDM, CM, WM), AM (CAM, W) and FWD (ST, SS)", () => {
    expect(LINE_NAMES).toEqual(["GK", "DEF", "CM", "AM", "FWD"]);
    expect(Object.fromEntries(POSITIONS.map((position) => [position, lineOfPosition(position)]))).toEqual({
      GK: "GK",
      CB: "DEF",
      FB: "DEF",
      WB: "DEF",
      CDM: "CM",
      CM: "CM",
      WM: "CM",
      CAM: "AM",
      W: "AM",
      SS: "FWD",
      ST: "FWD",
    });
  });
});

describe("S22.4 S22.5 his one line", () => {
  test("S22.4 S22.5 is the one line he has most starts in, whatever positions he plays in it", () => {
    expect(lineFrom(played(CENTRE_BACK, HOLDING, RIGHT_BACK, CENTRE_BACK, HOLDING))).toEqual({
      line: "DEF",
      source: "starts",
      movedFrom: null,
      flagged: null,
    });
  });

  test("S22.5 counts only his newest 38 starts", () => {
    // 26 at DEF and 24 at CM in all, but 14 and 24 in his newest 38, with no run long enough to flag.
    const starts = played(...times(CENTRE_BACK, 14), ...Array.from({ length: 12 }, () => [HOLDING, HOLDING, CENTRE_BACK]).flat());
    expect(lineFrom(starts)).toEqual({ line: "CM", source: "starts", movedFrom: null, flagged: null });
  });

  test("S22.5 a tie goes to the line he started in last", () => {
    expect(lineFrom(played(HOLDING, CENTRE_BACK, CENTRE_BACK, HOLDING)).line).toBe("CM");
  });

  test("S22.5 is none while no start places him", () => {
    expect(lineFrom([]).line).toBeNull();
  });
});

describe("S22.6 a run of starts in another line", () => {
  test("S22.6 of 3 flags him to move, warning his manager, and 6 moves him there", () => {
    const run = (count: number) => lineFrom(played(...times(HOLDING, 16), ...times(CENTRE_BACK, count)));
    expect(run(2)).toMatchObject({ line: "CM", flagged: null });
    expect(run(3)).toMatchObject({ line: "CM", flagged: { line: "DEF", startsThere: 3 } });
    expect(run(5)).toMatchObject({ line: "CM", flagged: { line: "DEF", startsThere: 5 } });
    expect(run(6)).toMatchObject({ line: "DEF", movedFrom: "CM", flagged: null });
  });

  test("S22.6 recent starts win: 16 in one line then 15 in another, he plays the newer", () => {
    expect(lineFrom(played(...times(HOLDING, 16), ...times(CENTRE_BACK, 15))).line).toBe("DEF");
  });

  test("S22.6 is broken by a start back in his line, and runs across two other lines don't add up", () => {
    expect(lineFrom(played(...times(HOLDING, 10), CENTRE_BACK, CENTRE_BACK, HOLDING, CENTRE_BACK)).flagged).toBeNull();
    expect(lineFrom(played(...times(HOLDING, 10), CENTRE_BACK, CENTRE_BACK, LEFT_WINGER, LEFT_WINGER)).flagged).toBeNull();
    expect(lineFrom(played(...times(HOLDING, 10), ...times(CENTRE_BACK, 6), HOLDING, HOLDING))).toMatchObject({ line: "DEF", movedFrom: "CM" });
  });

  test("S22.6 a start that places him nowhere neither adds to the run nor ends it", () => {
    const nowhere = { formation: null, line: null, place: null };
    const starts = played(...times(HOLDING, 10), CENTRE_BACK, CENTRE_BACK, nowhere, CENTRE_BACK);
    expect(lineFrom(starts).flagged).toEqual({ line: "DEF", startsThere: 3 });
  });

  test("S22.6 moves him only between gameweeks: starts from the league's own deadline wait for the next", () => {
    const starts = played(...times(HOLDING, 10), ...times(CENTRE_BACK, 6));
    const sixthDefStart = starts.at(-1)!.kickoff;
    expect(lineFrom(starts, { judgedBefore: sixthDefStart })).toMatchObject({ line: "CM", flagged: { line: "DEF", startsThere: 5 } });
    expect(lineFrom(starts, { judgedBefore: sixthDefStart + DAY_MS }).line).toBe("DEF");
  });

  test("S22.6 follows the admin's thresholds", () => {
    const starts = played(...times(HOLDING, 10), ...times(CENTRE_BACK, 2));
    expect(lineFrom(starts, { thresholds: { flagAfter: 1, removeAfter: 2 } })).toMatchObject({ line: "DEF", movedFrom: "CM" });
  });
});

describe("S22.7 the admin's line", () => {
  test("S22.7 wins over his starts, flagging nothing", () => {
    expect(lineFrom(played(...times(HOLDING, 10), ...times(CENTRE_BACK, 4)), { adminLine: "FWD" })).toEqual({
      line: "FWD",
      source: "admin",
      movedFrom: null,
      flagged: null,
    });
    expect(lineFrom([], { adminLine: "GK" }).line).toBe("GK");
  });
});
