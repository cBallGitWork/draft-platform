// The head row of every data table whose columns have a short and a long word (plate.md, Colour
// roles: the head band).

/** A column's head words: the short one is shown, the long one is its tooltip and accessible name. */
export type ColumnWords = { short: string; long: string };

/** A data table's head row: one column head per shown column, in order, each showing its short word
 *  and named by its long one. `shown` defaults to every column; `classOf` gives each head its cell
 *  classes, so a head lines up with the cells under it. */
export function ColumnHeads<Column extends string>({
  columns,
  shown = Object.keys(columns) as Column[],
  classOf,
}: {
  columns: Record<Column, ColumnWords>;
  shown?: readonly Column[];
  classOf: (column: Column) => string;
}) {
  return (
    <thead className="bg-head text-ground">
      <tr>
        {shown.map((column) => (
          <th key={column} scope="col" title={columns[column].long} aria-label={columns[column].long} className={classOf(column)}>
            {columns[column].short}
          </th>
        ))}
      </tr>
    </thead>
  );
}
