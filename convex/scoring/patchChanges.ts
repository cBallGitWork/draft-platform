import { AREAS, LANES, positionOfSlot, SLOT_POSITIONS, type Area, type SlotPosition } from "../lineup/pitch";
import type { StoredScoringSet } from "../rules/leagueRulesShape";
import { categoryName } from "./categories";
import { priceFor, type Band, type Priced, type PointsLimit } from "./scoringSet";

// What changed between two versions of the site's scoring set (spec/14, Changes and corrections:
// the patch notes list every version's changes; #356), worked out from the stored sets, never typed
// by hand: one line a change, in the words the patch notes and the patch's Mail letter say, in one
// place for Craig to change. A rule is compared position by position, so a value set by area that
// becomes one for all names only the positions whose points moved.

/** What the notes and the letter say for a version with no change to list: only reordering the
 *  categories makes one. */
export const NOTHING_SCORES_DIFFERENTLY = "Nothing scores differently.";

type Rule = StoredScoringSet["rules"][number];
type OwnStat = NonNullable<StoredScoringSet["ownStats"]>[number];
type PositionWords = ReadonlyMap<SlotPosition, string>;

/** The area each slot position is played in (spec/14's table), for `priceFor`. */
const AREA_OF: ReadonlyMap<SlotPosition, Area> = new Map(
  AREAS.flatMap((area) => LANES.map((lane) => [positionOfSlot({ area, lane }), area] as const)),
);

/** An optional setting not set, such as no points limit. */
const NONE = "none";

/** What a priced setting gives each position, as words; an optional one not set is NONE. */
function wordsByPosition<Value>(priced: Priced<Value> | undefined, words: (value: Value) => string): PositionWords {
  return new Map(SLOT_POSITIONS.map((position) => [position, priced === undefined ? NONE : words(priceFor(priced, AREA_OF.get(position)!, position))]));
}

const pointsWords = (points: number) => (points < 0 ? `−${-points}` : String(points));
const bandWords = (bands: readonly Band[]) =>
  bands.length === 0 ? "nothing" : bands.map((band) => `${pointsWords(band.points)} at ${band.atLeast}+`).join(", ");

/** A rule's points for each position: "3", "1 per 3", "1 at 1+, 2 at 60+". */
function valueWords(rule: Rule): PositionWords {
  switch (rule.shape) {
    case "perAction":
      return wordsByPosition(rule.values, pointsWords);
    case "perCount":
      return wordsByPosition(rule.values, ({ points, every }) => `${pointsWords(points)} per ${every}`);
    case "bands":
      return wordsByPosition<readonly Band[]>(rule.values, bandWords);
  }
}

function limitWords({ max, min }: PointsLimit): string {
  const ends = [
    ...(max === null ? [] : [`at most ${pointsWords(max)}`]),
    ...(min === null ? [] : [`at least ${pointsWords(min)}`]),
  ];
  return ends.length === 0 ? NONE : ends.join(", ");
}
const minutesWords = (minutes: number) => `${minutes} minutes`;

/** Positions' words grouped where alike: "5" when every position says the same, else each group,
 *  "GK: 10; FB, CB: 6". Only the positions given are named. */
function grouped(words: ReadonlyArray<readonly [SlotPosition, string]>): string {
  const groups = new Map<string, SlotPosition[]>();
  for (const [position, said] of words) groups.set(said, [...(groups.get(said) ?? []), position]);
  if (groups.size === 1 && words.length === SLOT_POSITIONS.length) return [...groups.keys()][0];
  return [...groups].map(([said, positions]) => `${positions.join(", ")}: ${said}`).join("; ");
}

/** One setting's change across the positions: "5 → 6" when every position moved alike, else each
 *  group of positions that moved alike, "GK, CB: 6 → 7; ST: 4 → 5". Null when none moved. */
function settingChange(before: PositionWords, after: PositionWords): string | null {
  const moved = SLOT_POSITIONS.filter((position) => before.get(position) !== after.get(position));
  if (moved.length === 0) return null;
  return grouped(moved.map((position) => [position, `${before.get(position)} → ${after.get(position)}`] as const));
}

const SHAPE_WORDS: Record<Rule["shape"], string> = { perAction: "per action", perCount: "per number of actions", bands: "in bands" };

/** A whole rule, as a category newly scored or newly shaped is described: "3 per action". */
function ruleWords(rule: Rule): string {
  const stacking = rule.shape === "bands" && rule.stack ? ", every band reached counting" : "";
  return `${grouped([...valueWords(rule)])} ${SHAPE_WORDS[rule.shape]}${stacking}`;
}

/** The lines saying how one category's rule changed, each naming it. */
function ruleChanges(name: string, before: Rule, after: Rule): string[] {
  if (before.shape !== after.shape) return [`${name}: now worth ${ruleWords(after)}`];
  const lines: string[] = [];
  const values = settingChange(valueWords(before), valueWords(after));
  if (values) lines.push(`${name}: ${values}`);
  if (before.shape === "bands" && after.shape === "bands" && before.stack !== after.stack) {
    lines.push(`${name}: ${after.stack ? "every band reached now counts" : "only the highest band reached now counts"}`);
  }
  const limit = settingChange(wordsByPosition(before.limit, limitWords), wordsByPosition(after.limit, limitWords));
  if (limit) lines.push(`${name}, points limit: ${limit}`);
  const minutes = settingChange(wordsByPosition(before.minMinutes, minutesWords), wordsByPosition(after.minMinutes, minutesWords));
  if (minutes) lines.push(`${name}, earned only after: ${minutes}`);
  return lines;
}

/** "Tackles + 0.5 × Clearances − Shots on target". */
function ownStatFormula(own: OwnStat): string {
  return own.parts
    .map(({ stat, weight }, index) => {
      const sign = weight < 0 ? "− " : index === 0 ? "" : "+ ";
      const size = Math.abs(weight) === 1 ? "" : `${Math.abs(weight)} × `;
      return `${sign}${size}${categoryName(stat)}`;
    })
    .join(" ");
}
const ownStatWords = (own: OwnStat) => `${own.name} (${own.shortCode}) = ${ownStatFormula(own)}`;

function ownStatChanges(before: readonly OwnStat[], after: readonly OwnStat[]): string[] {
  const lines: string[] = [];
  for (const own of after) {
    const was = before.find((each) => each.stat === own.stat);
    if (was === undefined) lines.push(`New own stat: ${ownStatWords(own)}`);
    else if (ownStatWords(was) !== ownStatWords(own)) lines.push(`Own stat ${was.name} (${was.shortCode}) is now ${ownStatWords(own)}`);
  }
  for (const own of before) if (!after.some((each) => each.stat === own.stat)) lines.push(`Own stat removed: ${own.name} (${own.shortCode})`);
  return lines;
}

/** Each rule by its category, a second rule for one category told apart by its count. */
function rulesByKey(rules: readonly Rule[]): Map<string, Rule> {
  const seen = new Map<string, number>();
  return new Map(
    rules.map((rule) => {
      const count = (seen.get(rule.stat) ?? 0) + 1;
      seen.set(rule.stat, count);
      return [count === 1 ? rule.stat : `${rule.stat}#${count}`, rule] as const;
    }),
  );
}

/** Every change from `before` to `after`, one line each: the rules in the new set's order, those
 *  no longer scored, whole points, then own stats. None when the two score alike. */
export function scoringChanges(before: StoredScoringSet, after: StoredScoringSet): string[] {
  const beforeRules = rulesByKey(before.rules);
  const afterRules = rulesByKey(after.rules);
  const lines: string[] = [];
  for (const [key, rule] of afterRules) {
    const was = beforeRules.get(key);
    const name = categoryName(rule.stat, after.ownStats);
    lines.push(...(was === undefined ? [`${name}: newly scored, ${ruleWords(rule)}`] : ruleChanges(name, was, rule)));
  }
  for (const [key, rule] of beforeRules) if (!afterRules.has(key)) lines.push(`${categoryName(rule.stat, before.ownStats)}: no longer scored`);
  if (before.wholePointsOnly !== after.wholePointsOnly) lines.push(after.wholePointsOnly ? "Points are now whole only" : "Points can now be fractions");
  lines.push(...ownStatChanges(before.ownStats ?? [], after.ownStats ?? []));
  return lines;
}
