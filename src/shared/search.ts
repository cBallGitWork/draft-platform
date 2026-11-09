// An address's search as a page reads it: a value of the wrong kind is dropped, so a hand-typed or
// stale address opens the page's default rather than failing (each feature's `paths.ts`).

import type { Id, TableNames } from "../../convex/_generated/dataModel";

/** A whole number, else dropped. */
export const wholeNumber = (value: unknown) => (typeof value === "number" && Number.isInteger(value) ? value : undefined);

/** A row's id, any non-empty string, else dropped. */
export const idOf = <Table extends TableNames>(value: unknown) =>
  typeof value === "string" && value !== "" ? (value as Id<Table>) : undefined;
