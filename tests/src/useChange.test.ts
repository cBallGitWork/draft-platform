// useChange: a screen's change under way, the words for why the last was refused or failed, and
// clearing them.

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { silenceConsoleError } from "../support/console.setup";
import type { Change } from "../../src/refusal";
import { useChange } from "../../src/useChange";
import { changeFailedWords } from "../../src/words";

const refusedWords = "Not yours to change";
const serverDown = new Error("server down");

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

  it.each([
    ["rejects", (): Change => Promise.reject(serverDown)],
    [
      "throws before it starts",
      (): Change => {
        throw serverDown;
      },
    ],
  ])("a change that %s is logged, says the failure words, and isn't left busy (#253)", async (_, change) => {
    const logged = silenceConsoleError();
    const { result } = renderHook(useChange);
    let made = true;
    await act(async () => {
      made = await result.current.run(change);
    });
    expect(made).toBe(false);
    expect(result.current.busy).toBe(false);
    expect(result.current.problem).toBe(changeFailedWords);
    expect(logged).toHaveBeenCalledWith("A change failed:", serverDown);
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
