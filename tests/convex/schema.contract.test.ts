import { expect, test } from "vitest";
import schema from "../../convex/schema";

// The schema's contract: the shape of every saved table, pinned in tests/support/golden/schema.json.
// - A changed schema is a migration of saved data. The schema pulls in rules/leagueRulesShape,
//   positions, signIn and @convex-dev/auth's tables, so a change can come from outside schema.ts.
// - `schema.export()` is Convex-internal: after a Convex upgrade, run `vitest -u` and check the diff
//   holds only Convex's own wording, never a table or field.
// - A feature PR that changes the schema regenerates the file in the same PR.
test("the schema is the one pinned in the golden file", async () => {
  // Convex's published types leave out the internal `export()`, so it is named here by hand.
  const exported = (schema as unknown as { export(): string }).export();
  await expect(JSON.stringify(JSON.parse(exported), null, 2)).toMatchFileSnapshot("../support/golden/schema.json");
});
