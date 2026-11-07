import { sortedJson } from "../shared/sortedJson";
import type { StoredScoringSet } from "./scoringSetShape";

// A fix carried into the draft patch (spec/14, Changes and corrections; Craig, 6 Nov 2026, on #368:
// "the fix changes the live scoring at once and the same value in the draft, unless the draft
// already changes that value"). A value is any one setting of the set: whole points only, one
// category's value for an area or a position, its limit, its bands, an own stat. Categories and
// own stats are matched by their stat, wherever they sit in the list. A category whose shape the
// fix and the draft both change, or a value the fix prices one way and the draft another (for all,
// by area, by position), is one value, so the draft's is kept whole.

type Json = unknown;

const isRecord = (value: Json): value is Record<string, Json> => typeof value === "object" && value !== null && !Array.isArray(value);
const same = (one: Json, other: Json) => sortedJson(one) === sortedJson(other);

/** What kind of value a record is: a rule's shape, and how a value is priced. */
const PRICINGS = ["all", "byArea", "byPosition"];
const kindOf = (record: Record<string, Json>) => sortedJson([record.shape, PRICINGS.filter((key) => key in record)]);
const sameKind = (...records: Record<string, Json>[]) => records.every((record) => kindOf(record) === kindOf(records[0]));

/** A list of categories or own stats: every entry has a stat it is known by. */
const isStatList = (value: Json): value is Record<string, Json>[] =>
  Array.isArray(value) && value.every((entry) => isRecord(entry) && typeof entry.stat === "string");

/** `draft` with every value `fixed` changes from `live` carried in, except where `draft` changes
 *  that value itself, which it keeps. */
function carry(live: Json, fixed: Json, draft: Json): Json {
  if (same(fixed, live)) return draft;
  if (same(draft, live)) return fixed;
  if (isRecord(live) && isRecord(fixed) && isRecord(draft) && sameKind(live, fixed, draft)) {
    const keys = new Set([...Object.keys(draft), ...Object.keys(fixed)]);
    const carried: Record<string, Json> = {};
    for (const key of keys) {
      const value = carry(live[key], fixed[key], draft[key]);
      if (value !== undefined) carried[key] = value;
    }
    return carried;
  }
  if (isStatList(live) && isStatList(fixed) && isStatList(draft)) return carryList(live, fixed, draft);
  return draft;
}

/** Categories or own stats carried by stat: the draft's in its order, then any the fix added. */
function carryList(live: Record<string, Json>[], fixed: Record<string, Json>[], draft: Record<string, Json>[]): Json[] {
  const byStat = (list: Record<string, Json>[]) => new Map(list.map((entry) => [entry.stat as string, entry]));
  const [liveOf, fixedOf, draftOf] = [byStat(live), byStat(fixed), byStat(draft)];
  const stats = [...new Set([...draftOf.keys(), ...fixedOf.keys()])];
  return stats.flatMap((stat) => {
    const value = carry(liveOf.get(stat), fixedOf.get(stat), draftOf.get(stat));
    return value === undefined ? [] : [value];
  });
}

/** The draft patch made from `live`, with what the fix `fixed` changes in `live` carried in, unless
 *  the draft already changes that value. */
export function carryFix(live: StoredScoringSet, fixed: StoredScoringSet, draft: StoredScoringSet): StoredScoringSet {
  return carry(live, fixed, draft) as StoredScoringSet;
}
