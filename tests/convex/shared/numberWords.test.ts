import { describe, expect, test } from "vitest";
import { countInWords, figureWords, MINUS_SIGN, signedWords } from "../../../convex/shared/numberWords";

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

describe("a count written out (#1330)", () => {
  test("up to ten is a word, past ten or not whole its figure", () => {
    expect(countInWords(2)).toBe("two");
    expect(countInWords(3)).toBe("three");
    expect(countInWords(10)).toBe("ten");
    expect(countInWords(11)).toBe("11");
    expect(countInWords(1.5)).toBe("1.5");
  });
});
