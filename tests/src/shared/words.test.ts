import { describe, expect, it } from "vitest";
import { letterTime } from "../../../src/mail/words";
import { kickoffWords } from "../../../src/premierLeague/words";
import { timeOfDayWords } from "../../../src/shared/words";

// Moments built in the run's own zone, so the words come out the same in any zone.
const threePm = new Date(2026, 9, 17, 15, 0).getTime();
const fivePastNine = new Date(2026, 9, 20, 9, 5).getTime();

describe("timeOfDayWords", () => {
  it("says the hour and the minute, two digits each", () => {
    expect(timeOfDayWords(threePm)).toBe("15:00");
    expect(timeOfDayWords(fivePastNine)).toBe("09:05");
  });

  it("is what a kickoff and a letter's time both say", () => {
    expect(kickoffWords(fivePastNine)).toBe("09:05");
    expect(letterTime(fivePastNine)).toBe("09:05");
  });
});
