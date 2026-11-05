import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { PAST_ROWS_ADDED_MOST } from "../../convex/pastSeasons/pastSeasonLimits.ts";
import { PYTHON, READ_LOG, SEASONS, loadPastSeason } from "../../scripts/past-season.mjs";
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

/** A faked exec: Python prints the sample's log; `convex run` answers as the deployment would,
 *  `clearing` old rows over pages of `page`. Every call is kept. */
async function fakeTools({ clearing = 0, page = 1000 } = {}) {
  const log = await readFile(join(FROM, "playerMatchLog.sample.json"), "utf8");
  const calls = [];
  let left = clearing;
  const exec = async (command, args) => {
    calls.push({ command, args });
    if (command === join(FROM, PYTHON)) return { code: 0, stdout: log, stderr: "" };
    if (command !== CONVEX) return { code: 1, stdout: "", stderr: `no ${command}` };
    const fn = args[1].split(":")[1];
    const body = JSON.parse(args[2]);
    if (fn === "clearSeason") {
      const deleted = Math.min(left, page);
      left -= deleted;
      return { code: 0, stdout: JSON.stringify({ deleted, more: left > 0 }), stderr: "" };
    }
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
  expect(python.args[4].split(",")).toContain("kickoff_time");
});

test("the season's old rows are cleared page by page, then its rows added, on dev", async () => {
  const { exec, calls } = await fakeTools({ clearing: 2500 });
  expect(await run(exec)).toEqual({ counts: SAMPLE[2025].counts, cleared: 2500, added: 9 });
  const convexCalls = calls.filter((call) => call.command === CONVEX).map((call) => call.args);
  expect(convexCalls.map((args) => args[1])).toEqual([
    "pastSeasons/pastSeasonLoad:clearSeason",
    "pastSeasons/pastSeasonLoad:clearSeason",
    "pastSeasons/pastSeasonLoad:clearSeason",
    "pastSeasons/pastSeasonLoad:addRows",
  ]);
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
  const sizes = calls.filter((call) => call.args[1]?.endsWith(":addRows")).map((call) => JSON.parse(call.args[2]).rows.length);
  expect(sizes.every((size) => size <= PAST_ROWS_ADDED_MOST)).toBe(true);
  expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(9);
});

test("a log whose sizes aren't the planned ones stops the run before anything is written", async () => {
  const { exec, calls } = await fakeTools();
  const wrong = { 2025: { ...SAMPLE[2025], counts: { ...SAMPLE[2025].counts, playedRows: 9 } } };
  await expect(run(exec, { seasons: wrong })).rejects.toThrow("2025's log isn't the season it was planned on (playedRows 8, planned 9): nothing was loaded");
  expect(calls.some((call) => call.command === CONVEX)).toBe(false);
});

test("a season the copy doesn't know is refused", async () => {
  const { exec } = await fakeTools();
  await expect(run(exec, { season: 2019 })).rejects.toThrow("No past season 2019: the copy knows 2025");
});

test("a failed write stops the run with what the CLI said", async () => {
  const exec = async (command) =>
    command === CONVEX ? { code: 1, stdout: "", stderr: "not signed in" } : { code: 0, stdout: await readFile(join(FROM, "playerMatchLog.sample.json"), "utf8"), stderr: "" };
  await expect(run(exec)).rejects.toThrow("failed (exit 1): not signed in");
});
