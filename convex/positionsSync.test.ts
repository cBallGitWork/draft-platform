import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { FPL_BOOTSTRAP_URL, PL_COMP_SEASON, PL_LAST_COMP_SEASON, plFixturesUrl, plFixtureUrl } from "./football";
import { heldPositions, modules, REFUSED_STATUS, syncPositionsWith, type TestConvex } from "./positionsSync.harness";
import { MATCHES_PER_RUN } from "./positionsSync";
import type { RawPlSquadPlayer } from "./premierLeague";
import { NEWCASTLE, PLAYER, recordedPositions, SHEET, UNPLAYED_MATCH } from "./recorded/positions.payloads";
import schema from "./schema";

afterEach(() => vi.unstubAllGlobals());

const REFUSED_MATCH = `PL fixture ${SHEET.cityCoventryRefused}, team 11's 4-2-3-1 does not draw the 11 men it lists as starting`;

function manIn(men: RawPlSquadPlayer[], code: number): RawPlSquadPlayer {
  return men.find((man) => man.altIds?.opta === `p${code}`)!;
}

function heldStarts(t: TestConvex, code: number) {
  return t.run(async (ctx) => {
    const row = await ctx.db.query("playerPositions").withIndex("by_code", (q) => q.eq("code", code)).unique();
    return row?.starts ?? [];
  });
}

test("a run files every played match's starts and this season's labels, and reports what it could not place", async () => {
  const t = convexTest(schema, modules);

  const { outcome, urls } = await syncPositionsWith(t, recordedPositions());

  expect(outcome).toEqual({
    ok: true,
    matchesRead: 5,
    matchesLeft: 0,
    matchesRefused: [REFUSED_MATCH],
    // 88 starts in Newcastle's four matches, 12 of them by men FPL no longer lists (Trippier,
    // Krafth): they are among the men the sheets and squads name whom FPL does not list.
    startsAdded: 76,
    unmatchedPlayers: 29,
    // Every man FPL lists that a squad or a sheet names, each new to the table.
    labelsReceived: 121,
    labelsChanged: 121,
    unknownFormations: [],
    unknownLabels: [],
  });
  expect(urls).not.toContain(plFixtureUrl(UNPLAYED_MATCH));
});

test("a substitute's appearance is never filed as a start", async () => {
  const t = convexTest(schema, modules);
  await syncPositionsWith(t, recordedPositions());

  // Lewis Hall started two of the four Newcastle matches and was on the bench for the other two.
  const starts = await heldStarts(t, PLAYER.hall);

  expect(starts).toHaveLength(2);
  expect(starts.every((start) => start.formation !== null && start.line === 1)).toBe(true);
});

test("each match's sheets are read once: a second run files nothing again, and reads only the refused match", async () => {
  const t = convexTest(schema, modules);
  await syncPositionsWith(t, recordedPositions());

  const { outcome, urls } = await syncPositionsWith(t, recordedPositions());

  expect(outcome).toMatchObject({ ok: true, matchesRead: 1, startsAdded: 0, matchesRefused: [REFUSED_MATCH] });
  expect(urls.filter((url) => /\/fixtures\/\d+$/.test(url))).toEqual([plFixtureUrl(SHEET.cityCoventryRefused)]);
  expect(await heldStarts(t, PLAYER.barnes)).toHaveLength(3);
});

test("a formation the table does not know is reported, and its starts give nothing", async () => {
  const t = convexTest(schema, modules);
  const payloads = recordedPositions();
  for (const sheet of payloads.sheets.filter((each) => each.id !== SHEET.cityCoventryRefused)) {
    for (const list of sheet.teamLists!) list!.formation!.label = "2-3-5";
  }

  const { outcome } = await syncPositionsWith(t, payloads);

  expect(outcome).toMatchObject({ ok: true, unknownFormations: ["2-3-5"] });
  const { positions, unknownFormations } = await t.query(internal.playerPositions.ofPlayer, { code: PLAYER.barnes });
  expect(unknownFormations).toEqual(["2-3-5"]);
  expect(positions.map((held) => held.source)).toEqual(["label"]);
});

test("a label the table does not know is reported, and gives no position", async () => {
  const t = convexTest(schema, modules);
  const payloads = recordedPositions();
  manIn(payloads.squads[NEWCASTLE.pl].players, PLAYER.steur).info = { positionInfo: "Libero" };

  const { outcome } = await syncPositionsWith(t, payloads);

  expect(outcome).toMatchObject({ ok: true, unknownLabels: ["Libero"] });
  expect(await heldPositions(t, PLAYER.steur)).toEqual({});
});

test("a squad's label wins over a sheet's, and a man no squad lists keeps his newest sheet's", async () => {
  const t = convexTest(schema, modules);
  const payloads = recordedPositions();
  // Every sheet calls Hall "Left Full Back" and Woltemade, whom no squad lists, "Second Striker".
  manIn(payloads.squads[NEWCASTLE.pl].players, PLAYER.hall).info = { positionInfo: "Left Wing Back" };
  const newest = payloads.sheets.find((sheet) => sheet.id === SHEET.newcastleLateNov)!;
  manIn(newest.teamLists!.flatMap((list) => list!.lineup), PLAYER.woltemade).info = { positionInfo: "Centre Striker" };

  await syncPositionsWith(t, payloads);

  expect(await heldPositions(t, PLAYER.hall)).toEqual({ WB: "label?" });
  expect(await heldPositions(t, PLAYER.woltemade)).toEqual({ ST: "label?" });
});

test("a match filed twice, as by two runs at once, is filed once", async () => {
  const t = convexTest(schema, modules);
  const start = { fixtureCode: 1, kickoff: 1, formation: "4-3-3", line: 1, place: 0 };
  const args = { fixtureCode: 1, starts: [{ playerCode: PLAYER.hall, start }] };

  expect(await t.mutation(internal.positionsSync.recordStarts, args)).toBe(1);
  expect(await t.mutation(internal.positionsSync.recordStarts, args)).toBe(0);
  expect(await t.query(internal.positionsSync.unreadMatches, { fixtureCodes: [1, 2] })).toEqual([2]);
});

test.each([
  ["FPL's players", FPL_BOOTSTRAP_URL],
  ["last season's fixture list", plFixturesUrl(undefined, PL_LAST_COMP_SEASON)],
  ["this season's fixture list", plFixturesUrl(undefined, PL_COMP_SEASON)],
])("a refused read of %s is recorded as the run's failure, and files nothing", async (_what, url) => {
  const t = convexTest(schema, modules);

  const { outcome } = await syncPositionsWith(t, recordedPositions(), url);

  expect(outcome).toEqual({ ok: false, error: `${url} answered ${REFUSED_STATUS}` });
  expect(await heldStarts(t, PLAYER.barnes)).toEqual([]);
});

test("a failed read mid-run fails the run, and leaves the matches read before it filed", async () => {
  const t = convexTest(schema, modules);

  const { outcome } = await syncPositionsWith(t, recordedPositions(), plFixtureUrl(SHEET.newcastleLateNov));

  expect(outcome).toEqual({ ok: false, error: `${plFixtureUrl(SHEET.newcastleLateNov)} answered ${REFUSED_STATUS}` });
  expect(await heldStarts(t, PLAYER.barnes)).toHaveLength(2);
});

test(`one run reads at most ${MATCHES_PER_RUN} matches' sheets, oldest first, and says how many are left`, async () => {
  const t = convexTest(schema, modules);
  const payloads = recordedPositions();
  const [template] = payloads.sheets;
  // Copies of one match, each its own fixture, the first the newest.
  const firstCopy = 900_000;
  const copies = Array.from({ length: MATCHES_PER_RUN + 2 }, (_, index) => ({
    ...structuredClone(template),
    id: firstCopy + index,
    altIds: { opta: `g${firstCopy + index}` },
    kickoff: { millis: template.kickoff!.millis - index },
  }));
  payloads.sheets = copies;
  payloads.fixtureLists = { [PL_LAST_COMP_SEASON]: copies, [PL_COMP_SEASON]: [] };

  const { outcome } = await syncPositionsWith(t, payloads);

  expect(outcome).toMatchObject({ ok: true, matchesRead: MATCHES_PER_RUN, matchesLeft: 2 });
  const filed = (await heldStarts(t, PLAYER.thiaw)).map((start) => start.fixtureCode);
  expect(filed).toContain(firstCopy + 2);
  expect(filed).not.toContain(firstCopy); // the newest two wait for the next run
  expect(filed).not.toContain(firstCopy + 1);
});
