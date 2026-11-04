/** A Fisher-Yates shuffle of `items` in place, by `random`: the round robin's draw
 *  (../table/roundRobin.ts) and the draft order's (../draft/draftOrder.ts). */
export function shuffle<Item>(items: Item[], random: () => number): Item[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}
