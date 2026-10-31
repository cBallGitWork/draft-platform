// The rules screens' draft (src/rules/rulesDraft.ts): a box left without a number is a change,
// though JSON writes NaN as null, the way a part with nothing set there is saved (#623); and a
// refusal for one is said in the bar when no box is found to say it beside (#645).

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRulesDraft, type RulesView } from "../../../src/rules/rulesDraft";

type Part = { limit: number | null; nested: { points: number | null } };

const SAVED: Part = { limit: null, nested: { points: null } };
const CHANGES_FROM = 3;
const VIEW: RulesView<Part, string> = { part: SAVED, revision: "rev", changesFrom: CHANGES_FROM };
const drafted = () => renderHook(() => useRulesDraft(VIEW, () => Promise.resolve(CHANGES_FROM)));

describe("whether the draft has changed", () => {
  it("is unchanged as it opens, and again once the edit is the saved part", () => {
    const { result } = drafted();
    expect(result.current.unchanged).toBe(true);

    act(() => result.current.edit({ ...SAVED }));
    expect(result.current.unchanged).toBe(true);
  });

  it.each([
    ["at the top", { ...SAVED, limit: NaN }],
    ["inside", { ...SAVED, nested: { points: NaN } }],
  ])("counts a blank number %s as a change where the saved part holds none", (_, edited) => {
    const { result } = drafted();
    act(() => result.current.edit(edited));

    expect(result.current.unchanged).toBe(false);
  });
});

describe("where a refusal for a box left without a number is said (#645)", () => {
  it("in the bar, when no blank box is found to say it beside", async () => {
    const words = "A box has no number.";
    const save = vi.fn(() => Promise.resolve(CHANGES_FROM));
    const { result } = renderHook(() => useRulesDraft(VIEW, save, () => words));
    act(() => result.current.edit({ ...SAVED, limit: NaN }));
    await act(() => result.current.saveDraft());

    expect(result.current.problem).toBe(words);
    expect(result.current.boxRefusal).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
});
