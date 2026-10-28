import { expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import { recordPassedDeadlines } from "../../../convex/gameweeks/deadlineRecorder";
import { MINUTE_MS } from "../../../convex/shared/time";
import { begunGameweeks } from "../../../convex/table/gameweekScores";
import { ANN, DEADLINE, GAMEWEEK, HULL_SCORER, HULL_STARTERS, scoresLeague, type ScoresLeague } from "../../support/convex/gameweekScores.harness";
import { actingAs, COMMISSIONER } from "../../support/convex/leagues.harness";
import { clockRunsTo } from "../../support/convex/test.harness";

// A gameweek counts as begun at its deadline, not hours later at the next football sync: the
// sync's recording, run before the deadline, sets an alarm for it (deadlineRecorder.ts). Hull v
// Everton's gameweek 6, its deadline passing with no sync since.

/** The league as the football sync last left it, before gameweek 6's deadline: nothing recorded
 *  as begun yet, and the sync's recording run. */
async function syncedBeforeTheDeadline(): Promise<ScoresLeague> {
  const league = await scoresLeague();
  await league.t.run(async (ctx) => {
    for (const row of await ctx.db.query("passedDeadlines").collect()) await ctx.db.delete("passedDeadlines", row._id);
    for (const row of await ctx.db.query("playedFixtures").collect()) await ctx.db.delete("playedFixtures", row._id);
  });
  await league.t.run((ctx) => recordPassedDeadlines(ctx));
  return league;
}

const begun = ({ t, leagueId }: ScoresLeague) => t.run(async (ctx) => begunGameweeks(ctx, (await ctx.db.get("leagues", leagueId))!));
const annsMatchup = async ({ t, leagueId }: ScoresLeague) =>
  (await actingAs(t, ANN)).query(api.matchup.matchup.ofTeam, { leagueId, now: Date.now(), gameweek: GAMEWEEK });

test("at the deadline, with no sync since, the gameweek has begun: the table counts it, the matchup shows it, and a later move leaves the lineup as it locked", async () => {
  const league = await syncedBeforeTheDeadline();
  expect(await begun(league)).not.toContain(GAMEWEEK);
  expect(await annsMatchup(league)).toMatchObject({ kind: "headToHead", game: { kind: "notBegun" } });

  await clockRunsTo(league.t, DEADLINE);
  expect(await begun(league)).toContain(GAMEWEEK);

  // A minute on, the commissioner releases Hull's scorer: he still starts in the locked lineup.
  vi.setSystemTime(DEADLINE + MINUTE_MS);
  await (await actingAs(league.t, COMMISSIONER)).mutation(api.squads.squads.release, { leagueId: league.leagueId, playerCode: HULL_SCORER });
  const read = await annsMatchup(league);
  if (read?.kind !== "headToHead" || read.game.kind !== "scored" || read.game.team.kind !== "team") throw new Error(`Ann's matchup isn't scored: ${JSON.stringify(read)}`);
  expect(read.game.team.lineup?.starters.map((slot) => slot.playerCode)).toEqual(HULL_STARTERS.map((starter) => starter.playerCode));
});
