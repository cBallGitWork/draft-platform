import { expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import {
  FPL_BOOTSTRAP_URL,
  PL_COMP_SEASON,
  PL_LAST_COMP_SEASON,
  PL_SEASON_IDS_STALE,
  PL_SEASON_IDS_STALE_FROM,
  plFixturesUrl,
  plFixtureUrl,
} from "../../../convex/football/football";
import { REFUSED_MATCH, asAdmin, heldPositions, reported, syncPositionsWith } from "../../support/convex/positionsSync.harness";
import { MATCHES_PER_RUN, SYNC_FAILED_LOG } from "../../../convex/positions/positionsSync";
import type { RawPlSquadPlayer } from "../../../convex/football/premierLeague/premierLeague";
import { NEWCASTLE, PLAYER, recordedPositions, SHEET, UNPLAYED_MATCH } from "../../support/recorded/positions.payloads";
import { freshConvex, refusedError, silenceConsoleError, type TestConvex } from "../../support/convex/test.harness";

/** The line a run logs when its read of url is refused. */
function reportedFailure(url: string): string {
  return `${SYNC_FAILED_LOG}: ${refusedError(url)}`;
}

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
  const t = freshConvex();
  const logged = silenceConsoleError();

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
  expect(logged).toHaveBeenCalledWith(reported());
});

test("a substitute's appearance is never filed as a start", async () => {
  const t = freshConvex();
  const logged = silenceConsoleError();
  await syncPositionsWith(t, recordedPositions());
  expect(logged).toHaveBeenCalledWith(reported());

  // Lewis Hall started two of the four Newcastle matches and was on the bench for the other two.
  const starts = await heldStarts(t, PLAYER.hall);

  expect(starts).toHaveLength(2);
  expect(starts.every((start) => start.formation !== null && start.line === 1)).toBe(true);
});

test("each match's sheets are read once: a second run files nothing again, and reads only the refused match", async () => {
  const t = freshConvex();
  const logged = silenceConsoleError();
  await syncPositionsWith(t, recordedPositions());

  const { outcome, urls } = await syncPositionsWith(t, recordedPositions());

  expect(outcome).toMatchObject({ ok: true, matchesRead: 1, startsAdded: 0, matchesRefused: [REFUSED_MATCH] });
  expect(urls.filter((url) => /\/fixtures\/\d+$/.test(url))).toEqual([plFixtureUrl(SHEET.cityCoventryRefused)]);
  expect(await heldStarts(t, PLAYER.barnes)).toHaveLength(3);
  expect(logged.mock.calls).toEqual([[reported()], [reported()]]);
});

test("a formation the table does not know is reported, and its starts give nothing", async () => {
  const t = freshConvex();
  const logged = silenceConsoleError();
  const payloads = recordedPositions();
  for (const sheet of payloads.sheets.filter((each) => each.id !== SHEET.cityCoventryRefused)) {
    for (const list of sheet.teamLists!) list!.formation!.label = "2-3-5";
  }

  const { outcome } = await syncPositionsWith(t, payloads);

  expect(outcome).toMatchObject({ ok: true, unknownFormations: ["2-3-5"] });
  expect(logged).toHaveBeenCalledWith(reported({ unknownFormations: ["2-3-5"] }));
  const { positions, unknownFormations } = await (await asAdmin(t)).query(api.positions.playerPositions.ofPlayer, { code: PLAYER.barnes });
  expect(unknownFormations).toEqual(["2-3-5"]);
  expect(positions.map((held) => held.source)).toEqual(["label"]);
});

test("a label the table does not know is reported, and gives no position", async () => {
  const t = freshConvex();
  const logged = silenceConsoleError();
  const payloads = recordedPositions();
  manIn(payloads.squads[NEWCASTLE.pl].players, PLAYER.steur).info = { positionInfo: "Libero" };

  const { outcome } = await syncPositionsWith(t, payloads);

  expect(outcome).toMatchObject({ ok: true, unknownLabels: ["Libero"] });
  expect(logged).toHaveBeenCalledWith(reported({ unknownLabels: ["Libero"] }));
  expect(await heldPositions(t, PLAYER.steur)).toEqual({});
});

test("a squad's label wins over a sheet's, and a man no squad lists keeps his newest sheet's", async () => {
  const t = freshConvex();
  const logged = silenceConsoleError();
  const payloads = recordedPositions();
  // Every sheet calls Hall "Left Full Back" and Woltemade, whom no squad lists, "Second Striker".
  manIn(payloads.squads[NEWCASTLE.pl].players, PLAYER.hall).info = { positionInfo: "Left Wing Back" };
  const newest = payloads.sheets.find((sheet) => sheet.id === SHEET.newcastleLateNov)!;
  manIn(newest.teamLists!.flatMap((list) => list!.lineup), PLAYER.woltemade).info = { positionInfo: "Centre Striker" };

  await syncPositionsWith(t, payloads);

  expect(await heldPositions(t, PLAYER.hall)).toEqual({ WB: "label?" });
  expect(await heldPositions(t, PLAYER.woltemade)).toEqual({ ST: "label?" });
  expect(logged).toHaveBeenCalledWith(reported());
});

test("a match filed twice, as by two runs at once, is filed once", async () => {
  const t = freshConvex();
  const start = { fixtureCode: 1, kickoff: 1, formation: "4-3-3", line: 1, place: 0 };
  const args = { fixtureCode: 1, starts: [{ playerCode: PLAYER.hall, start }] };

  expect(await t.mutation(internal.positions.positionsSync.recordStarts, args)).toBe(1);
  expect(await t.mutation(internal.positions.positionsSync.recordStarts, args)).toBe(0);
  expect(await t.query(internal.positions.positionsSync.unreadMatches, { fixtureCodes: [1, 2] })).toEqual([2]);
});

test("a man's row keeps his newest 38 starts, the oldest dropped", async () => {
  const t = freshConvex();
  const matches = 40;
  // Filed oldest first, as a run files them.
  for (let match = 1; match <= matches; match += 1) {
    const start = { fixtureCode: match, kickoff: match, formation: "4-3-3", line: 1, place: 0 };
    await t.mutation(internal.positions.positionsSync.recordStarts, { fixtureCode: match, starts: [{ playerCode: PLAYER.hall, start }] });
  }

  const kept = (await heldStarts(t, PLAYER.hall)).map((start) => start.fixtureCode);

  expect(kept).toEqual(Array.from({ length: 38 }, (_, index) => matches - index)); // newest first; 1 and 2 dropped
});

test.each([
  ["FPL's players", FPL_BOOTSTRAP_URL],
  ["last season's fixture list", plFixturesUrl(undefined, PL_LAST_COMP_SEASON)],
  ["this season's fixture list", plFixturesUrl(undefined, PL_COMP_SEASON)],
])("a refused read of %s is recorded as the run's failure, and files nothing", async (_what, url) => {
  const t = freshConvex();
  const logged = silenceConsoleError();

  const { outcome } = await syncPositionsWith(t, recordedPositions(), url);

  expect(outcome).toEqual({ ok: false, error: refusedError(url) });
  expect(logged).toHaveBeenCalledWith(reportedFailure(url));
  expect(await heldStarts(t, PLAYER.barnes)).toEqual([]);
});

test("a run once the season ids are out of date fails, saying so, and files nothing (#201)", async () => {
  const t = freshConvex();
  const logged = silenceConsoleError();

  const { outcome } = await syncPositionsWith(t, recordedPositions(), undefined, PL_SEASON_IDS_STALE_FROM);

  expect(outcome).toEqual({ ok: false, error: PL_SEASON_IDS_STALE });
  expect(logged).toHaveBeenCalledWith(`${SYNC_FAILED_LOG}: ${PL_SEASON_IDS_STALE}`);
  expect(await heldStarts(t, PLAYER.barnes)).toEqual([]);
});

test("a failed read mid-run fails the run, and leaves the matches read before it filed", async () => {
  const t = freshConvex();
  const logged = silenceConsoleError();

  const refused = plFixtureUrl(SHEET.newcastleLateNov);
  const { outcome } = await syncPositionsWith(t, recordedPositions(), refused);

  expect(outcome).toEqual({ ok: false, error: refusedError(refused) });
  expect(logged).toHaveBeenCalledWith(reportedFailure(refused));
  expect(await heldStarts(t, PLAYER.barnes)).toHaveLength(2);
});

test(`one run reads at most ${MATCHES_PER_RUN} matches' sheets, oldest first, and says how many are left`, async () => {
  const t = freshConvex();
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
  // FPL listing Thiaw alone, so each copy files his one start, not a whole match's: filing every
  // starter of 152 matches took over the default five seconds on a loaded machine.
  payloads.fplElements = payloads.fplElements.filter((element) => element.code === PLAYER.thiaw);

  const { outcome } = await syncPositionsWith(t, payloads);

  expect(outcome).toMatchObject({ ok: true, matchesRead: MATCHES_PER_RUN, matchesLeft: 2 });
  const filed = (await heldStarts(t, PLAYER.thiaw)).map((start) => start.fixtureCode);
  expect(filed).toContain(firstCopy + 2);
  expect(filed).not.toContain(firstCopy); // the newest two wait for the next run
  expect(filed).not.toContain(firstCopy + 1);
}, 30_000);
