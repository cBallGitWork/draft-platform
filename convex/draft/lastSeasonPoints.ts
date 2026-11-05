import type { QueryCtx } from "../_generated/server";

// Last season's points under the site's scoring, which auto-pick falls back on for a player the
// admin's ranking leaves out, or for every player while none is uploaded (spec/04, The queue and
// the ranking; #1094). Pricing last season under today's scoring is #1114's; until then these are
// DUMMY STAGING DATA, made up: "just make a dummy csv for this, its just staging data currently"
// (Craig, 5 Nov 2026, on #1094). #1114 replaces the file behind `lastSeasonPoints`, never its shape,
// so auto-pick needn't change.

/** Made-up points, a row a player: his FPL `code`, then his points. Not real players' totals. */
export const DUMMY_LAST_SEASON_POINTS_CSV = `code,points
118748,231
223340,224
209244,210
178301,198
226597,187
219847,181
195735,176
180804,170
232223,164
224024,158
141746,152
168991,147
205651,141
437730,136
154566,131
200402,128
220566,122
199796,117
184029,112
213345,108
438098,104
225796,99
101668,95
230046,90
240513,86
212319,81
231747,77
461358,72
216051,66
244723,61
192895,55
228286,48
153723,41
444145,33
198849,24
225321,17
232787,9
109745,0
498016,-2
`;

/** Each player's points last season under the site's scoring, by FPL code. A player missing from
 *  it wasn't in last season's data: a newcomer. Reads the dummy file until #1114 (`ctx` is for its
 *  rows). */
export async function lastSeasonPoints(_ctx: QueryCtx): Promise<ReadonlyMap<number, number>> {
  return readPointsFile(DUMMY_LAST_SEASON_POINTS_CSV);
}

/** The points file read, its header line skipped. A line that isn't two whole numbers throws: the
 *  file is ours, so a bad line is a mistake, never one to skip. */
export function readPointsFile(file: string): ReadonlyMap<number, number> {
  const points = new Map<number, number>();
  for (const line of file.trim().split("\n").slice(1)) {
    const [code, total] = line.split(",").map(Number);
    if (!Number.isInteger(code) || !Number.isInteger(total)) throw new Error(`Last season's points file has a bad line: "${line}"`);
    points.set(code, total);
  }
  return points;
}
