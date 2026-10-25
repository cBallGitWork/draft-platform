/** Every row `query` finds, at most `most` of them; more throws `tooMany`, never a silent cut
 *  (#214). Each table that grows season on season reads through this with its own named cap. */
export async function takeAllOrThrow<Row>(query: { take(n: number): Promise<Row[]> }, most: number, tooMany: string): Promise<Row[]> {
  const rows = await query.take(most + 1);
  if (rows.length > most) throw new Error(tooMany);
  return rows;
}
