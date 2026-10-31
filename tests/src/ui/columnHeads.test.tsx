// The head row the data tables share (src/ui/ColumnHeads.tsx): each head shows its short
// word, is named by its long one, and takes the cell classes its column is given; a sortable one
// sorts.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ascendingGlyph, descendingGlyph, sortByLabel } from "../../../src/shared/words";
import { ColumnHeads } from "../../../src/ui/ColumnHeads";

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

it("an unseen column's head draws nothing, its short word kept for screen readers only", () => {
  table(<ColumnHeads columns={columns} unseen={["team"]} classOf={() => ""} />);
  const head = screen.getByRole("columnheader", { name: "Team" });
  expect(head.firstElementChild!.className).toBe("sr-only");
  expect(head.textContent).toBe("Team");
});

describe("sorting", () => {
  const sorted = (descending: boolean, sortBy = vi.fn()) => {
    table(<ColumnHeads columns={columns} classOf={() => ""} sort={{ by: "points", descending, sortable: ["team", "points"], sortBy }} />);
    return sortBy;
  };

  it("a sortable column's head is a button saying what it sorts by, and a press sorts by it", async () => {
    const sortBy = sorted(true);
    const team = screen.getByRole("columnheader", { name: "Team" });
    await userEvent.click(within(team).getByRole("button", { name: sortByLabel("Team") }));
    expect(sortBy).toHaveBeenCalledWith("team");
    expect(within(screen.getByRole("columnheader", { name: "Position" })).queryByRole("button")).toBeNull();
  });

  it("the column sorted by says which way, to screen readers and with its arrow", () => {
    sorted(true);
    const points = screen.getByRole("columnheader", { name: "Points" });
    expect(points.getAttribute("aria-sort")).toBe("descending");
    expect(points.textContent).toBe(`Pts ${descendingGlyph}`);
    expect(screen.getByRole("columnheader", { name: "Team" }).getAttribute("aria-sort")).toBeNull();
  });

  it("sorted the other way, its arrow turns", () => {
    sorted(false);
    const points = screen.getByRole("columnheader", { name: "Points" });
    expect(points.getAttribute("aria-sort")).toBe("ascending");
    expect(points.textContent).toBe(`Pts ${ascendingGlyph}`);
  });
});
