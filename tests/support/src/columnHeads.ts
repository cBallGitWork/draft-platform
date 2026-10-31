// A data table's column heads, read as a screen reader and an eye do (src/ui/ColumnHeads.tsx):
// each found by its accessible name, both its words (columnHeadName), and showing its short word.

import { within } from "@testing-library/react";
import { expect } from "vitest";
import { columnHeadName, sortByLabel } from "../../../src/shared/words";
import type { ColumnWords } from "../../../src/ui/ColumnHeads";

/** The head in `scope` named by `words`, as a screen reader finds it. */
export const columnHeadIn = (scope: HTMLElement, words: ColumnWords) => within(scope).getByRole("columnheader", { name: columnHeadName(words) });

/** What a sortable head's button is called, the head named by `words`. */
export const sortLabelOf = (words: ColumnWords) => sortByLabel(columnHeadName(words));

/** Expects `scope`'s column heads to be exactly `columns`, in order: each head found by its
 *  accessible name, and showing its short word. */
export function expectColumnHeads(scope: HTMLElement, columns: readonly ColumnWords[]) {
  const heads = columns.map((words) => columnHeadIn(scope, words));
  expect(heads.map((head) => head.textContent)).toEqual(columns.map(({ short }) => short));
  expect(within(scope).getAllByRole("columnheader")).toEqual(heads);
}

/** Expects the head named by `words` in `scope` to draw nothing, its words kept for screen readers
 *  (ColumnHeads' `unseen`). */
export function expectUnseenHead(scope: HTMLElement, words: ColumnWords) {
  expect(columnHeadIn(scope, words).firstElementChild!.className).toBe("sr-only");
}
