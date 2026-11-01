import { beforeEach, expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Lineup } from "../../../convex/lineup/lineup";
import { leagueDeadlines } from "../../../convex/gameweeks/leagueDeadlines";
import { SEASON_GAMEWEEKS } from "../../../convex/gameweeks/usedGameweeks";
import { BATCH_SIZE } from "../../../convex/shared/syncRuns";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { actingAs, addManagers, adminCreatesLeague, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { FOUR_FOUR_TWO, holdSquad } from "../../support/convex/lineupSquad.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// A gameweek FPL stops sending keeps its last deadline (spec/05, The deadline; Craig, 1 Nov 2026:
// "Keeps its last deadline"; #202). FPL drops gameweek 9, the next to begin, then moves its only
// match out to no gameweek and no kickoff: the league's gameweek 9 keeps the deadline it had, and
// a lineup saved now still goes to it.

const [ANN] = MANAGERS;
/** holdGameweeks' next gameweek: every one before it has begun. */
const DROPPED = 9;

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: DROPPED });
  leagueId = await adminCreatesLeague(t);
});

const deadlineOf = (gameweek: number) => t.run(async (ctx) => (await leagueDeadlines(ctx, leagueId)).get(gameweek));

/** The football sync's marking step for gameweeks, with every gameweek but `gameweek` sent; then
 *  that gameweek's match (coded with its number by holdGameweeks) moved out, as FPL's next sync of
 *  fixtures would. */
async function fplStopsSending(gameweek: number): Promise<void> {
  await t.mutation(internal.football.footballSync.markDropped, {
    table: "gameweeks",
    sentKeys: SEASON_GAMEWEEKS.filter((each) => each !== gameweek),
    droppedAt: Date.now(),
    paginationOpts: { cursor: null, numItems: BATCH_SIZE },
  });
  await t.run(async (ctx) => {
    const match = await ctx.db
      .query("fixtures")
      .withIndex("by_code", (q) => q.eq("code", gameweek))
      .unique();
    await ctx.db.patch("fixtures", match!._id, { gameweek: null, kickoff: null });
  });
}

test("a gameweek FPL stops sending keeps the deadline it had, after its matches leave it", async () => {
  const before = await deadlineOf(DROPPED);
  expect(before).toEqual(expect.any(Number));

  await fplStopsSending(DROPPED);

  expect(await deadlineOf(DROPPED)).toBe(before);
});

test("a lineup saved now still goes to the gameweek FPL stopped sending", async () => {
  const [annsTeam] = await addManagers(t, leagueId, [ANN]);
  await holdSquad(t, leagueId, annsTeam);
  await fplStopsSending(DROPPED);
  const ann = await actingAs(t, ANN);
  const sent = (lineup: Lineup) => ({ starters: [...lineup.starters], bench: [...lineup.bench] });

  expect(await ann.mutation(api.lineup.lineups.save, { leagueId, lineup: sent(FOUR_FOUR_TWO) })).toBe(DROPPED);
});

test("a gameweek dropped twice keeps one deadline, the first", async () => {
  const before = await deadlineOf(DROPPED);
  await fplStopsSending(DROPPED);
  await fplStopsSending(DROPPED);

  const kept = await t.run((ctx) => ctx.db.query("keptDeadlines").collect());
  expect(kept.map(({ gameweek, deadline }) => ({ gameweek, deadline }))).toEqual([{ gameweek: DROPPED, deadline: before }]);
});
