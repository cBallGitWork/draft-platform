// The rules screens' draft (src/rules/rulesEdits.ts): a box left without a number is a change,
// though JSON writes NaN as null, the way a part with nothing set there is saved (#623); and a
// refusal for one is said in the bar when no box is found to say it beside (#645).

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRulesEdits, type RulesView } from "../../../src/rules/rulesEdits";

type Part = { limit: number | null; nested: { points: number | null } };

const SAVED: Part = { limit: null, nested: { points: null } };
const CHANGES_FROM = 3;
const VIEW: RulesView<Part, string> = { part: SAVED, revision: "rev", changesFrom: CHANGES_FROM };
const drafted = () => renderHook(() => useRulesEdits(VIEW, () => Promise.resolve(CHANGES_FROM)));

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

describe("an edit typed while a save runs (#1437)", () => {
  it("is kept once the save lands, over the save's own row, not taken as someone else's", async () => {
    let land = (_: number) => {};
    const save = vi.fn(() => Promise.resolve(CHANGES_FROM));
    save.mockImplementationOnce(() => new Promise<number>((resolve) => (land = resolve)));
    const { result, rerender } = renderHook(({ view }) => useRulesEdits(view, save), { initialProps: { view: VIEW } });
    const first = { ...SAVED, limit: 15 };
    const second = { ...SAVED, limit: 16 };
    act(() => result.current.edit(first));
    let saving: Promise<void> = Promise.resolve();
    act(() => void (saving = result.current.saveDraft()));
    await vi.waitFor(() => expect(save).toHaveBeenCalled());
    act(() => result.current.edit(second));

    rerender({ view: { ...VIEW, part: first, revision: "saved" } });
    await act(async () => {
      land(CHANGES_FROM);
      await saving;
    });
    expect(result.current.draft).toEqual(second);
    expect(result.current.overtaken).toBe(false);
    expect(result.current.unchanged).toBe(false);

    await act(() => result.current.saveDraft());
    expect(save).toHaveBeenLastCalledWith(second, "saved");
  });

  it("is let go, the saved part shown, when nothing was typed while it ran", async () => {
    const { result, rerender } = renderHook(({ view }) => useRulesEdits(view, () => Promise.resolve(CHANGES_FROM)), {
      initialProps: { view: VIEW },
    });
    const edited = { ...SAVED, limit: 15 };
    act(() => result.current.edit(edited));
    rerender({ view: { ...VIEW, part: edited, revision: "saved" } });
    await act(() => result.current.saveDraft());
    expect(result.current.unchanged).toBe(true);
    expect(result.current.overtaken).toBe(false);
  });
});

describe("where a refusal for a box left without a number is said (#645)", () => {
  it("in the bar, when no blank box is found to say it beside", async () => {
    const words = "A box has no number.";
    const save = vi.fn(() => Promise.resolve(CHANGES_FROM));
    const { result } = renderHook(() => useRulesEdits(VIEW, save, () => words));
    await act(() => result.current.saveDraft());

    expect(result.current.problem).toBe(words);
    expect(result.current.boxRefusal).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
});
