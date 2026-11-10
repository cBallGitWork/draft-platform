// Copies a past season's Premier League matches from ai-carling-premiership into a deployment's
// pastPlayerMatchStats (#1113 for 2025/26, #842 for 2021/22 to 2024/25;
// convex/pastSeasons/pastSeasonRows.ts, and pastStatColumns.ts for each stat's column). Run on
// Craig's Mac, where ai-carling and its .venv live, from this checkout:
//
//   node scripts/past-season.mjs --season 2025 --from ~/path/to/ai-carling-premiership          (dev)
//   node scripts/past-season.mjs --season 2025 --from ~/path/to/ai-carling-premiership --prod   (live)
//   node scripts/past-season.mjs --season 2021 --from ~/path/to/ai-carling-premiership --players <that season's FPL list>
//
// The parquet is read by ai-carling's own Python (pyarrow) and printed as JSON, so this checkout
// adds no parquet reader. Before anything is written the season's sizes are checked against the
// counts it was planned on (docs/research/last-season-points.md for 2025/26; 380 matches for the
// older ones). A player with no FPL code is skipped, his rows left out and his name printed (Craig,
// 6 Nov 2026, on #842); every other row's player must have a position in the season's FPL list:
// a miss stops the run, naming him. The season's old rows are cleared
// first, so a second run replaces the first. Then last season's points are re-priced under the
// site's set as it stands (#1114; convex/pastSeasons/pastSeasonPoints.ts), a job that pages on by
// itself.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { PAST_ROWS_ADDED_MOST } from "../convex/pastSeasons/pastSeasonLimits.ts";
import { SOURCE_COLUMNS, fplCodesByRoot, fplPositionsByCode, pastSeasonRows, seasonCounts, withoutFplCode } from "../convex/pastSeasons/pastSeasonRows.ts";
import { captured } from "./live-setup/tools.mjs";

/** A season's log in ai-carling, by the year it starts (2021 → season=21-22). */
const logOf = (start) => {
  const short = (year) => String(year % 100).padStart(2, "0");
  return `data/match_logs/player_match_log/season=${short(start)}-${short(start + 1)}/player_match_log.parquet`;
};

/** An older season (#842, for the rule balance lab): its sizes weren't counted before, so only its
 *  matches are checked, and its FPL player list is named on the run with --players (ai-carling's
 *  list for that season, read on Craig's Mac). Of its 380 matches, `matches` are the ones the log
 *  gives FPL's minutes for: the rest, mostly rescheduled ones, have none, so no one played in them
 *  as the copy counts it (counted 9 Nov 2026, #10). */
const olderSeason = (start, matches) => ({ log: logOf(start), players: null, counts: { matches } });

/** Each season the copy knows, by the year it starts: its log, its FPL player list (null where the
 *  run names it), and the sizes it is checked against. spec/14: the five seasons 2021/22 to 2025/26. */
export const SEASONS = {
  2021: olderSeason(2021, 345),
  2022: olderSeason(2022, 353),
  2023: olderSeason(2023, 367),
  2024: olderSeason(2024, 375),
  2025: {
    log: logOf(2025),
    // 2025/26's FPL list on 1 Jun 2026, its last before the reset: each player's position that season, by code. It names all 707; 1 Mar's lacked 22 who joined later, and no one changes position across the season's lists.
    players: "data/raw/fpl/wayback_bootstrap/bootstrap_20260601000016.json",
    counts: { matches: 380, playedRows: 11492, played: 537, named: 707 },
  },
};

/** Where ai-carling keeps each person's ids, FPL's code among them. */
export const PERSONS_DIR = "data/identity/persons/root";
/** ai-carling's own Python, which has pyarrow. */
export const PYTHON = ".venv/bin/python";

/** Prints the log's columns named in argv[2] (comma-separated) from the parquet at argv[1] as one
 *  JSON array: a null or NaN as null, and a time in ISO 8601. */
export const READ_LOG = `
import json, math, sys
import pyarrow.parquet as pq
rows = pq.read_table(sys.argv[1], columns=sys.argv[2].split(",")).to_pylist()
def clean(value):
    if isinstance(value, float) and math.isnan(value):
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value
json.dump([{key: clean(value) for key, value in row.items()} for row in rows], sys.stdout)
`;

const LOAD = "pastSeasons/pastSeasonLoad";
/** The job that prices last season under today's set, started once the rows are in. */
export const REPRICE = "pastSeasons/pastSeasonPoints:reprice";

/** Runs a command, resolving with its stdout, or throwing with what it said when it fails. */
async function run(exec, command, args, cwd) {
  const { code, stdout, stderr } = await exec(command, args, { cwd });
  if (code !== 0) throw new Error(`\`${command} ${args[0]}\` failed (exit ${code}): ${(stderr || stdout).trim()}`);
  return stdout;
}

/** A bare NaN as a value, as Python's json writes a missing number: the older seasons' FPL lists
 *  (`data/raw/fpl_history/<season>/players_raw.json`) have them, and JSON has no NaN. */
const BARE_NAN = /(:\s*)NaN(?=\s*[,}\]])/g;

/** Parses JSON that may hold Python's bare NaN, read as null. */
export const parseJson = (text) => JSON.parse(text.replace(BARE_NAN, "$1null"));

async function readJson(path) {
  return parseJson(await readFile(path, "utf8"));
}

/** ai-carling's person files, each with its name. */
async function personFiles(from) {
  const dir = join(from, PERSONS_DIR);
  const names = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
  return Promise.all(names.map(async (name) => ({ name, json: await readJson(join(dir, name)) })));
}

/** Throws listing every size that isn't the one the season was planned on. */
function checkCounts(season, found, planned) {
  const wrong = Object.keys(planned).filter((key) => found[key] !== planned[key]);
  if (wrong.length > 0) {
    const list = wrong.map((key) => `${key} ${found[key]}, planned ${planned[key]}`).join("; ");
    throw new Error(`${season}'s log isn't the season it was planned on (${list}): nothing was loaded`);
  }
}

/** Splits rows into batches of at most `size`. */
const batches = (rows, size) => Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size));

/** Reads `season` from the ai-carling checkout at `from`, checks it, and loads it into the
 *  deployment the checkout at `cwd` points at (the live one with `prod`). `exec` and `print` are
 *  swapped in tests. */
export async function loadPastSeason({ season, from, players, prod = false, cwd = process.cwd(), seasons = SEASONS, exec = captured, print = console.log }) {
  const plan = seasons[season];
  if (plan === undefined) throw new Error(`No past season ${season}: the copy knows ${Object.keys(seasons).join(", ")}`);
  const list = players ?? plan.players;
  if (list === null) throw new Error(`${season} needs its FPL player list: name it with --players <its path in ai-carling>`);
  const log = JSON.parse(await run(exec, join(from, PYTHON), ["-I", "-c", READ_LOG, join(from, plan.log), SOURCE_COLUMNS.join(",")], cwd));
  const counts = seasonCounts(log);
  checkCounts(season, counts, plan.counts);
  const codes = fplCodesByRoot(await personFiles(from));
  const positions = fplPositionsByCode(await readJson(join(from, list)));
  const { kept, skipped } = withoutFplCode(log, codes);
  if (skipped.length > 0) {
    const names = skipped.map(({ root, played }) => `${root} (${played} played)`).join(", ");
    print(`${season}: skipped ${skipped.length} with no FPL code, ${skipped.reduce((sum, { played }) => sum + played, 0)} played matches in all: ${names}`);
  }
  const rows = pastSeasonRows(season, kept, codes, positions);

  const convex = join(cwd, "node_modules", ".bin", "convex");
  const target = prod ? ["--prod"] : [];
  const call = async (fn, args) => JSON.parse(await run(exec, convex, ["run", `${LOAD}:${fn}`, JSON.stringify(args), ...target], cwd));
  let cleared = 0;
  for (let more = true; more; ) {
    const page = await call("clearSeason", { season });
    cleared += page.deleted;
    more = page.more;
  }
  let added = 0;
  for (const batch of batches(rows, PAST_ROWS_ADDED_MOST)) added += await call("addRows", { rows: batch });
  await run(exec, convex, ["run", REPRICE, JSON.stringify({ cursor: null }), ...target], cwd);
  print(
    `${season}: ${counts.matches} matches, ${counts.playedRows} played rows, ${counts.played} who played and ${counts.named} named; ` +
      `${cleared} old rows cleared and ${added} added to ${prod ? "the live deployment" : "dev"}, last season's points re-priced`,
  );
  return { counts, cleared, added, skipped };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const { values } = parseArgs({
      options: { season: { type: "string" }, from: { type: "string" }, players: { type: "string" }, prod: { type: "boolean", default: false } },
    });
    if (values.season === undefined || values.from === undefined) {
      throw new Error("usage: node scripts/past-season.mjs --season 2025 --from <ai-carling-premiership> [--players <FPL list>] [--prod]");
    }
    await loadPastSeason({ season: Number(values.season), from: values.from, players: values.players, prod: values.prod });
  } catch (error) {
    console.error(`past-season: ${error.message}`);
    process.exit(1);
  }
}
