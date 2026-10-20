import { describe, expect, test } from "vitest";
import { NO_ADMIN, positionsOf, START_WINDOW, type AdminPositions, type PositionInputs, type Start } from "./positions";
import type { Position } from "./positionTables";

// Places of a 4-2-3-1, as its sheet draws them: line 1 is the back four, right back first.
const RIGHT_BACK = { formation: "4-2-3-1", line: 1, place: 0 };
const CENTRE_BACK = { formation: "4-2-3-1", line: 1, place: 1 };
const NUMBER_TEN = { formation: "4-2-3-1", line: 3, place: 1 };

/** `count` starts at `place`, the first `newest` milliseconds after the epoch and older from there. */
function startsAt(place: Omit<Start, "fixtureCode" | "kickoff">, count: number, newest = 1_000_000): Start[] {
  return Array.from({ length: count }, (_, index) => ({ ...place, fixtureCode: newest - index, kickoff: newest - index }));
}

function inputs(changes: Omit<Partial<PositionInputs>, "admin"> & { admin?: Partial<AdminPositions> } = {}): PositionInputs {
  return { starts: [], plLabel: null, approveMode: "proposals", ...changes, admin: { ...NO_ADMIN, ...changes.admin } };
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

  test(`only his newest ${START_WINDOW} starts count`, () => {
    const older = startsAt(RIGHT_BACK, 3, 1_000);
    const newer = startsAt(CENTRE_BACK, START_WINDOW, 1_000_000);

    const given = inputs({ starts: [...older, ...newer], admin: { approved: ["FB", "CB"] } });

    expect(held(given)).toEqual({ CB: "starts" });
    expect(held({ ...given, starts: [...older, ...newer.slice(2)] })).toEqual({ CB: "starts" }); // two in the window
    expect(held({ ...given, starts: [...older, ...newer.slice(3)] })).toEqual({ CB: "starts", FB: "starts" });
  });

  test("a start on a sheet with no formation counts towards the window but gives nothing", () => {
    const bare = startsAt({ formation: null, line: null, place: null }, START_WINDOW, 1_000_000);
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
