// The head row the data tables share (src/frame/ColumnHeads.tsx): each head shows its short
// word, is named by its long one, and takes the cell classes its column is given.

import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it } from "vitest";
import { ColumnHeads } from "../../../src/frame/ColumnHeads";

const columns = {
  position: { short: "Pos", long: "Position" },
  team: { short: "Team", long: "Team" },
  points: { short: "Pts", long: "Points" },
};

const table = (heads: ReactNode) => render(<table>{heads}</table>);

it("draws one column head per column in order, showing the short word and named by the long one", () => {
  table(<ColumnHeads columns={columns} classOf={() => "px-2"} />);
  const heads = screen.getAllByRole("columnheader");
  expect(heads.map((head) => head.textContent)).toEqual(["Pos", "Team", "Pts"]);
  expect(heads.map((head) => head.getAttribute("aria-label"))).toEqual(["Position", "Team", "Points"]);
  expect(heads.map((head) => head.getAttribute("title"))).toEqual(["Position", "Team", "Points"]);
  expect(screen.getByRole("columnheader", { name: "Points" }).getAttribute("scope")).toBe("col");
});

it("sits in the head band", () => {
  table(<ColumnHeads columns={columns} classOf={() => ""} />);
  const head = screen.getAllByRole("rowgroup")[0];
  expect(head.tagName).toBe("THEAD");
  expect(head.className).toBe("bg-head text-ground");
});

it("draws only the shown columns, in the order shown, each with its own classes", () => {
  table(<ColumnHeads columns={columns} shown={["points", "position"]} classOf={(column) => (column === "points" ? "text-right" : "text-left")} />);
  const heads = within(screen.getAllByRole("row")[0]).getAllByRole("columnheader");
  expect(heads.map((head) => head.textContent)).toEqual(["Pts", "Pos"]);
  expect(heads.map((head) => head.className)).toEqual(["text-right", "text-left"]);
});
