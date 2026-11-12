// The Tactics tab's preview (src/myTeam/tactics/preview.ts) keeps a saved plan as the server does:
// its slots and both team instructions (spec/05 `S05.12`), so loading it brings the pair back (#1772: the preview
// dropped the instructions).

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FIRST_RULES } from "../../../../convex/rules/firstRules";
import type { InstructionPair } from "../../../../convex/lineup/instructions";
import { previewSquad, previewTactics } from "../../../../src/myTeam/tactics/preview";
import { loadedPlan, planSlotsOf } from "../../../../src/myTeam/tactics/savedPlans";
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
