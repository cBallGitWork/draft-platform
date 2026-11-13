import { expect, test } from "vitest";
import {
  fixturesOf,
  type HeldMatch,
} from "../../../convex/football/clubFixtures";
import { previewPremierLeague } from "../../../src/premierLeague/preview";
import { previewClub, proLeague } from "../../../src/shared/preview";
import {
  ARSENAL,
  CHELSEA,
  SPURS,
} from "../../support/src/premierLeague.harness";

// A club's matches from its side (spec/18, the Fixtures tab, `S18.9`): each at home or away by the
// match's home and away clubs (#1966).

const clubMatch = (
  fixtureCode: number,
  gameweek: number,
  home: HeldMatch["home"],
  away: HeldMatch["away"],
): HeldMatch => ({
  fixtureCode,
  gameweek,
  kickoff: gameweek * 1000,
  home,
  away,
  score: null,
});

test("a club is at home where it is the match's home club and away where it is the away club", () => {
  const fixtures = fixturesOf(
    [
      clubMatch(10, 1, ARSENAL, CHELSEA),
      clubMatch(20, 2, SPURS, ARSENAL),
      clubMatch(30, 3, CHELSEA, SPURS),
    ],
    ARSENAL.code,
  );
  expect(
    fixtures.map(({ fixtureCode, atHome, opponent }) => ({
      fixtureCode,
      atHome,
      opponent: opponent.code,
    })),
  ).toEqual([
    { fixtureCode: 10, atHome: true, opponent: CHELSEA.code },
    { fixtureCode: 20, atHome: false, opponent: SPURS.code },
  ]);
});

test("the preview's Arsenal plays half its season at home and half away", () => {
  const { fixtures } = previewPremierLeague.useClub(
    proLeague.leagueId,
    previewClub("ARS").code,
  )!;
  expect(fixtures.filter(({ atHome }) => atHome)).toHaveLength(
    fixtures.length / 2,
  );
});
