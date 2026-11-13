// A past season's Premier League matches, copied once from ai-carling-premiership's player match
// log (#1113, the first season of #842's table): a row for each match a player played, and one for
// each player the season's rows name who played none, so he is known to be in that season's data
// (Craig, 4 Nov 2026: a newcomer is "Not in last season's data"). Rows are keyed by FPL's
// season-stable `code`, the season and the kickoff, never the per-season `fpl_fixture_id`; a man
// with no FPL code by his person root id (spec/14 S14.24; Craig, 13 Nov 2026, on #1541).
// Pure, importing at runtime only pastStatColumns.ts (by its file name), so scripts/past-season.mjs
// reads it in plain Node.

import type { Area } from "../lineup/pitch";
import { PAST_STAT_COLUMNS, ZERO_LEFT_OUT_BY, type PastFeed } from "./pastStatColumns.ts";

/** The competition a row must name to be a Premier League match: the log holds cups and Europe too. */
const PREMIER_LEAGUE = "premier_league";

/** Each stat the copy keeps, by our name (matchRecords.ts, FPL's), from its column in the log
 *  (pastStatColumns.ts, which also names its feed). */
export const STAT_COLUMNS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(PAST_STAT_COLUMNS).map(([stat, { column }]) => [stat, column]),
);

/** When the match kicked off. The column's name is read from the log's own FPL columns, not yet
 *  checked against the file: a missing one stops the read, naming it. */
const KICKOFF_COLUMN = "kickoff_utc";
/** The competition the match was in (PREMIER_LEAGUE for ours). */
const COMPETITION_COLUMN = "competition";
/** The person's root id, which his FPL `code` is found by (`fplCodesByRoot`). */
const PERSON_COLUMN = "person_root_id";
/** FPL's per-season fixture id. */
const FIXTURE_COLUMN = "fpl_fixture_id";
/** Where he started the match, if he did. */
const STARTING_POSITION_COLUMN = "starting_position";
/** The club he played for in the match (spec/14 S14.9; Craig, 12 Nov 2026, on #1541: "Match by
 *  match", so a January signing's autumn counts for his old club). The column's name is not yet
 *  checked against the file: a missing one stops the read, naming it. */
const CLUB_COLUMN = "team";

/** Every column the copy reads. FPL's fixture id is read only to count the season's matches, and
 *  never kept; FPL's own points are read only by the re-score test; a feed's minutes only say
 *  whether it covered the match (ZERO_LEFT_OUT_BY). */
export const SOURCE_COLUMNS = [
  COMPETITION_COLUMN,
  PERSON_COLUMN,
  FIXTURE_COLUMN,
  KICKOFF_COLUMN,
  STARTING_POSITION_COLUMN,
  CLUB_COLUMN,
  ...Object.values(STAT_COLUMNS),
  ...Object.values(ZERO_LEFT_OUT_BY),
  "fpl_total_points",
  "fpl_bonus",
];

/** One row of the log as the read prints it: a column's null is a missing value. */
export type LogRow = Readonly<Record<string, unknown>>;

/** FPL's four positions, by its `element_type`. */
const FPL_POSITIONS = [1, 2, 3, 4] as const;
export type FplPosition = (typeof FPL_POSITIONS)[number];

/** FPL's `element_type` for a manager, 2024/25's assistant manager chip: in the list, never a player. */
const FPL_MANAGER = 5;

/** The area each FPL position is priced in: FPL prices by position and the site by area, and every
 *  midfield area takes FPL's midfielder values (firstScoring.ts). */
export const FPL_POSITION_AREA: Readonly<Record<FplPosition, Area>> = { 1: "goalkeeper", 2: "defence", 3: "midfield", 4: "attack" };

/** One match he played. `startingPosition` is the log's, null where it has none. */
export interface PastMatch {
  kickoff: number;
  /** The club he played for that day. */
  club: string;
  startingPosition: string | null;
  stats: Record<string, number>;
}

/** A stored row: one match he played, or, with `match` null, a player the season names who played
 *  none; or one match played by a man with no FPL code, under his person root id (S14.24). */
export type PastSeasonRow =
  | {
      season: number;
      playerCode: number;
      /** His FPL position that season (`element_type`). */
      fplPosition: FplPosition;
      match: PastMatch | null;
    }
  | { season: number; person: string; match: PastMatch };

/** The season's sizes, for the run to check against the counts it was planned on. */
export interface SeasonCounts {
  matches: number;
  playedRows: number;
  played: number;
  named: number;
}

/** A person file from ai-carling's `data/identity/persons/root/`: its name and its contents. */
export interface PersonFile {
  name: string;
  json: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Each person's FPL `code` by his person root id, the file's `root_id` (the log's `person_root_id`).
 *  A person with no FPL code is left out; a file with no `root_id`, or one id naming two codes, throws. */
export function fplCodesByRoot(files: readonly PersonFile[]): Map<string, number> {
  const codes = new Map<string, number>();
  for (const { name, json } of files) {
    if (!isRecord(json)) throw new Error(`Person file ${name} is not a JSON object`);
    const mappings = json.source_mappings;
    const raw = isRecord(mappings) ? mappings.fpl_code : undefined;
    if (raw === undefined || raw === null) continue;
    const code = Number(raw);
    if (!Number.isInteger(code)) throw new Error(`Person file ${name} has FPL code ${String(raw)}, which is not a whole number`);
    const id = json.root_id;
    if (typeof id !== "string") throw new Error(`Person file ${name} has no root_id`);
    const known = codes.get(id);
    if (known !== undefined && known !== code) throw new Error(`Person ${id} has two FPL codes, ${known} and ${code}`);
    codes.set(id, code);
  }
  return codes;
}

/** Each player's FPL position by his `code`, from a season's FPL player list: bootstrap-static, or
 *  its `elements` alone, as the past-season source keeps the older seasons' lists
 *  (`data/raw/fpl_history/<season>/players_raw.json`). */
export function fplPositionsByCode(bootstrap: unknown): Map<number, FplPosition> {
  const elements = Array.isArray(bootstrap) ? bootstrap : isRecord(bootstrap) ? bootstrap.elements : undefined;
  if (!Array.isArray(elements)) throw new Error("The FPL player list has no `elements`");
  const positions = new Map<number, FplPosition>();
  for (const element of elements) {
    if (!isRecord(element) || typeof element.code !== "number") throw new Error("An FPL player has no `code`");
    if (element.element_type === FPL_MANAGER) continue;
    const position = FPL_POSITIONS.find((each) => each === element.element_type);
    if (position === undefined) throw new Error(`FPL player ${element.code} has position ${String(element.element_type)}, not one of FPL's four`);
    positions.set(element.code, position);
  }
  return positions;
}

/** The log's Premier League rows. */
export const premierLeagueRows = (rows: readonly LogRow[]): LogRow[] => rows.filter((row) => row[COMPETITION_COLUMN] === PREMIER_LEAGUE);

/** A person the season's Premier League rows name who has no FPL code: his person root id, his
 *  rows and the matches he played in them. */
export interface NoCodePerson {
  root: string;
  rows: number;
  played: number;
}

/** Who in the log's Premier League rows has no FPL code, A to Z. Older seasons may name a player
 *  ai-carling never matched to FPL: his played rows are kept under his person root id (S14.24), and
 *  the copy names him. */
export function withNoFplCode(log: readonly LogRow[], codes: ReadonlyMap<string, number>): NoCodePerson[] {
  const found = new Map<string, NoCodePerson>();
  for (const row of premierLeagueRows(log)) {
    const root = row[PERSON_COLUMN];
    if (typeof root !== "string" || codes.has(root)) continue;
    const person = found.get(root) ?? { root, rows: 0, played: 0 };
    person.rows += 1;
    if (playedIn(row)) person.played += 1;
    found.set(root, person);
  }
  return [...found.values()].sort((a, b) => a.root.localeCompare(b.root));
}

/** A row's value in `column`, or null where it has none; a value that isn't a number throws. */
function numberIn(row: LogRow, column: string): number | null {
  const value = row[column];
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${String(row[PERSON_COLUMN])}'s ${column} is ${String(value)}, not a number`);
  return value;
}

/** He played in the match: FPL counts him at least a minute. */
export const playedIn = (row: LogRow): boolean => (numberIn(row, STAT_COLUMNS.minutes) ?? 0) > 0;

/** A row's stats under our names. A column with no value is left out: the 267 played rows of
 *  2025/26 with no defensive contribution keep it absent, never 0 (#1113). The one exception is a
 *  feed that leaves its 0s out (ZERO_LEFT_OUT_BY): where it covered his match, its missing stat is 0. */
export function statsIn(row: LogRow): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const [stat, { feed, column }] of Object.entries(PAST_STAT_COLUMNS)) {
    const value = numberIn(row, column) ?? (coveredBy(row, feed) ? 0 : null);
    if (value !== null) stats[stat] = value;
  }
  return stats;
}

/** The feed covered his match: it is one that leaves its 0s out, and gives him minutes. */
function coveredBy(row: LogRow, feed: PastFeed): boolean {
  const minutes = ZERO_LEFT_OUT_BY[feed];
  return minutes !== undefined && numberIn(row, minutes) !== null;
}

/** A kickoff in ms. One the log gives with no zone is read as UTC, as FPL gives every kickoff. */
function kickoffIn(row: LogRow): number {
  const value = row[KICKOFF_COLUMN];
  const text = typeof value === "string" && !/(Z|[+-]\d\d:?\d\d)$/.test(value) && value.includes("T") ? `${value}Z` : value;
  const kickoff = typeof text === "string" ? Date.parse(text) : typeof text === "number" ? text : NaN;
  if (!Number.isFinite(kickoff)) throw new Error(`${String(row[PERSON_COLUMN])}'s ${KICKOFF_COLUMN} is ${String(value)}, not a time`);
  return kickoff;
}

/** The rows to store for `season` from the log's rows: every Premier League row he played, and one
 *  with no match for each player the season names who played none. Each player is found by his
 *  person root id's FPL `code`, and his position by that code; one with no code keeps his played
 *  rows under his person root id (S14.24). A played row no FPL position or club is found for, or a
 *  player twice at one kickoff, stops the copy, naming him. A row he only sat on the bench for is
 *  left out. */
export function pastSeasonRows(
  season: number,
  log: readonly LogRow[],
  codes: ReadonlyMap<string, number>,
  positions: ReadonlyMap<number, FplPosition>,
): PastSeasonRow[] {
  const rows: PastSeasonRow[] = [];
  const named = new Map<number, FplPosition>();
  const played = new Set<number>();
  const seen = new Set<string>();
  for (const row of premierLeagueRows(log)) {
    const root = row[PERSON_COLUMN];
    if (typeof root !== "string") throw new Error(`A Premier League row has ${PERSON_COLUMN} ${String(root)}`);
    const playerCode = codes.get(root);
    if (playerCode === undefined) {
      if (!playedIn(row)) continue;
      const kickoff = kickoffIn(row);
      playsOnce(seen, root, `Person ${root}`, kickoff);
      rows.push({ season, person: root, match: matchIn(row, `Person ${root}`, kickoff) });
      continue;
    }
    const fplPosition = positions.get(playerCode);
    if (fplPosition === undefined) {
      // Only on the bench, he never was in FPL's game that season (2022/23's and 2023/24's lists
      // each lack one such man): left out. One who played stops the copy.
      if (!playedIn(row)) continue;
      throw new Error(`Person ${root} (FPL code ${playerCode}) is not in the season's FPL player list`);
    }
    named.set(playerCode, fplPosition);
    if (!playedIn(row)) continue;
    const kickoff = kickoffIn(row);
    const who = `Person ${root} (FPL code ${playerCode})`;
    playsOnce(seen, String(playerCode), who, kickoff);
    played.add(playerCode);
    rows.push({ season, playerCode, fplPosition, match: matchIn(row, who, kickoff) });
  }
  for (const [playerCode, fplPosition] of named) {
    if (!played.has(playerCode)) rows.push({ season, playerCode, fplPosition, match: null });
  }
  return rows;
}

/** Marks `key` as playing at `kickoff`; a second time stops the copy, naming `who`. */
function playsOnce(seen: Set<string>, key: string, who: string, kickoff: number): void {
  const at = `${key}@${kickoff}`;
  if (seen.has(at)) throw new Error(`${who} plays twice at kickoff ${new Date(kickoff).toISOString()}`);
  seen.add(at);
}

/** The match a played row gives; one with no club stops the copy, naming `who`. */
function matchIn(row: LogRow, who: string, kickoff: number): PastMatch {
  const club = row[CLUB_COLUMN];
  if (typeof club !== "string" || club === "") throw new Error(`${who} has no ${CLUB_COLUMN} at kickoff ${new Date(kickoff).toISOString()}`);
  const started = row[STARTING_POSITION_COLUMN];
  const startingPosition = started === null || started === undefined ? null : String(started);
  return { kickoff, club, startingPosition, stats: statsIn(row) };
}

/** The season's sizes in the log's Premier League rows: its matches (by FPL's fixture id, counted
 *  and never kept), the rows of a man who played, the men who played, and the men named. */
export function seasonCounts(log: readonly LogRow[]): SeasonCounts {
  const league = premierLeagueRows(log);
  const playedRows = league.filter(playedIn);
  return {
    matches: new Set(playedRows.map((row) => row[FIXTURE_COLUMN])).size,
    playedRows: playedRows.length,
    played: new Set(playedRows.map((row) => row[PERSON_COLUMN])).size,
    named: new Set(league.map((row) => row[PERSON_COLUMN])).size,
  };
}
