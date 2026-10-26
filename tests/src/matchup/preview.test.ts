import { renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { previewMatchup } from "../../../src/matchup/preview";

// The matchup's preview (#46): its replayed matchup is the same object from one render to the next
// while the minute stands, as Convex's live query holds its result; a new one each render looped
// the screen's hold on the last matchup until React stopped it.

it("hands the screen the same matchup on each render while the minute stands", () => {
  window.history.replaceState(null, "", "/?preview=manager&minute=72");
  const { result, rerender } = renderHook(() => previewMatchup.useMatchup("preview-league" as Id<"leagues">, 0, {}));
  const first = result.current;
  rerender();
  expect(result.current).toBe(first);
});
