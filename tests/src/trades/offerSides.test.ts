// When an offer closes (#1788): one answer, in its row's short form and its panel's long one, so
// the two never disagree; an offer with no deadline left has none, a greyed dash in both.

import { describe, expect, it } from "vitest";
import { closesOf } from "../../../src/trades/offerSides";
import { whenWords } from "../../../src/trades/words";
import { screenOffer } from "../../support/src/trades.harness";

const DEADLINE = Date.parse("2026-11-14T11:00:00Z");
const REVIEW_ENDS = Date.parse("2026-11-12T09:30:00Z");

describe("when an offer closes", () => {
  it("at a known deadline: the time in its row, the gameweek's deadline and the time in its panel", () => {
    const closes = closesOf(screenOffer({ closes: { gameweek: 10, at: DEADLINE } }));
    expect(closes).toEqual({
      row: whenWords(DEADLINE),
      panel: `At the GW10 deadline, ${whenWords(DEADLINE)}`,
    });
  });

  it("in the trade deadline's gameweek: after its last match, the same in both", () => {
    expect(closesOf(screenOffer({ closes: { gameweek: 12, at: null } }))).toEqual({
      row: "After GW12's last match",
      panel: "After GW12's last match",
    });
  });

  it("in review: when its review ends, the same in both", () => {
    expect(
      closesOf(screenOffer({ reviewEndsAt: REVIEW_ENDS, closes: null })),
    ).toEqual({ row: whenWords(REVIEW_ENDS), panel: whenWords(REVIEW_ENDS) });
  });

  it("with no deadline left: nothing, in both", () => {
    expect(closesOf(screenOffer({ closes: null }))).toBeNull();
  });
});
