// useChoiceAmong: a picker's choice kept to one still on offer as its options change (the team an
// invite is for, a team to move a player to, a position to give, a category to add, the match to
// override).

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useChoiceAmong } from "../../../src/shared/useChoiceAmong";

const render = (options: readonly string[], initial?: string) =>
  renderHook(({ offered }) => useChoiceAmong(offered, initial), { initialProps: { offered: options } });

describe("useChoiceAmong", () => {
  it("shows the first on offer until one is chosen", () => {
    const { result } = render(["a", "b"]);
    expect(result.current[0]).toBe("a");
  });

  it("shows what it starts on while that is on offer, else the first", () => {
    expect(render(["a", "b"], "b").result.current[0]).toBe("b");
    expect(render(["a", "b"], "z").result.current[0]).toBe("a");
  });

  it("shows the one chosen", () => {
    const { result } = render(["a", "b"]);
    act(() => result.current[1]("b"));
    expect(result.current[0]).toBe("b");
  });

  it("falls back to the first once the one chosen leaves, and comes back to it if it returns", () => {
    const { result, rerender } = render(["a", "b", "c"]);
    act(() => result.current[1]("c"));
    rerender({ offered: ["a", "b"] });
    expect(result.current[0]).toBe("a");
    rerender({ offered: ["b", "c"] });
    expect(result.current[0]).toBe("c");
  });

  it("is undefined while nothing is on offer, and shows the first once something is", () => {
    const { result, rerender } = render([]);
    expect(result.current[0]).toBeUndefined();
    rerender({ offered: ["b"] });
    expect(result.current[0]).toBe("b");
  });
});
