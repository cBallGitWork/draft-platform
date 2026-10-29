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
