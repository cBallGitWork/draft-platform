import { describe, expect, test } from "vitest";
import type { Lineup } from "../../../convex/lineup/lineup";
import type { ScoringSet } from "../../../convex/scoring/scoringSet";
import type { PlayerMatch } from "../../../convex/scoring/teamPoints";
import {
  ATTACK,
  BELLOUMI,
  COYLE,
  fplRecordOf,
  GELHARDT,
  NOT_ARRIVED,
  plRecordOf,
  RIGHT_BACK,
  team,
  withMatches,
} from "../../support/convex/teamPoints.harness";

describe("provisional until every record that counts has arrived and every match is final", () => {
  test('a starter\'s record not yet arrived: "—" in every category, left out of the total, provisional', () => {
    const scored = team({ matches: withMatches(GELHARDT, [NOT_ARRIVED]) });
    const gelhardt = scored.starters[2];

    expect(gelhardt?.points).toBeNull();
    expect(gelhardt?.matches[0]?.categories.every((category) => category.points === null)).toBe(true);
    expect(scored.total).toBe(12);
    expect(scored.provisional).toBe(true);
  });

  test("a record arrived but a match not yet final: its points count, provisional", () => {
    const live = { record: fplRecordOf(GELHARDT), final: false };
    const scored = team({ matches: withMatches(GELHARDT, [live]) });
    expect(scored.starters[2]).toMatchObject({ points: 6, provisional: true });
    expect(scored.total).toBe(18);
    expect(scored.provisional).toBe(true);
  });

  test("a starter subbed off no longer holds the team provisional; the sub who came on does", () => {
    const offNotArrived = team({
      matches: withMatches(GELHARDT, [NOT_ARRIVED]),
      substitutions: [{ off: GELHARDT, on: BELLOUMI, cell: ATTACK }],
    });
    expect(offNotArrived.provisional).toBe(false);

    const onNotArrived = team({
      matches: withMatches(BELLOUMI, [NOT_ARRIVED]),
      substitutions: [{ off: GELHARDT, on: BELLOUMI, cell: ATTACK }],
    });
    expect(onNotArrived.provisional).toBe(true);
  });
});

describe('a whole record not arrived is "—"; a stat left out of an arrived record is 0', () => {
  // The Premier League's lines leave most noughts out (docs/pl-match-stats.md).
  const PL_SET: ScoringSet = {
    rules: [
      { shape: "perAction", stat: "total_scoring_att", values: { all: 5 } },
      { shape: "perAction", stat: "won_tackle", values: { all: 1 } },
    ],
    wholePointsOnly: false,
  };
  const coyleOnly: Lineup = {
    starters: [{ playerCode: COYLE, ...RIGHT_BACK }],
    bench: [],
  };
  const coyleTeam = (match: PlayerMatch) =>
    team({
      lineup: coyleOnly,
      set: PL_SET,
      matches: new Map([[COYLE, [match]]]),
      benchCells: new Map(),
    });

  test("a right back who didn't shoot: 0 for shots, counted, and final", () => {
    const coyle = plRecordOf(COYLE);
    expect("total_scoring_att" in coyle).toBe(false);

    const scored = coyleTeam({ record: coyle, final: true });
    expect(scored.starters[0]?.matches[0]?.categories).toMatchObject([
      { stat: "total_scoring_att", points: 0 },
      { stat: "won_tackle", points: 1 },
    ]);
    expect(scored).toMatchObject({ total: 1, provisional: false });
  });

  test('his whole record not arrived: "—" in both, nothing counted, provisional', () => {
    const scored = coyleTeam(NOT_ARRIVED);
    expect(scored.starters[0]?.matches[0]?.categories).toMatchObject([
      { stat: "total_scoring_att", points: null },
      { stat: "won_tackle", points: null },
    ]);
    expect(scored).toMatchObject({ total: 0, provisional: true });
  });
});
