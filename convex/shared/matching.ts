// The one "can these fill those" matcher (#1575): the first lineup's shapes (lineup/firstLineup.ts),
// the squad's area minimums (squads/areaMinimums.ts) and the Tactics screen's best fit and Quick
// Pick (src/myTeam/tactics/reshape.ts, quickPick.ts). No imports: the browser loads it too.

/** How a left looks through its candidates. `inOrder` (Kuhn's): each candidate in turn, taken if
 *  open or if its holder can move elsewhere. `openFirst`: the first open candidate if any, and only
 *  then each held one in turn, so a left placed earlier moves only when it must. */
export type TieBreak = "inOrder" | "openFirst";

/** Each left matched to one of its candidates, no candidate twice, as many matched as can be
 *  (augmenting paths). Lefts are placed in the order given and one placed earlier may move to
 *  another of its candidates, never out of the match, so the earlier in `lefts`, the surer of a
 *  place. `candidatesOf` lists a left's candidates, the one it would rather first; `keyOf` tells
 *  two candidates apart. A left with none is left out of the map. */
export function matched<Left, Right, Key>(
  lefts: readonly Left[],
  candidatesOf: (left: Left) => readonly Right[],
  keyOf: (right: Right) => Key,
  tieBreak: TieBreak = "inOrder",
): Map<Left, Right> {
  const holder = new Map<Key, Left>();
  const matchOf = new Map<Left, Right>();
  const take = (left: Left, right: Right) => {
    holder.set(keyOf(right), left);
    matchOf.set(left, right);
  };
  const place = (left: Left, seen: Set<Key>): boolean => {
    const candidates = candidatesOf(left);
    if (tieBreak === "openFirst") {
      const open = candidates.find((right) => !holder.has(keyOf(right)));
      if (open !== undefined) {
        take(left, open);
        return true;
      }
    }
    return candidates.some((right) => {
      const key = keyOf(right);
      if (seen.has(key)) return false;
      seen.add(key);
      const held = holder.get(key);
      if (held !== undefined && !place(held, seen)) return false;
      take(left, right);
      return true;
    });
  };
  for (const left of lefts) place(left, new Set());
  return matchOf;
}
