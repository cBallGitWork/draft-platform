import { describe, expect, it } from "vitest";
import { letterTime } from "../../../src/mail/words";
import { statusWords } from "../../../src/matchup/words";
import { clockWords as matchClockWords, kickoffWords } from "../../../src/premierLeague/words";
import { clockWords, halfTime, liveWords, scoreWords } from "../../../src/shared/match/words";
import { timeOfDayWords } from "../../../src/shared/when/words";

describe("scoreWords", () => {
  it("writes a matchup's points below 0 with the true minus (#564)", () => {
    expect(scoreWords(2, 1)).toBe("2–1");
    expect(scoreWords(-2, 5.5)).toBe("−2–5.5");
  });
});

// Moments built in the run's own zone, so the words come out the same in any zone.
const threePm = new Date(2026, 9, 17, 15, 0).getTime();
const fivePastNine = new Date(2026, 9, 20, 9, 5).getTime();

describe("timeOfDayWords", () => {
  it("says the time 12-hour, as UK football sites write a kick-off: no \":00\" on the hour, a dot before the minutes", () => {
    expect(timeOfDayWords(threePm)).toBe("3pm");
    expect(timeOfDayWords(fivePastNine)).toBe("9.05am");
    expect(timeOfDayWords(new Date(2026, 9, 21, 19, 45).getTime())).toBe("7.45pm");
    expect(timeOfDayWords(new Date(2026, 9, 21, 0, 30).getTime())).toBe("12.30am");
  });

  it("says midnight and noon on the hour", () => {
    expect(timeOfDayWords(new Date(2026, 9, 21, 0, 0).getTime())).toBe("midnight");
    expect(timeOfDayWords(new Date(2026, 9, 21, 12, 0).getTime())).toBe("noon");
  });

  it("is what a kickoff and a letter's time both say", () => {
    expect(kickoffWords(fivePastNine)).toBe("9.05am");
    expect(letterTime(fivePastNine)).toBe("9.05am");
  });
});

describe("clockWords", () => {
  it("says the Premier League's label to the minute, with stoppage time", () => {
    expect(clockWords("live", "45+1'30", 46)).toBe("45+1'");
    expect(clockWords("live", "67'12", 67)).toBe("67'");
  });

  it("says the whole minutes where the read has no label, and Live where it has neither", () => {
    expect(clockWords("live", null, 46)).toBe("46'");
    expect(clockWords("live", null, null)).toBe(liveWords);
  });

  it("says HT at half-time, whatever the clock read last", () => {
    expect(clockWords("halfTime", "45+2'00", 47)).toBe(halfTime.short);
    expect(clockWords("halfTime", null, null)).toBe(halfTime.short);
  });

  it("is the one clock the matchup and the match page both say (#563)", () => {
    expect(statusWords.playing).toBe(clockWords);
    expect(matchClockWords).toBe(clockWords);
  });
});
