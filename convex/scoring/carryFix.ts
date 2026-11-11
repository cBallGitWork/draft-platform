import { sortedJson } from "../shared/sortedJson";
import { PRICINGS } from "./priced";
import type { StoredScoringSet } from "./scoringSetShape";

// A fix carried into the draft patch (spec/14, Changes and corrections; Craig, 6 Nov 2026, on #368:
// "the fix changes the live scoring at once and the same value in the draft, unless the draft
// already changes that value"). A value is any one setting of the set: whole points only, one
// category's value for an area or a position, its limit, its bands, an own stat. Categories and
// own stats are matched by their stat, a role by its role and a team instruction by its
// instruction, wherever they sit in the list. A category whose shape the
// fix and the draft both change, or a value the fix prices one way and the draft another (for all,
// by area, by position), is one value, so the draft's is kept whole.

type Json = unknown;

const isRecord = (value: Json): value is Record<string, Json> => typeof value === "object" && value !== null && !Array.isArray(value);
const same = (one: Json, other: Json) => sortedJson(one) === sortedJson(other);

/** What kind of value a record is: a rule's shape, and how a value is priced. */
const kindOf = (record: Record<string, Json>) => sortedJson([record.shape, PRICINGS.filter((key) => key in record)]);
const sameKind = (...records: Record<string, Json>[]) => records.every((record) => kindOf(record) === kindOf(records[0]));

/** What an entry of a list is known by: a category's or own stat's stat, a role's role, a team
 *  instruction's instruction. */
const ENTRY_KEYS = ["stat", "role", "instruction"];

/** The key every entry of a list of categories, own stats, roles or instructions is known by, or
 *  null for any other value (a rule's bands, a side's bars, an instruction's lines: each one
 *  value). */
function keyOfList(value: Json): string | null {
  if (!Array.isArray(value)) return null;
  return ENTRY_KEYS.find((key) => value.every((entry) => isRecord(entry) && typeof entry[key] === "string")) ?? null;
}

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
  const key = keyOfList(live);
  if (key !== null && key === keyOfList(fixed) && key === keyOfList(draft)) {
    return carryList(key, live as Record<string, Json>[], fixed as Record<string, Json>[], draft as Record<string, Json>[]);
  }
  return draft;
}

/** A list's entries carried by `key`: the draft's in its order, then any the fix added. */
function carryList(key: string, live: Record<string, Json>[], fixed: Record<string, Json>[], draft: Record<string, Json>[]): Json[] {
  const byStat = (list: Record<string, Json>[]) => new Map(list.map((entry) => [entry[key] as string, entry]));
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
