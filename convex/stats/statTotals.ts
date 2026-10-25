// A player's match stats added up (#373): pure sums, with no I/O, for his season totals.

/** Stats by the name the merged record keeps each under (matchRecords.ts). */
export type Stats = Record<string, number>;

/** The decimal places a total keeps. The feeds send at most two (expected goals), so six keeps
 *  every sum exact while dropping the floating-point dust adding and taking away leaves behind. */
const TOTAL_DECIMALS = 6;
const TOTAL_SCALE = 10 ** TOTAL_DECIMALS;

const rounded = (value: number) => Math.round(value * TOTAL_SCALE) / TOTAL_SCALE;

/** `totals` with `stats` added, or taken away when `sign` is -1. A stat either leaves out counts 0,
 *  and a total of 0 is left out, so a stat a correction took away leaves no trace. */
export function addStats(totals: Stats, stats: Stats, sign: 1 | -1 = 1): Stats {
  const sum: Stats = { ...totals };
  for (const [stat, value] of Object.entries(stats)) {
    const total = rounded((sum[stat] ?? 0) + sign * value);
    if (total === 0) delete sum[stat];
    else sum[stat] = total;
  }
  return sum;
}

/** Every one of these stats added up. */
export function sumStats(each: readonly Stats[]): Stats {
  return each.reduce<Stats>((totals, stats) => addStats(totals, stats), {});
}
