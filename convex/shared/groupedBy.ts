// No imports: patchChanges.ts uses this and is loaded by the browser too (src/patches/words.ts).

/** `items` grouped by `keyOf`: keys in the order first seen, each key's items in the order given.
 *  (convex/tsconfig.json's ES2023 lib doesn't type Map.groupBy.) */
export function groupedBy<T, K>(items: Iterable<T>, keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [item]);
    else group.push(item);
  }
  return groups;
}

/** `items` by `keyOf`, a second item with one key told apart by its count ("goals_scored#2"), so
 *  none is lost: the scoring may hold two categories for one stat (Craig, 11 Nov 2026, on #1616). */
export function keyedByCount<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T> {
  const seen = new Map<string, number>();
  return new Map(
    items.map((item) => {
      const key = keyOf(item);
      const count = (seen.get(key) ?? 0) + 1;
      seen.set(key, count);
      return [count === 1 ? key : `${key}#${count}`, item] as const;
    }),
  );
}

/** `items` grouped by a number, highest first, each group's items in the order given. */
export function rankedGroups<T>(items: Iterable<T>, keyOf: (item: T) => number): T[][] {
  return [...groupedBy(items, keyOf).entries()].toSorted(([one], [other]) => other - one).map(([, group]) => group);
}
