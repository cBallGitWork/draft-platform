// useChange: a screen's change under way, the words for why the last was refused, and clearing them.

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Change } from "../../src/refusal";
import { useChange } from "../../src/useChange";

const refusedWords = "Not yours to change";

/** A change the test answers by hand: made (null) or refused with words. */
function heldChange() {
  let answer: (refused: string | null) => void = () => {};
  const change = (): Change =>
    new Promise((resolve) => {
      answer = resolve;
    });
  return { change, answer: (refused: string | null) => answer(refused) };
}

describe("useChange", () => {
  it("is busy while the change is under way, then resolves true with no problem once it's made", async () => {
    const { result } = renderHook(useChange);
    const held = heldChange();
    let made: Promise<boolean> = Promise.resolve(false);
    act(() => {
      made = result.current.run(held.change);
    });
    expect(result.current.busy).toBe(true);
    await act(async () => held.answer(null));
    expect(await made).toBe(true);
    expect(result.current.busy).toBe(false);
    expect(result.current.problem).toBeNull();
  });

  it("resolves false and keeps the refusal's words as the problem", async () => {
    const { result } = renderHook(useChange);
    let made = true;
    await act(async () => {
      made = await result.current.run(async () => refusedWords);
    });
    expect(made).toBe(false);
    expect(result.current.busy).toBe(false);
    expect(result.current.problem).toBe(refusedWords);
  });

  it("clear forgets the last refusal", async () => {
    const { result } = renderHook(useChange);
    await act(async () => {
      await result.current.run(async () => refusedWords);
    });
    expect(result.current.problem).toBe(refusedWords);
    act(() => result.current.clear());
    expect(result.current.problem).toBeNull();
  });
});
