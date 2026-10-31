import { describe, expect, test } from "vitest";
import { figureWords, MINUS_SIGN, signedWords } from "../../../convex/shared/numberWords";

describe("the one minus sign (#564)", () => {
  test("is the true minus, U+2212, not the hyphen", () => {
    expect(MINUS_SIGN).toBe("−");
  });

  test("a figure carries a minus when below 0 and no sign otherwise", () => {
    expect(figureWords(-3)).toBe("−3");
    expect(figureWords(-0.5)).toBe("−0.5");
    expect(figureWords(4.5)).toBe("4.5");
    expect(figureWords(0)).toBe("0");
    expect(figureWords(-0)).toBe("0");
  });

  test("a signed number carries a plus above 0, a minus below, and nothing at 0", () => {
    expect(signedWords(4)).toBe("+4");
    expect(signedWords(0.5)).toBe("+0.5");
    expect(signedWords(-3)).toBe("−3");
    expect(signedWords(0)).toBe("0");
  });

  test("no hyphen is ever written", () => {
    for (const value of [-100, -12.5, -1, -0.1]) {
      expect(figureWords(value)).not.toContain("-");
      expect(signedWords(value)).not.toContain("-");
    }
  });
});
