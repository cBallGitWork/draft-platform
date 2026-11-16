// The Tactics tab's preview (src/myTeam/tactics/preview.ts) keeps a saved plan as the server does:
// its slots and both team instructions (spec/05 `S05.12`), so loading it brings the pair back (#1772: the preview
// dropped the instructions).

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FIRST_RULES } from "../../../../convex/rules/firstRules";
import type { InstructionPair } from "../../../../convex/lineup/instructions";
import { previewSquad, previewTactics } from "../../../../src/myTeam/tactics/preview";
import { loadedPlan, planSlotsOf } from "../../../../src/myTeam/tactics/savedPlans";
import { reshaped } from "../../../../src/myTeam/tactics/reshape";
import { STARTER_COUNT } from "../../../../convex/lineup/lineup";
import { A_LEAGUE_ID } from "../../../support/src/convexReact.harness";

const AWAY_DAYS: InstructionPair = { attacking: "getItWide", defensive: "pressHigh" };
const CHANGED: InstructionPair = { attacking: "shootOnSight", defensive: "getStuckIn" };
const positionsOf = (playerCode: number) => previewSquad.find((member) => member.playerCode === playerCode)?.positions ?? [];

describe("the preview's saved plans", () => {
  it("bring back both team instructions a plan was saved with", async () => {
    const { result } = renderHook(() => ({
      tactics: previewTactics.useTactics(A_LEAGUE_ID, 0),
      plans: previewTactics.usePlans(A_LEAGUE_ID),
    }));
    const tactics = result.current.tactics;
    if (tactics?.kind !== "open") throw new Error("the preview's tactics are open");
    const { starters, bench } = tactics.lineup;

    await act(() => previewTactics.usePlanChanges().save(A_LEAGUE_ID, "Away days", planSlotsOf({ starters, bench }), AWAY_DAYS));
    const plan = result.current.plans!.find(({ name }) => name === "Away days")!;
    expect(plan.instructions).toEqual(AWAY_DAYS);

    const loaded = loadedPlan({ starters, bench, instructions: CHANGED }, plan, FIRST_RULES.presets, { positionsOf }, () => []);
    expect(loaded?.lineup.instructions).toEqual(AWAY_DAYS);
  });
});

// #2449: picking 4-3-3 on the preview left ten starters, as its squad had only two who play central
// midfield's three slots (Palmer now plays CM too), and 3-5-2 did the same with one wing back
// (Gvardiol now plays WB too).
describe("the preview's squad fills a preset from a full eleven (spec/05 `S05.36`)", () => {
  const presetCells = (name: string) => FIRST_RULES.presets.find((preset) => preset.name === name)!.cells;

  it("S05.36: 4-4-2 to 4-3-3 keeps eleven starters", () => {
    const { result } = renderHook(() => previewTactics.useTactics(A_LEAGUE_ID, 0));
    if (result.current?.kind !== "open") throw new Error("the preview's tactics are open");
    const { starters, bench } = result.current.lineup;
    const fourFourTwo = reshaped({ starters, bench }, presetCells("4-4-2"), { positionsOf }, () => []);
    expect(fourFourTwo.starters).toHaveLength(STARTER_COUNT);
    expect(reshaped(fourFourTwo, presetCells("4-3-3"), { positionsOf }, () => []).starters).toHaveLength(STARTER_COUNT);
  });

  it.each(["4-3-3", "3-5-2"])("S05.36: %s picked from the first lineup keeps eleven starters", (name) => {
    const { result } = renderHook(() => previewTactics.useTactics(A_LEAGUE_ID, 0));
    if (result.current?.kind !== "open") throw new Error("the preview's tactics are open");
    const { starters, bench } = result.current.lineup;
    expect(reshaped({ starters, bench }, presetCells(name), { positionsOf }, () => []).starters).toHaveLength(STARTER_COUNT);
  });
});
