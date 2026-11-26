import { expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { fullTimeRecords } from "../../support/convex/gameweekScoresMatch.harness";
import { annsScoredGame, GAMEWEEK, HULL_KEEPER, PHILLIPS, type ScoresLeague, scoresLeague, slotOf } from "../../support/convex/gameweekScores.harness";
import { setLines } from "../../support/convex/footballRows.harness";

// A classic league's gameweek (spec/22, The lineup): its auto-subs keep each line inside the
// league's line limits, every man read on the line he held at the league's deadline, as his
// positions are (#1540), so a line changed since never re-works them (`S22.6`).

/** The league's deadline recording keeps each team's lineup as it stood (deadlineStars.ts). */
const keepDeadline = ({ t, leagueId }: ScoresLeague) => t.mutation(internal.stars.deadlineStars.storeLeague, { leagueId, gameweek: GAMEWEEK });

/** Ann's bench keeper is moved to DEF by the admin, every other man keeping his position's line. */
const benchKeeperMovedToDefence = ({ t }: ScoresLeague) => t.run((ctx) => setLines(ctx, new Map([[HULL_KEEPER, "DEF"]])));

test("S22.11 the bench keeper comes on for the keeper who didn't play, on the line the deadline kept: moved to DEF since, he still counts as GK", async () => {
  const league = await scoresLeague({ classic: true });
  await league.t.run((ctx) => setLines(ctx));
  await keepDeadline(league);
  await benchKeeperMovedToDefence(league);
  await fullTimeRecords(league);

  const game = await annsScoredGame(league, GAMEWEEK);
  expect(slotOf(game.team, HULL_KEEPER)).toMatchObject({ autoSub: { kind: "on" } });
  expect(slotOf(game.team, PHILLIPS)).toMatchObject({ autoSub: { kind: "off" } });
});

test("S22.12 with nothing kept at the deadline he is read on his line now, DEF: no one on the bench keeps GK's one, so the keeper's slot stays empty", async () => {
  const league = await scoresLeague({ classic: true });
  await benchKeeperMovedToDefence(league);
  await fullTimeRecords(league);

  const game = await annsScoredGame(league, GAMEWEEK);
  expect(slotOf(game.team, HULL_KEEPER).autoSub?.kind).not.toBe("on");
  expect(slotOf(game.team, PHILLIPS).autoSub?.kind).not.toBe("off");
});
