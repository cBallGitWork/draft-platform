// The rules screens' draft (src/rules/rulesDraft.ts): a box left without a number is a change,
// though JSON writes NaN as null, the way a part with nothing set there is saved (#623).

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
