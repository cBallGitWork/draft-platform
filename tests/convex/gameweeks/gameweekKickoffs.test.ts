import type { Infer } from "convex/values";
import { beforeEach, expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { leagueDeadlinesIn, scheduledMatches } from "../../../convex/gameweeks/leagueDeadlines";
import type { fixtureRecord } from "../../../convex/schema";
import { currentFixtures } from "../../../convex/shared/fixtures";
import { DAY_MS, HOUR_MS, WEEK_MS } from "../../../convex/shared/time";
import { adminCreatesLeague } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import type { TestConvex } from "../../support/convex/test.harness";

// #2009 (Part of #1995, the Convex quota): a deadline reads each gameweek's first and last kickoff
// from a row a gameweek, never the season's 380 matches, and those rows follow every match the
// football sync adds, re-times or drops, so every league's deadlines stay where the matches put them.

type Fixture = Infer<typeof fixtureRecord>;

const FIRST = Date.parse("2026-11-21T12:30:00Z");
const GAMEWEEKS = [12, 13, 14];
/** Ten matches a gameweek, an hour apart from its first: `gameweek * 100 + 0` to `+ 9`. */
const SENT: Fixture[] = GAMEWEEKS.flatMap((gameweek) =>
  Array.from({ length: 10 }, (_, index) => ({
    code: gameweek * 100 + index,
    gameweek,
    homeClubCode: 1,
    awayClubCode: 2,
    kickoff: FIRST + (gameweek - 12) * WEEK_MS + index * HOUR_MS,
  })),
);

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment(FIRST - DAY_MS);
  fakeResend();
});

const send = (rows: Fixture[]) => t.mutation(internal.football.footballSync.upsertFixtures, { rows });
const kickoffRows = () =>
  t.run(async (ctx) =>
    (await ctx.db.query("gameweekKickoffs").collect()).map(({ gameweek, firstKickoff, lastKickoff }) => ({ gameweek, firstKickoff, lastKickoff })),
  );
const startOf = (gameweek: number) => FIRST + (gameweek - 12) * WEEK_MS;

test("a deadline reads two kickoffs a gameweek, not every match, and every league's deadlines are the matches' own", async () => {
  await send(SENT);
  const leagueId = await adminCreatesLeague(t);

  const read = await t.run((ctx) => scheduledMatches(ctx));
  expect(read).toHaveLength(2 * GAMEWEEKS.length);
  expect(SENT).toHaveLength(10 * GAMEWEEKS.length);
  const [fromRows, fromMatches] = await t.run(async (ctx) => {
    const matches = (await currentFixtures(ctx)).map(({ gameweek, kickoff }) => ({ gameweek, kickoff }));
    return [[...(await leagueDeadlinesIn(ctx, leagueId, read))], [...(await leagueDeadlinesIn(ctx, leagueId, matches))]];
  });
  expect(fromRows).toEqual(fromMatches);
});

test("each gameweek's row holds its first and last kickoff", async () => {
  await send(SENT);

  expect(await kickoffRows()).toEqual(
    GAMEWEEKS.map((gameweek) => ({ gameweek, firstKickoff: startOf(gameweek), lastKickoff: startOf(gameweek) + 9 * HOUR_MS })),
  );
});

test("a first match re-timed later in its gameweek, or into the next one's window, moves the rows it leaves and joins", async () => {
  await send(SENT);

  await send([{ ...SENT[0], kickoff: startOf(12) + DAY_MS }, { ...SENT[10], kickoff: startOf(14) + 30 * 60_000 }]);

  expect(await kickoffRows()).toEqual([
    { gameweek: 12, firstKickoff: startOf(12) + HOUR_MS, lastKickoff: startOf(12) + DAY_MS },
    { gameweek: 13, firstKickoff: startOf(13) + HOUR_MS, lastKickoff: startOf(13) + 9 * HOUR_MS },
    { gameweek: 14, firstKickoff: startOf(14), lastKickoff: startOf(14) + 9 * HOUR_MS },
  ]);
  expect(await t.run(async (ctx) => (await currentFixtures(ctx)).find(({ code }) => code === SENT[10].code)?.gameweek)).toBe(14);
});

test("a gameweek whose matches are all dropped has no row, and its deadline goes with them", async () => {
  await send(SENT);

  await t.mutation(internal.football.footballSync.markDropped, {
    table: "fixtures",
    sentKeys: SENT.filter(({ gameweek }) => gameweek !== 13).map(({ code }) => code),
    droppedAt: FIRST,
    paginationOpts: { numItems: 100, cursor: null },
  });

  expect((await kickoffRows()).map(({ gameweek }) => gameweek)).toEqual([12, 14]);
});

test("with no rows held yet, as on a deployment before its first sync since, the matches are read", async () => {
  await t.run(async (ctx) => {
    for (const fixture of SENT.slice(0, 3)) await ctx.db.insert("fixtures", fixture);
  });

  expect(await t.run((ctx) => scheduledMatches(ctx))).toHaveLength(3);
  expect(await kickoffRows()).toEqual([]);
});
