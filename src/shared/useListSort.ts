import { useState } from "react";
import type { CatalogueStat } from "../../convex/scoring/statCatalogueList";

/** A players list's sort, by one of its columns, one of them the shown stat's. */
type ListSort<Column extends string> = { by: Column; descending: boolean };

/** A players list's sort and shown stat, as Scouting's and the draft room's keep them: a column
 *  head pressed again turns its order round, and a new one opens its own first way; a stat chosen
 *  is sorted by, its first way, and with none a sort by the stat goes back to the opening one. */
export function useListSort<Column extends string>(opening: ListSort<Column | "stat">, firstDescending: Record<Column | "stat", boolean>) {
  const [sort, setSort] = useState(opening);
  const [stat, setStat] = useState<CatalogueStat | null>(null);
  const sortBy = (by: Column | "stat") => setSort(by === sort.by ? { by, descending: !sort.descending } : { by, descending: firstDescending[by] });
  const show = (chosen: CatalogueStat | null) => {
    setStat(chosen);
    if (chosen !== null) setSort({ by: "stat", descending: firstDescending.stat });
    else if (sort.by === "stat") setSort(opening);
  };
  return { sort, sortBy, stat, show };
}
