// The roles' runs on the Tactics pitch (spec/05 Runs; #846; Craig, 31 Oct 2026): each moving role's
// run is a dashed arrow from his place, read from the role; a role that holds its place draws
// nothing. On the desk every run shows, with a switch to hide them; on a phone only the tapped
// player's. Which width hides which is the CSS's: the real browser checks it at 390 and 1440
// (tests/smoke/smoke.spec.ts); here, the utility each run carries.

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ALL_CELLS } from "../../../../convex/lineup/pitch";
import { roleIn, rolesOfSlot, slotLabel, SWEEPER, SWEEPER_CELL } from "../../../../convex/lineup/roles";
import { placeOf, RUN_MARGIN, RUN_MARK, runPath, runShows, SWEEPER_DEPTH_SHARE } from "../../../../src/myTeam/tactics/runs";
import { LANE_WIDTH, PITCH_SIZE, ROW_LENGTH } from "../../../../src/myTeam/tactics/pitchMarkings";
import { runsWords } from "../../../../src/myTeam/tactics/words";
import { blockOf, HAVERTZ, openedPitch, pitch, RICE, SALIBA, SAVED, STARTERS } from "../../../support/src/tacticsScreen.harness";

/** The players whose runs are drawn, by code, each with the utility hiding it where it doesn't show. */
const drawnRuns = () =>
  Array.from(pitch().querySelectorAll(`[${RUN_MARK}]`)).map((run) => ({ code: Number(run.getAttribute(RUN_MARK)), hidden: run.getAttribute("class") ?? "" }));
const codes = () => drawnRuns().map(({ code }) => code).toSorted();

const PHONE_HIDES = "max-lg:hidden";
const DESK_HIDES = "lg:hidden";

describe("the runs on the pitch", () => {
  it("every moving role's run draws, on the desk only until he is tapped; the keeper's role holds, so his draws nothing", async () => {
    await openedPitch();
    // Saliba a stopper, Rice box-to-box and Havertz a poacher, the slots' first roles, all move;
    // Raya, a shot-stopper, holds.
    expect(codes()).toEqual([SALIBA, RICE, HAVERTZ].map(({ playerCode }) => playerCode).toSorted());
    expect(drawnRuns().every(({ hidden }) => hidden === PHONE_HIDES)).toBe(true);
  });

  it("a role that holds its place draws nothing", async () => {
    const holding = STARTERS.map((starter) => (starter.playerCode === SALIBA.playerCode ? { ...starter, role: "ballPlayingDefender" } : starter));
    await openedPitch({ tactics: { ...SAVED, lineup: { ...SAVED.lineup, starters: holding } } });
    expect(codes()).not.toContain(SALIBA.playerCode);
    expect(codes()).toHaveLength(2);
  });

  it("the tapped player's run shows on the phone too, and only his", async () => {
    await openedPitch();
    await userEvent.click(blockOf(RICE, { area: "midfield", lane: "centre" }));
    const shown = drawnRuns().filter(({ hidden }) => !hidden.split(" ").includes(PHONE_HIDES));
    expect(shown).toEqual([{ code: RICE.playerCode, hidden: "" }]);
  });

  it("the switch hides every run on the desk, the tapped player's included, and shows them again", async () => {
    await openedPitch();
    const runsSwitch = screen.getByRole("checkbox", { name: runsWords });
    expect((runsSwitch as HTMLInputElement).checked).toBe(true);
    await userEvent.click(runsSwitch);
    expect(drawnRuns()).toEqual([]);
    // Tapped, his run stays the phone's, where the switch isn't.
    await userEvent.click(blockOf(RICE, { area: "midfield", lane: "centre" }));
    expect(drawnRuns()).toEqual([{ code: RICE.playerCode, hidden: DESK_HIDES }]);
    await userEvent.click(runsSwitch);
    expect(codes()).toHaveLength(3);
  });

  it("who sees a run: the desk while the switch is on, the phone only the tapped player's", () => {
    expect(runShows(false, true)).toBe(PHONE_HIDES);
    expect(runShows(false, false)).toBeNull();
    expect(runShows(true, true)).toBe("");
    expect(runShows(true, false)).toBe(DESK_HIDES);
  });
});

describe("where a run goes, in the pitch's metres", () => {
  const LEFT_WING = { area: "attackingMidfield", lane: "left" } as const;
  const RIGHT_WING = { area: "attackingMidfield", lane: "right" } as const;
  const insideForward = roleIn(LEFT_WING, "insideForward").run!;

  it("starts at his place and goes forward up the pitch, toward the middle from either wing", () => {
    const fromLeft = runPath(insideForward, LEFT_WING);
    const fromRight = runPath(insideForward, RIGHT_WING);
    expect(fromLeft[0]).toEqual(placeOf(LEFT_WING));
    expect(fromLeft[1].y).toBeLessThan(fromLeft[0].y);
    expect(fromLeft[1].x).toBeGreaterThan(fromLeft[0].x);
    expect(fromRight[1].x).toBeLessThan(fromRight[0].x);
    expect(fromRight[1].x).toBeCloseTo(PITCH_SIZE.width - fromLeft[1].x);
  });

  it("stops short of the goal line, from a slot further up than its usual one", () => {
    const striker = { area: "attack", lane: "centre" } as const;
    const end = runPath(roleIn(striker, "shadowStriker").run!, striker).at(-1)!;
    expect(end.y).toBe(RUN_MARGIN);
  });

  it("starts a sweeper's from where his cell is drawn, a little deeper than the line", () => {
    const line = placeOf(SWEEPER_CELL);
    const sweeper = runPath(roleIn(SWEEPER_CELL, "sweeper").run!, SWEEPER_CELL, true)[0];
    expect(sweeper.x).toBe(line.x);
    expect(sweeper.y - line.y).toBeCloseTo(SWEEPER_DEPTH_SHARE * ROW_LENGTH);
  });

  it("puts a place in the middle of its cell: the keeper's in the bottom row, the attack's in the top", () => {
    expect(placeOf({ area: "goalkeeper", lane: "centre" })).toEqual({ x: PITCH_SIZE.width / 2, y: PITCH_SIZE.length - ROW_LENGTH / 2 });
    expect(placeOf({ area: "attack", lane: "left" })).toEqual({ x: LANE_WIDTH / 2, y: ROW_LENGTH / 2 });
  });

  it("ends a straight run between two rows' players, in every cell that offers its role, so no block hides its arrowhead", () => {
    /** How far from where two rows meet a run may end, in metres, and still show between their players. */
    const BETWEEN_ROWS = 1;
    for (const cell of ALL_CELLS) {
      for (const { key, run } of rolesOfSlot(cell)) {
        if (run === null || run.path.some(({ across }) => across !== 0)) continue;
        const end = runPath(run, cell, slotLabel(cell, key) === SWEEPER).at(-1)!;
        const fromRowsMeeting = Math.abs(end.y - Math.round(end.y / ROW_LENGTH) * ROW_LENGTH);
        expect(fromRowsMeeting, `${key} from ${cell.area} ${cell.lane}`).toBeLessThanOrEqual(BETWEEN_ROWS);
      }
    }
  });
});
