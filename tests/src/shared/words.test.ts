import { describe, expect, it } from "vitest";
import { letterTime } from "../../../src/mail/words";
import { statusWords } from "../../../src/matchup/words";
import { clockWords as matchClockWords, kickoffWords } from "../../../src/premierLeague/words";
import { clockWords, liveWords, timeOfDayWords } from "../../../src/shared/words";

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

describe("clockWords", () => {
  it("says the Premier League's label to the minute, with stoppage time", () => {
    expect(clockWords("45+1'30", 46)).toBe("45+1'");
    expect(clockWords("67'12", 67)).toBe("67'");
  });

  it("says the whole minutes where the read has no label, and Live where it has neither", () => {
    expect(clockWords(null, 46)).toBe("46'");
    expect(clockWords(null, null)).toBe(liveWords);
  });

  it("is the one clock the matchup and the match page both say (#563)", () => {
    expect(statusWords.playing).toBe(clockWords);
    expect(matchClockWords).toBe(clockWords);
  });
});
