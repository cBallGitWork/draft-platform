import { describe, expect, test } from "vitest";
import { FIRST_THRESHOLDS } from "../../../convex/positions/positionChanges";
import { NO_ADMIN, positionsOf, type AdminPositions, type PositionInputs, type Start } from "../../../convex/positions/positions";
import type { Position } from "../../../convex/positions/positionTables";
import {
  CENTRE_BACK,
  HOLDING,
  LEFT_WINGER,
  movedToFullBack,
  NUMBER_TEN,
  played,
  RIGHT_BACK,
  startsFrom,
  times,
  type Place,
} from "../../support/convex/positionStarts.harness";
/** spec/06's window, written out rather than read from `START_WINDOW`, so changing it fails here. */
const SPEC_WINDOW = 38;

/** `count` starts at `place`: the newest kicks off at `newest`, each next one a millisecond earlier. */
function startsAt(place: Place, count: number, newest = 1_000_000): Start[] {
  return Array.from({ length: count }, (_, index) => ({ ...place, fixtureCode: newest - index, kickoff: newest - index }));
}

function inputs(changes: Omit<Partial<PositionInputs>, "admin"> & { admin?: Partial<AdminPositions> } = {}): PositionInputs {
  const settled: Omit<PositionInputs, "admin"> = { starts: [], plLabel: null, approveMode: "proposals", thresholds: FIRST_THRESHOLDS, judgedBefore: null };
  return { ...settled, ...changes, admin: { ...NO_ADMIN, ...changes.admin } };
}

/** Positions as `{position: source}`, "?" marking each unconfirmed one. */
function held(given: PositionInputs): Record<string, string> {
  return Object.fromEntries(positionsOf(given).positions.map((each) => [each.position, each.source + (each.confirmed ? "" : "?")]));
}

const approvedFb = { approved: ["FB"] as Position[] };

describe("from starts", () => {
  test("3 starts at a place give its position; 2 do not", () => {
    expect(held(inputs({ starts: startsAt(RIGHT_BACK, 3), admin: approvedFb }))).toEqual({ FB: "starts" });
    expect(held(inputs({ starts: startsAt(RIGHT_BACK, 2), admin: approvedFb }))).toEqual({});
  });

  test(`only his newest ${SPEC_WINDOW} starts count`, () => {
    const older = startsAt(RIGHT_BACK, 3, 1_000);
    const newer = startsAt(CENTRE_BACK, SPEC_WINDOW, 1_000_000);

    // Thresholds no run reaches: the newer starts are all a run elsewhere for FB (tested below).
    const noChanges = { flagAfter: SPEC_WINDOW + 1, removeAfter: SPEC_WINDOW + 2 };
    const given = inputs({ starts: [...older, ...newer], admin: { approved: ["FB", "CB"] }, thresholds: noChanges });

    expect(held(given)).toEqual({ CB: "starts" });
    expect(held({ ...given, starts: [...older, ...newer.slice(2)] })).toEqual({ CB: "starts" }); // two in the window
    expect(held({ ...given, starts: [...older, ...newer.slice(3)] })).toEqual({ CB: "starts", FB: "starts" });
  });

  test("a start on a sheet with no formation counts towards the window but gives nothing", () => {
    const bare = startsAt({ formation: null, line: null, place: null }, SPEC_WINDOW, 1_000_000);
    expect(held(inputs({ starts: [...bare, ...startsAt(RIGHT_BACK, 3, 1_000)], admin: approvedFb }))).toEqual({});
  });

  test("a formation the table does not know is reported and gives nothing", () => {
    const result = positionsOf(inputs({ starts: startsAt({ formation: "2-3-5", line: 1, place: 0 }, 5) }));

    expect(result.positions).toEqual([]);
    expect(result.unknownFormations).toEqual(["2-3-5"]);
  });
});

describe("the admin's approval", () => {
  test("unapproved, his starts are proposals and he plays on his label, unconfirmed", () => {
    const result = positionsOf(inputs({ starts: startsAt(RIGHT_BACK, 3), plLabel: "Centre Central Defender" }));

    expect(result.proposals).toEqual(["FB"]);
    expect(held(inputs({ starts: startsAt(RIGHT_BACK, 3), plLabel: "Centre Central Defender" }))).toEqual({ CB: "label?" });
  });

  test("once one start-position counts, his label does not", () => {
    const given = inputs({ starts: startsAt(RIGHT_BACK, 3), plLabel: "Centre Central Defender", admin: approvedFb });
    expect(held(given)).toEqual({ FB: "starts" });
  });

  test("counting at once, starts count unconfirmed and stay proposals until approved", () => {
    const given = inputs({ starts: [...startsAt(RIGHT_BACK, 3), ...startsAt(CENTRE_BACK, 3, 500)], approveMode: "countAtOnce", admin: approvedFb });

    expect(held(given)).toEqual({ CB: "starts?", FB: "starts" });
    expect(positionsOf(given).proposals).toEqual(["CB"]);
  });

  test("a label he confirmed stays confirmed only while the label stays the same", () => {
    const confirmed = { confirmedLabel: "Left Full Back" };
    expect(held(inputs({ plLabel: "Left Full Back", admin: confirmed }))).toEqual({ FB: "label" });
    expect(held(inputs({ plLabel: "Left Wing Back", admin: confirmed }))).toEqual({ WB: "label?" });
  });
});

describe("the admin's own positions", () => {
  test("a position he sets holds with no starts and no label, and wins over starts as its source", () => {
    expect(held(inputs({ admin: { set: ["GK"] } }))).toEqual({ GK: "admin" });
    expect(held(inputs({ starts: startsAt(RIGHT_BACK, 3), admin: { approved: ["FB"], set: ["FB"] } }))).toEqual({ FB: "admin" });
  });

  test("SS he marks is added to what his starts give", () => {
    const given = inputs({ starts: startsAt(NUMBER_TEN, 5), admin: { approved: ["CAM"], set: ["SS"] } });
    expect(held(given)).toEqual({ CAM: "starts", SS: "admin" });
  });

  test("a position he removes is never given back, by starts or by label, nor proposed again", () => {
    const removed = { removed: ["FB", "CB"] as Position[] };
    const given = inputs({ starts: startsAt(RIGHT_BACK, 3), plLabel: "Defender", admin: removed });

    expect(positionsOf(given).positions).toEqual([]);
    expect(positionsOf(given).proposals).toEqual([]);
    expect(held({ ...given, approveMode: "countAtOnce", admin: { ...given.admin, approved: ["FB"] } })).toEqual({});
  });
});

describe("his label", () => {
  test("a vague label gives every position it could mean", () => {
    expect(held(inputs({ plLabel: "Defender" }))).toEqual({ CB: "label?", FB: "label?" });
  });

  test("a label the table does not know gives nothing, and is reported", () => {
    const result = positionsOf(inputs({ plLabel: "Libero" }));
    expect([result.positions, result.unknownLabel]).toEqual([[], "Libero"]);
  });

  test("positions come out once each, in the order of the labels", () => {
    const given = inputs({ plLabel: "Forward", admin: { set: ["GK"] } });
    expect(positionsOf(given).positions.map((each) => each.position)).toEqual(["GK", "W", "SS", "ST"]);
  });
});

describe("when positions change (spec/06)", () => {
  const NO_PLACE = { formation: null, line: null, place: null };
  const UNKNOWN_PLACE = { formation: "2-3-5", line: 1, place: 0 };
  const bothApproved = { approved: ["CB", "FB"] as Position[] };

  /** Positions as `{position: source}`, "!n" marking one flagged after n starts elsewhere. */
  function flags(given: PositionInputs): Record<string, string> {
    return Object.fromEntries(
      positionsOf(given).positions.map((each) => [each.position, each.source + (each.flaggedElsewhere === null ? "" : `!${each.flaggedElsewhere}`)]),
    );
  }

  test("spec/06's starting point: flagged after 3 starts in a row elsewhere, removed after 6", () => {
    expect(FIRST_THRESHOLDS).toEqual({ flagAfter: 3, removeAfter: 6 });
  });

  test("a position from starts is flagged after 3 starts in a row elsewhere, not 2", () => {
    expect(flags(inputs({ starts: movedToFullBack(2), admin: bothApproved }))).toEqual({ CB: "starts" });
    expect(flags(inputs({ starts: movedToFullBack(3), admin: bothApproved }))).toEqual({ CB: "starts!3", FB: "starts" });
    expect(flags(inputs({ starts: movedToFullBack(5), admin: bothApproved }))).toEqual({ CB: "starts!5", FB: "starts" });
  });

  test("it is removed after 6, not 5, and no longer counts", () => {
    const given = inputs({ starts: movedToFullBack(6), admin: bothApproved });
    expect(flags(given)).toEqual({ FB: "starts" });
    expect(positionsOf(given).removed).toEqual(["CB"]);
    expect(positionsOf(inputs({ starts: movedToFullBack(5), admin: bothApproved })).removed).toEqual([]);
  });

  test("one start back at the position ends the run, and a removed one counts again while his window holds 3 there", () => {
    const back = [...movedToFullBack(6), ...startsFrom(12, CENTRE_BACK)];
    expect(flags(inputs({ starts: back, admin: bothApproved }))).toEqual({ CB: "starts", FB: "starts" });

    const awayAgain = [...back, ...startsFrom(13, ...times(RIGHT_BACK, 3))];
    expect(flags(inputs({ starts: awayAgain, admin: bothApproved }))).toEqual({ CB: "starts!3", FB: "starts" });
  });

  test("a start that gives no position neither adds to the run nor ends it", () => {
    const unread = [...movedToFullBack(2), ...startsFrom(8, NO_PLACE, UNKNOWN_PLACE)];
    expect(flags(inputs({ starts: unread, admin: bothApproved }))).toEqual({ CB: "starts" });

    const thenFullBack = [...unread, ...startsFrom(10, RIGHT_BACK)];
    expect(flags(inputs({ starts: thenFullBack, admin: bothApproved }))).toEqual({ CB: "starts!3", FB: "starts" });
  });

  test("starts after the last gameweek boundary wait for the next to be judged", () => {
    const starts = movedToFullBack(6);
    const sixthAtFullBack = starts.at(-1)!.kickoff;

    const given = inputs({ starts, admin: bothApproved, judgedBefore: sixthAtFullBack });

    expect(flags(given)).toEqual({ CB: "starts!5", FB: "starts" });
    expect(flags({ ...given, judgedBefore: sixthAtFullBack + 1 })).toEqual({ FB: "starts" });
  });

  test("the admin's thresholds are the ones used", () => {
    const tuned = { flagAfter: 1, removeAfter: 2 };
    expect(flags(inputs({ starts: movedToFullBack(1), admin: bothApproved, thresholds: tuned }))).toEqual({ CB: "starts!1" });
    expect(flags(inputs({ starts: movedToFullBack(3), admin: bothApproved, thresholds: tuned }))).toEqual({ FB: "starts" });
    expect(flags(inputs({ starts: movedToFullBack(3), admin: bothApproved, thresholds: { flagAfter: 4, removeAfter: 8 } }))).toEqual({
      CB: "starts",
      FB: "starts",
    });
  });

  test("a position the admin set is never flagged or removed, though his starts give it too", () => {
    const given = inputs({ starts: movedToFullBack(6), admin: { ...bothApproved, set: ["CB"] } });
    expect(flags(given)).toEqual({ CB: "admin", FB: "starts" });
    expect(positionsOf(given).removed).toEqual([]);
  });

  test("a label's positions are not from starts: never flagged, whatever his starts", () => {
    const fewAnywhere = played(...times(RIGHT_BACK, 2), ...times(HOLDING, 2), ...times(LEFT_WINGER, 2));
    const given = inputs({ starts: fewAnywhere, plLabel: "Centre Central Defender" });
    expect(flags(given)).toEqual({ CB: "label" });
    expect(positionsOf(given).removed).toEqual([]);
  });

  test("with every position from his starts removed, he plays on his label", () => {
    const scattered = played(...times(CENTRE_BACK, 5), ...times(RIGHT_BACK, 2), ...times(HOLDING, 2), ...times(LEFT_WINGER, 2));
    const given = inputs({ starts: scattered, plLabel: "Left Full Back", admin: bothApproved });
    expect(flags(given)).toEqual({ FB: "label" });
    expect(positionsOf(given).removed).toEqual(["CB"]);
  });

  test("a position a run removed never comes back from a vague label that would give it", () => {
    const given = inputs({ starts: played(...times(RIGHT_BACK, 5), ...times(LEFT_WINGER, 6)), plLabel: "Defender", admin: { ...NO_ADMIN, approved: ["FB"] } });
    expect(positionsOf(given).removed).toEqual(["FB"]);
    expect(flags(given)).toEqual({ CB: "label" });
  });

  test("an unapproved position from starts that a run removes is no longer proposed, nor listed as removed", () => {
    const result = positionsOf(inputs({ starts: movedToFullBack(6) }));
    expect([result.proposals, result.removed]).toEqual([["FB"], []]);
  });

  test("counting at once, an unapproved position from starts is flagged and removed too", () => {
    const given = inputs({ starts: movedToFullBack(3), approveMode: "countAtOnce" });
    expect(flags(given)).toEqual({ CB: "starts!3", FB: "starts" });
    expect(positionsOf({ ...given, starts: movedToFullBack(6) }).removed).toEqual(["CB"]);
  });
});
