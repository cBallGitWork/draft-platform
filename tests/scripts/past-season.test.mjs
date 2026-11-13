import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { PAST_ROWS_ADDED_MOST } from "../../convex/pastSeasons/pastSeasonLimits.ts";
import { ADD_ROWS, CLEAR_SEASON, PYTHON, READ_LOG, REPRICE, SEASONS, loadPastSeason, parseJson } from "../../scripts/past-season.mjs";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";

// The copy run on the sample in tests/support/scripts/aiCarling/ (laid out as ai-carling is), with
// ai-carling's Python and the Convex CLI faked: Python prints the sample's log as READ_LOG would.

const FROM = join(REPO_ROOT, "tests/support/scripts/aiCarling");
const SAMPLE = {
  2025: {
    log: "season=25-26/player_match_log.parquet",
    players: "data/raw/fpl/wayback_bootstrap/bootstrap_sample.json",
    counts: { matches: 2, playedRows: 8, played: 4, named: 5 },
  },
};
const CONVEX = join(REPO_ROOT, "node_modules", ".bin", "convex");
/** The sample's log, as READ_LOG prints it. */
const SAMPLE_LOG = await readFile(join(FROM, "playerMatchLog.sample.json"), "utf8");
/** The rows the load adds from the sample's log. */
const SAMPLE_ROWS_ADDED = 9;

/** A faked exec: Python prints the sample's log; `convex run` answers as the deployment would,
 *  `clearing` old rows over pages of `page`. Every call is kept. */
async function fakeTools({ clearing = 0, page = 1000 } = {}) {
  const calls = [];
  let left = clearing;
  const exec = async (command, args) => {
    calls.push({ command, args });
    if (command === join(FROM, PYTHON)) return { code: 0, stdout: SAMPLE_LOG, stderr: "" };
    if (command !== CONVEX) return { code: 1, stdout: "", stderr: `no ${command}` };
    const body = JSON.parse(args[2]);
    if (args[1] === CLEAR_SEASON) {
      const deleted = Math.min(left, page);
      left -= deleted;
      return { code: 0, stdout: JSON.stringify({ deleted, more: left > 0 }), stderr: "" };
    }
    if (args[1] === REPRICE) return { code: 0, stdout: "null", stderr: "" };
    return { code: 0, stdout: String(body.rows.length), stderr: "" };
  };
  return { exec, calls };
}

const run = (exec, options = {}) => loadPastSeason({ season: 2025, from: FROM, cwd: REPO_ROOT, seasons: SAMPLE, exec, print: () => {}, ...options });

test("2025/26 is planned on the sizes counted in the research", () => {
  expect(SEASONS[2025].counts).toEqual({ matches: 380, playedRows: 11492, played: 537, named: 707 });
});

test("the log is read by ai-carling's own Python, the columns the copy keeps and nothing else", async () => {
  const { exec, calls } = await fakeTools();
  await run(exec);
  const [python] = calls;
  expect(python.command).toBe(join(FROM, PYTHON));
  expect(python.args.slice(0, 3)).toEqual(["-I", "-c", READ_LOG]);
  expect(python.args[3]).toBe(join(FROM, SAMPLE[2025].log));
  expect(python.args[4].split(",")).toContain("kickoff_utc");
});

test("the season's old rows are cleared page by page, then its rows added and last season re-priced, on dev", async () => {
  const { exec, calls } = await fakeTools({ clearing: 2500 });
  expect(await run(exec)).toEqual({ counts: SAMPLE[2025].counts, cleared: 2500, added: SAMPLE_ROWS_ADDED, noCode: [] });
  const convexCalls = calls.filter((call) => call.command === CONVEX).map((call) => call.args);
  expect(convexCalls.map((args) => args[1])).toEqual([CLEAR_SEASON, CLEAR_SEASON, CLEAR_SEASON, ADD_ROWS, REPRICE]);
  expect(JSON.parse(convexCalls.at(-1)[2])).toEqual({ cursor: null });
  expect(convexCalls.every((args) => !args.includes("--prod"))).toBe(true);
});

test("with --prod every write goes to the live deployment", async () => {
  const { exec, calls } = await fakeTools();
  await run(exec, { prod: true });
  expect(calls.filter((call) => call.command === CONVEX).every((call) => call.args.at(-1) === "--prod")).toBe(true);
});

test("rows go in batches no bigger than one call adds", async () => {
  const { exec, calls } = await fakeTools();
  await run(exec);
  const sizes = calls.filter((call) => call.args[1] === ADD_ROWS).map((call) => JSON.parse(call.args[2]).rows.length);
  expect(sizes.every((size) => size <= PAST_ROWS_ADDED_MOST)).toBe(true);
  expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(SAMPLE_ROWS_ADDED);
});

test("a log whose sizes aren't the planned ones stops the run before anything is written", async () => {
  const { exec, calls } = await fakeTools();
  const wrong = { 2025: { ...SAMPLE[2025], counts: { ...SAMPLE[2025].counts, playedRows: 9 } } };
  await expect(run(exec, { seasons: wrong })).rejects.toThrow("2025's log isn't the season it was planned on (playedRows 8, planned 9): nothing was loaded");
  expect(calls.some((call) => call.command === CONVEX)).toBe(false);
});

test("the copy knows spec/14's five seasons, each from its own log, an older one checked on the matches FPL gives minutes for", () => {
  expect(Object.keys(SEASONS)).toEqual(["2021", "2022", "2023", "2024", "2025"]);
  expect(SEASONS[2021].log).toBe("data/match_logs/player_match_log/season=21-22/player_match_log.parquet");
  expect(SEASONS[2024].log).toBe("data/match_logs/player_match_log/season=24-25/player_match_log.parquet");
  expect(SEASONS[2025].log).toBe("data/match_logs/player_match_log/season=25-26/player_match_log.parquet");
  expect([2021, 2022, 2023, 2024].map((season) => SEASONS[season].counts)).toEqual([{ matches: 345 }, { matches: 353 }, { matches: 367 }, { matches: 375 }]);
});

test("an older season loads from the FPL list named with --players, checked only on its matches", async () => {
  const { exec, calls } = await fakeTools();
  const older = { 2021: { log: SAMPLE[2025].log, players: null, counts: { matches: 2 } } };
  await expect(run(exec, { season: 2021, seasons: older })).rejects.toThrow("2021 needs its FPL player list: name it with --players");
  expect(calls).toEqual([]);
  const result = await run(exec, { season: 2021, seasons: older, players: SAMPLE[2025].players });
  expect(result.added).toBe(SAMPLE_ROWS_ADDED);
  const added = calls.filter((call) => call.args[1] === ADD_ROWS).flatMap((call) => JSON.parse(call.args[2]).rows);
  expect(added.every((row) => row.season === 2021)).toBe(true);
});

test("a player with no FPL code keeps his played rows under his person id and is named (S14.24)", async () => {
  const sample = JSON.parse(SAMPLE_LOG);
  const unmatched = sample.filter((row) => row.person_root_id === "keeper-one").map((row) => ({ ...row, person_root_id: "no-fpl-seven" }));
  const { exec } = await fakeTools();
  const withUnmatched = async (command, args) => (command === join(FROM, PYTHON) ? { code: 0, stdout: JSON.stringify([...sample, ...unmatched]), stderr: "" } : exec(command, args));
  const printed = [];
  const counts = { 2025: { ...SAMPLE[2025], counts: { matches: 2 } } };
  const result = await run(withUnmatched, { seasons: counts, print: (line) => printed.push(line) });
  const unmatchedPlayed = unmatched.filter((row) => row.competition === "premier_league" && row.fpl_minutes > 0).length;
  expect(unmatchedPlayed).toBeGreaterThan(0);
  expect(result.added).toBe(SAMPLE_ROWS_ADDED + unmatchedPlayed);
  expect(result.noCode.map(({ root }) => root)).toEqual(["no-fpl-seven"]);
  expect(printed[0]).toBe(`2025: 1 with no FPL code kept under their person id, ${unmatchedPlayed} played matches in all: no-fpl-seven (${unmatchedPlayed} played)`);
});

test("a season the copy doesn't know is refused", async () => {
  const { exec } = await fakeTools();
  await expect(run(exec, { season: 2019 })).rejects.toThrow("No past season 2019: the copy knows 2025");
});

test("a failed write stops the run with what the CLI said", async () => {
  const exec = async (command) =>
    command === CONVEX ? { code: 1, stdout: "", stderr: "not signed in" } : { code: 0, stdout: SAMPLE_LOG, stderr: "" };
  await expect(run(exec)).rejects.toThrow("failed (exit 1): not signed in");
});

test("an older season's FPL list, written by Python with a bare NaN for a missing number, reads it as null", () => {
  expect(parseJson('[{"code": 1, "element_type": 2, "corners_order": NaN, "name": "NaN"}]')).toEqual([
    { code: 1, element_type: 2, corners_order: null, name: "NaN" },
  ]);
});
