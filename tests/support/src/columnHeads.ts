// A data table's column heads, read as a screen reader and an eye do (src/ui/ColumnHeads.tsx):
// each found by its long word, its accessible name, and showing its short word.

import { within } from "@testing-library/react";
import { expect } from "vitest";
import type { ColumnWords } from "../../../src/ui/ColumnHeads";

/** Expects `scope`'s column heads to be exactly `columns`, in order: each head found by its long
 *  word, and showing its short one. */
export function expectColumnHeads(scope: HTMLElement, columns: readonly ColumnWords[]) {
  const heads = columns.map(({ long }) => within(scope).getByRole("columnheader", { name: long }));
  expect(heads.map((head) => head.textContent)).toEqual(columns.map(({ short }) => short));
  expect(within(scope).getAllByRole("columnheader")).toEqual(heads);
}

/** Expects the head named `long` in `scope` to draw nothing, its words kept for screen readers
 *  (ColumnHeads' `unseen`). */
export function expectUnseenHead(scope: HTMLElement, long: string) {
  expect(within(scope).getByRole("columnheader", { name: long }).firstElementChild!.className).toBe("sr-only");
}
