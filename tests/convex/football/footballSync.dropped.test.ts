import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { FPL_BOOTSTRAP_URL, FPL_FIXTURES_URL } from "../../../convex/football/football";
import {
  crowdedFpl,
  held,
  heldCounts,
  nameAnUnlistedClub,
  NOTHING_CHANGED,
  syncRun,
  syncWith,
} from "../../support/convex/footballSync.harness";
import { CLUB_CODE, RECORDED_COUNT, recordedFpl } from "../../support/recorded/fpl.payloads";
import { freshConvex, refusedError, silenceConsoleError, type TestConvex } from "../../support/convex/test.harness";
import { BATCH_SIZE } from "../../../convex/shared/syncRuns";

// #64: a club, player, fixture or gameweek FPL stops sending is kept and marked, never deleted.

const FIRST_SYNC = Date.parse("2026-10-19T06:00:00Z");
const SECOND_SYNC = Date.parse("2026-10-19T12:00:00Z");
const THIRD_SYNC = Date.parse("2026-10-19T18:00:00Z");
const ONE_MARKED = { ...NOTHING_CHANGED, marked: 1 };
const ONE_UNMARKED = { ...NOTHING_CHANGED, unmarked: 1 };
const NO_ROW_MARKED = { clubs: [], players: [], fixtures: [], gameweeks: [] };
const FOOTBALL_TABLES = ["clubs", "players", "fixtures", "gameweeks"] as const;
/** The first key of the rows a test holds that the recording never sends. */
const UNSENT_KEY_FROM = 900_000;

/** The recording less one of each: Jesus (gone abroad), a club no kept player or match names,
 *  the last match and the last gameweek. Returns the payloads and each dropped row's key. */
function withOneOfEachDropped() {
  const payloads = recordedFpl();
  const { teams, elements, events } = payloads.bootstrap;
  const named = new Set([
    ...elements.map((player) => player.team),
    ...payloads.fixtures.flatMap((fixture) => [fixture.team_h, fixture.team_a]),
  ]);
  const [club] = teams.splice(teams.findIndex((team) => !named.has(team.id)), 1);
  const [player] = elements.splice(elements.findIndex((element) => element.web_name === "G.Jesus"), 1);
  const fixture = payloads.fixtures.pop()!;
  const gameweek = events.pop()!;
  return { payloads, dropped: { club: club.code, player: player.code, fixture: fixture.code, gameweek: gameweek.id } };
}

/** Each held row's key with its mark, only for the rows that are marked. */
async function marks(t: TestConvex) {
  const rows = await held(t);
  const marked = <Row extends { droppedAt?: number }>(table: Row[], keyOf: (row: Row) => number) =>
    table.filter((row) => "droppedAt" in row).map((row) => [keyOf(row), row.droppedAt]);
  return {
    clubs: marked(rows.clubs, (club) => club.code),
    players: marked(rows.players, (player) => player.code),
    fixtures: marked(rows.fixtures, (fixture) => fixture.code),
    gameweeks: marked(rows.gameweeks, (gameweek) => gameweek.number),
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FIRST_SYNC);
});

test("a row missing from a re-sync is kept, marked with the sync's time, and counted on its run row", async () => {
  const t = freshConvex();
  await syncWith(t, recordedFpl());
  const { payloads, dropped } = withOneOfEachDropped();

  vi.setSystemTime(SECOND_SYNC);
  const run = await syncRun(t, payloads);

  expect(run.ranAt).toBe(SECOND_SYNC);
  expect(run.outcome).toMatchObject({
    ok: true,
    clubs: ONE_MARKED,
    players: ONE_MARKED,
    fixtures: ONE_MARKED,
    gameweeks: ONE_MARKED,
  });
  expect(await marks(t)).toEqual({
    clubs: [[dropped.club, SECOND_SYNC]],
    players: [[dropped.player, SECOND_SYNC]],
    fixtures: [[dropped.fixture, SECOND_SYNC]],
    gameweeks: [[dropped.gameweek, SECOND_SYNC]],
  });
  expect(await heldCounts(t)).toEqual(RECORDED_COUNT);
});

test("a marked row sent again is unmarked, updated if it changed, and counted on its run row", async () => {
  const t = freshConvex();
  await syncWith(t, recordedFpl());
  const { payloads, dropped } = withOneOfEachDropped();
  vi.setSystemTime(SECOND_SYNC);
  await syncWith(t, payloads);

  // Jesus comes back under a new display name.
  const sentAgain = recordedFpl();
  sentAgain.bootstrap.elements.find((element) => element.code === dropped.player)!.web_name = "Jesus";
  vi.setSystemTime(THIRD_SYNC);
  const outcome = await syncWith(t, sentAgain);

  expect(outcome).toMatchObject({
    ok: true,
    clubs: ONE_UNMARKED,
    players: { ...ONE_UNMARKED, updated: 1 },
    fixtures: ONE_UNMARKED,
    gameweeks: ONE_UNMARKED,
  });
  expect(await marks(t)).toEqual(NO_ROW_MARKED);
  const rows = await held(t);
  expect(rows.players.find((player) => player.code === dropped.player)?.name).toBe("Jesus");
});

test("a re-run while a row is still missing changes nothing, and its mark keeps the first time", async () => {
  const t = freshConvex();
  await syncWith(t, recordedFpl());
  vi.setSystemTime(SECOND_SYNC);
  await syncWith(t, withOneOfEachDropped().payloads);
  const before = await held(t);

  vi.setSystemTime(THIRD_SYNC);
  const outcome = await syncWith(t, withOneOfEachDropped().payloads);

  expect(outcome).toMatchObject({
    ok: true,
    clubs: NOTHING_CHANGED,
    players: NOTHING_CHANGED,
    fixtures: NOTHING_CHANGED,
    gameweeks: NOTHING_CHANGED,
  });
  expect(await held(t)).toEqual(before);
});

test.each([
  ["bootstrap-static", FPL_BOOTSTRAP_URL],
  ["fixtures", FPL_FIXTURES_URL],
])("a failed fetch of %s marks nothing", async (_feed, refused) => {
  silenceConsoleError();
  const t = freshConvex();
  await syncWith(t, recordedFpl());

  vi.setSystemTime(SECOND_SYNC);
  const outcome = await syncWith(t, withOneOfEachDropped().payloads, refused);

  expect(outcome).toEqual({ ok: false, error: refusedError(refused) });
  expect(await marks(t)).toEqual(NO_ROW_MARKED);
});

test("a payload refused as changed marks nothing", async () => {
  silenceConsoleError();
  const t = freshConvex();
  await syncWith(t, recordedFpl());
  const { payloads } = withOneOfEachDropped();
  const refusal = nameAnUnlistedClub(payloads);

  vi.setSystemTime(SECOND_SYNC);
  const outcome = await syncWith(t, payloads);

  expect(outcome).toEqual({ ok: false, error: refusal });
  expect(await marks(t)).toEqual(NO_ROW_MARKED);
});

test("a re-sync sending no players is refused, and marks nothing", async () => {
  silenceConsoleError();
  const t = freshConvex();
  await syncWith(t, recordedFpl());
  const noPlayers = recordedFpl();
  noPlayers.bootstrap.elements = [];

  vi.setSystemTime(SECOND_SYNC);
  const outcome = await syncWith(t, noPlayers);

  expect(outcome).toEqual({ ok: false, error: "FPL sent an empty player list" });
  expect(await marks(t)).toEqual(NO_ROW_MARKED);
});

test("held rows past the first page are checked too, and each missing one is marked once", async () => {
  const t = freshConvex();
  const { payloads: crowded, count } = crowdedFpl();
  await syncWith(t, crowded);

  const kept = 10;
  crowded.bootstrap.elements = crowded.bootstrap.elements.slice(0, kept);
  vi.setSystemTime(SECOND_SYNC);
  const outcome = await syncWith(t, crowded);

  expect(outcome).toMatchObject({ ok: true, players: { received: kept, marked: count - kept } });
  const markedCodes = (await marks(t)).players.map(([code]) => code);
  expect(markedCodes).toEqual(Array.from({ length: count - kept }, (_, index) => kept + index + 1));
});

test("past several pages of every table, only unsent rows not yet marked are marked, and old marks keep their time", async () => {
  const t = freshConvex();
  await syncWith(t, recordedFpl());
  // Rows the feed never sends, more than two pages of each table, every other one already marked
  // at the first sync, so marked and unmarked rows share each page.
  const unsent = BATCH_SIZE * 2 + 50;
  const expected = await t.run(async (ctx) => {
    const marksBy: Record<(typeof FOOTBALL_TABLES)[number], (number | undefined)[][]> = {
      clubs: [],
      players: [],
      fixtures: [],
      gameweeks: [],
    };
    for (const table of FOOTBALL_TABLES) {
      const { _id, _creationTime, ...template } = (await ctx.db.query(table).first())!;
      for (let index = 0; index < unsent; index++) {
        const key = UNSENT_KEY_FROM + index;
        const alreadyMarked = index % 2 === 0;
        const keyed = table === "gameweeks" ? { number: key } : { code: key };
        const mark = alreadyMarked ? { droppedAt: FIRST_SYNC } : {};
        // The template is the table's own row, so only its key and mark change.
        await ctx.db.insert(table, { ...template, ...keyed, ...mark } as never);
        marksBy[table].push([key, alreadyMarked ? FIRST_SYNC : SECOND_SYNC]);
      }
    }
    return marksBy;
  });

  vi.setSystemTime(SECOND_SYNC);
  const outcome = await syncWith(t, recordedFpl());

  const newlyMarked = { ...NOTHING_CHANGED, marked: unsent / 2 };
  expect(outcome).toMatchObject({
    ok: true,
    clubs: newlyMarked,
    players: newlyMarked,
    fixtures: newlyMarked,
    gameweeks: newlyMarked,
  });
  expect(await marks(t)).toEqual(expected);
});

test("rows written before #64, without its marks and counts, still fit the schema", async () => {
  const t = freshConvex();
  const writesBefore64 = { received: 1, inserted: 1, updated: 0 };

  await t.run(async (ctx) => {
    await ctx.db.insert("clubs", { code: CLUB_CODE.arsenal, name: "Arsenal", shortName: "ARS" });
    await ctx.db.insert("footballSyncs", {
      trigger: "cron",
      ranAt: FIRST_SYNC,
      outcome: {
        ok: true,
        clubs: writesBefore64,
        players: writesBefore64,
        fixtures: writesBefore64,
        gameweeks: writesBefore64,
      },
    });
  });

  expect((await heldCounts(t)).clubs).toBe(1);
  expect(await t.query(internal.football.footballSync.latest, {})).toHaveLength(1);
});
