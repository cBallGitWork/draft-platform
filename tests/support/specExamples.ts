// Reads an example table out of a spec file, so a test runs Craig's own rows (#454). A table sits
// under a bold caption naming the answer it shows, such as "**When a match locks** (`S07.2`):",
// and each row comes back keyed by its column's heading. A missing or empty table throws: a test
// that quietly ran no rows would pass while proving nothing.

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());

/** The rows of the example table captioned with answer `id` in `markdown`, a spec file's text. */
export function exampleTable(markdown: string, id: string): Record<string, string>[] {
  const lines = markdown.split("\n");
  const at = lines.findIndex((line) => line.startsWith("**") && line.includes(`(\`${id}\`)`));
  if (at === -1) throw new Error(`no example table is captioned with ${id}`);
  // The table is the first run of "|" lines after the caption; the next caption's table is not it.
  const after = lines.slice(at + 1);
  const start = after.findIndex((line) => line.startsWith("|"));
  const nextCaption = after.findIndex((line) => line.startsWith("**"));
  const run = start === -1 || (nextCaption !== -1 && nextCaption < start) ? [] : after.slice(start);
  const end = run.findIndex((line) => !line.startsWith("|"));
  const [heading, rule, ...body] = end === -1 ? run : run.slice(0, end);
  if (heading === undefined || rule === undefined || body.length === 0) throw new Error(`${id}'s example table has no rows`);
  const columns = cells(heading);
  const rows = body.map((line) => {
    const values = cells(line);
    if (values.length !== columns.length) throw new Error(`${id}'s row "${line}" has ${values.length} cells, not ${columns.length}`);
    return Object.fromEntries(columns.map((column, index) => [column, values[index]!]));
  });
  return rows;
}
