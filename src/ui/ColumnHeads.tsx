// The head row of every data table: each column has a short and a long word (Craig, 31 Oct 2026:
// "Colums should all have a long and short version"; plate.md, Colour roles: the head band).

import { ascendingGlyph, columnHeadName, descendingGlyph, sortByLabel } from "../shared/words";

/** A column's cells left off a phone, which has no room for them (#424). */
export const DESK_ONLY_CELL = "hidden sm:table-cell";

/** A data table's cell classes: words on the left, figures on the right, and the desk-only columns
 *  hidden on a phone. A head and the cells under it share them. */
export const cellClassOf = (left: boolean, deskOnly = false) =>
  `px-2 align-middle ${left ? "text-left" : "text-right"}${deskOnly ? ` ${DESK_ONLY_CELL}` : ""}`;

/** A column's head words: the short one is shown, the long one is its tooltip, and both are its
 *  accessible name (columnHeadName). */
export type ColumnWords = { short: string; long: string };

/** How a sortable table is sorted: the column sorted by, which way, the columns a head press can
 *  sort by, and what a press does. */
type ColumnSort<Column extends string, Sortable extends Column> = {
  by: Column;
  descending: boolean;
  sortable: readonly Sortable[];
  sortBy: (column: Sortable) => void;
};

/** A data table's head row: one column head per shown column, in order, each showing its short word
 *  and named by both (columnHeadName). `shown` defaults to every column; `classOf` gives each head
 *  its cell classes, so a head lines up with the cells under it. An `unseen` column's head draws nothing,
 *  such as the stat column between two clubs. With `sort`, a sortable column's head is a button,
 *  and the column sorted by says which way. */
export function ColumnHeads<Column extends string, Sortable extends Column = Column>({
  columns,
  shown = Object.keys(columns) as Column[],
  classOf,
  unseen = [],
  sort,
}: {
  columns: Record<Column, ColumnWords>;
  shown?: readonly Column[];
  classOf: (column: Column) => string;
  unseen?: readonly NoInfer<Column>[];
  sort?: ColumnSort<Column, Sortable>;
}) {
  return (
    <thead className="bg-head text-ground">
      <tr>
        {shown.map((column) => {
          const words = columns[column];
          const { short, long } = words;
          const name = columnHeadName(words);
          const sortable = sort?.sortable.find((each) => each === column);
          const press = sort === undefined || sortable === undefined ? undefined : () => sort.sortBy(sortable);
          const sorted = sort !== undefined && sort.by === column;
          return (
            <th
              key={column}
              scope="col"
              title={long}
              aria-label={name}
              aria-sort={sorted ? (sort.descending ? "descending" : "ascending") : undefined}
              className={classOf(column)}
            >
              {unseen.includes(column) ? (
                <span className="sr-only">{short}</span>
              ) : press === undefined ? (
                short
              ) : (
                <button type="button" aria-label={sortByLabel(name)} onClick={press} className="min-h-tap font-bold">
                  {short}
                  {sorted && <span aria-hidden="true"> {sort.descending ? descendingGlyph : ascendingGlyph}</span>}
                </button>
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
