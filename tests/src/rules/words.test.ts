import { describe, expect, it } from "vitest";
import { blankGamesWords, blankTimeoutsWords, savedWords as settingsSaved } from "../../../src/leagueSettings/words";
import { blankBoxWords, savedWords as scoringSaved } from "../../../src/scoring/words";

// Player scoring and League settings word what they share alike (Craig, 1 Nov 2026, on #351).
describe("the two rules screens' shared words", () => {
  it("say a save went through the same way, each with its own reach", () => {
    expect(scoringSaved(9)).toBe("Saved. The new scoring applies to every league from Gameweek 9.");
    expect(settingsSaved(9)).toBe("Saved. The new settings apply from Gameweek 9, and the league has a letter saying so.");
  });

  it("say an empty box has no number the same way", () => {
    expect(blankBoxWords("Assists")).toBe("A box in Assists has no number. Fill it in, then save.");
    expect(blankGamesWords).toBe("Games a gameweek has no number. Fill it in, then save.");
    expect(blankTimeoutsWords).toBe("Timeouts before auto-pick has no number. Fill it in, or turn auto-pick after timeouts off, then save.");
  });
});
