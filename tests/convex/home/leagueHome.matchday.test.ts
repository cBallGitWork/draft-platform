import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import {
  ANN,
  annsScoredGame,
  GAMEWEEK,
  HULL_BENCH,
  HULL_KEEPER,
  HULL_SCORER,
  LEAGUE_FULL_TIME_READ,
  LEAGUE_KICKOFF,
  nameOf,
  scoresLeague,
  type ScoresLeague,
} from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords } from "../../support/convex/gameweekScoresMatch.harness";
import { MIDFIELD_GOAL } from "../../support/convex/gameweekScoresFixes.harness";
import { actingAs } from "../../support/convex/leagues.harness";
import { holdLines, notYetBegun, storedLine } from "../../support/convex/matchPage.harness";
import { HULL_EVERTON } from "../../support/convex/matchStats.harness";

// League home's matchday mode (#387; spec/12, League home): the head-to-heads scored once the
// gameweek has begun, and while a matchday is open, the Vidiprinter of the lines that move one of
// them. Ann fields Hull and Bob Everton, playing each other in gameweek 6's one match.

const homeAt = async ({ t, leagueId }: ScoresLeague, now: number) => (await actingAs(t, ANN)).query(api.home.leagueHome.ofLeague, { leagueId, now });

/** The scores league at full time, holding a goal by Hull's scorer, a booking for a Hull bench man
 *  who never came on, kick-off and full time. */
async function leagueWithLines() {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  const benchMan = HULL_BENCH.find((code) => code !== HULL_KEEPER)!;
  const goal = storedLine(3, `64' GOAL ${await nameOf(league, HULL_SCORER)}`, 64, "goal", [HULL_SCORER]);
  await holdLines(league, [
    storedLine(4, "FT HUL 1–2 EVE", 1, "end 14"),
    storedLine(2, "80' YELLOW Bench", 80, "yellow card", [benchMan]),
    goal,
    storedLine(1, "KO HUL v EVE", 0, "start"),
  ]);
  return { league, goal };
}

test("once the gameweek has begun, each head-to-head carries both sides' points, as the matchup has them", async () => {
  const { league } = await leagueWithLines();
  const { team, opponent } = await annsScoredGame(league, GAMEWEEK);
  const home = (await homeAt(league, LEAGUE_FULL_TIME_READ))!;
  expect(home.thisGameweek?.fixtures).toEqual([
    { teamId: league.annsTeam, team: "Team 1", opponent: "Team 2", points: { team: team.points, opponent: opponent.points } },
  ]);
});

test("while the matchday is open, the Vidiprinter holds only the lines that move a head-to-head", async () => {
  const { league, goal } = await leagueWithLines();
  const home = (await homeAt(league, LEAGUE_FULL_TIME_READ + HOUR_MS))!;
  // Not kick-off nor full time, which move no one, nor the booking of a man on the bench who never
  // came on, whose points don't count.
  expect(home.matchday).toEqual({
    gameweek: GAMEWEEK,
    commentary: { kind: "read", lines: [{ key: `${HULL_EVERTON}:3`, text: goal.text, points: `+${MIDFIELD_GOAL}` }], delayed: false },
  });
});

test("it opens 3 hours before the first kickoff and closes 2 after the final whistle, its lines leaving with it", async () => {
  const { league } = await leagueWithLines();
  expect((await homeAt(league, LEAGUE_KICKOFF - 3 * HOUR_MS - MINUTE_MS))!.matchday).toBeNull();
  expect((await homeAt(league, LEAGUE_KICKOFF - 3 * HOUR_MS))!.matchday).not.toBeNull();
  expect((await homeAt(league, LEAGUE_FULL_TIME_READ + 2 * HOUR_MS - 1))!.matchday).not.toBeNull();

  const after = (await homeAt(league, LEAGUE_FULL_TIME_READ + 2 * HOUR_MS))!;
  expect(after.matchday).toBeNull();
  // The scores stay, and every line stays on the matchup (spec/10).
  expect(after.thisGameweek?.fixtures[0].points).not.toBeNull();
  const { commentary } = await annsScoredGame(league, GAMEWEEK);
  expect(commentary.kind === "read" && commentary.lines).toHaveLength(4);
});

test("open before the deadline, the matchday's Vidiprinter is empty: no lineup is locked, so nothing moves a head-to-head", async () => {
  const { league } = await leagueWithLines();
  await notYetBegun(league);
  expect((await homeAt(league, LEAGUE_KICKOFF - 2 * HOUR_MS))!.matchday).toEqual({ gameweek: GAMEWEEK, commentary: { kind: "read", lines: [], delayed: false } });
});
