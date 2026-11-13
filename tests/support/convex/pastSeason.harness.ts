// The past-season copy's sample (#1113), read for the Convex tests: a few rows laid out as
// ai-carling-premiership lays out 2025/26, in tests/support/scripts/aiCarling/. Made by hand, since
// the parquet lives only on Craig's Mac: four men over two matches, one in every FPL position,
// their FPL points worked out by FPL's 2025/26 rules; an unused substitute who played none; two
// cup rows, which the copy drops; and a person with no FPL code.

import bootstrap from "../scripts/aiCarling/data/raw/fpl/wayback_bootstrap/bootstrap_sample.json";
import log from "../scripts/aiCarling/playerMatchLog.sample.json";
import { fplCodesByRoot, fplPositionsByCode, pastSeasonRows, type LogRow, type PastSeasonRow, type PersonFile } from "../../../convex/pastSeasons/pastSeasonRows";

const people = import.meta.glob("../scripts/aiCarling/data/identity/persons/root/*.json", { eager: true, import: "default" });

export const SAMPLE_SEASON = 2025;
export const SAMPLE_LOG: readonly LogRow[] = log;
export const SAMPLE_BOOTSTRAP: unknown = bootstrap;
export const SAMPLE_PERSONS: PersonFile[] = Object.entries(people).map(([path, json]) => ({ name: path.split("/").pop()!, json }));

type CodedRow = Extract<PastSeasonRow, { playerCode: number }>;

/** The sample's rows as the copy stores them: every one under an FPL code, as the sample's log
 *  names no one without one. */
export const sampleRows = (): CodedRow[] =>
  pastSeasonRows(SAMPLE_SEASON, SAMPLE_LOG, fplCodesByRoot(SAMPLE_PERSONS), fplPositionsByCode(SAMPLE_BOOTSTRAP)).map((row) => {
    if (!("playerCode" in row)) throw new Error(`The sample's log names ${row.person}, who has no FPL code`);
    return row;
  });
