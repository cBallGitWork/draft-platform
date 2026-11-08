import { describe, expect, test } from "vitest";
import { DAY_MS, daysWords, HOUR_MS, hoursWords, MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";

// A span's words, which the letters and screens build from the server's numbers rather than retype
// (#1330): "within an hour", "at least 24 hours", "for a day".

describe("a span in words", () => {
  test("one unit reads as a word, more as a count", () => {
    expect(hoursWords(HOUR_MS)).toBe("an hour");
    expect(hoursWords(DAY_MS)).toBe("24 hours");
    expect(daysWords(DAY_MS)).toBe("a day");
    expect(daysWords(WEEK_MS)).toBe("7 days");
  });

  test("a span that isn't a whole number of units throws rather than be worded wrong", () => {
    expect(() => hoursWords(90 * MINUTE_MS)).toThrow(/no whole number of hours/);
    expect(() => daysWords(HOUR_MS)).toThrow(/no whole number of days/);
    expect(() => hoursWords(0)).toThrow();
  });
});
