// Each club's colours on the admin's dashboard (#838; spec/15, The admin): a club with none waits
// in the queue, and the admin sets any club's two colours and pattern.

import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ADMIN_PATH } from "../../../src/admin/paths";
import {
  coloursClubLabel,
  noUncolouredWords,
  patternLabel,
  patternWords,
  primaryLabel,
  saveColoursWords,
  secondaryLabel,
  uncolouredTitle,
} from "../../../src/admin/words";
import type { PositionsQueue } from "../../../src/admin/seam";
import { EMPTY_QUEUE } from "../../support/src/admin.harness";
import { admin, openApp } from "../../support/src/shell.harness";

const ARSENAL = { code: 3, name: "Arsenal", colours: { primary: "#E50107", secondary: "#FFFFFF", pattern: "plain" as const } };
/** Promoted, with no colours held yet. */
const WREXHAM = { code: 999, name: "Wrexham", colours: null };

const openDashboard = (clubs: PositionsQueue["clubs"]) =>
  openApp(ADMIN_PATH, admin, { admin: { queue: { ...EMPTY_QUEUE, clubs } } });

describe("club colours", () => {
  it("lists a club with no colours in the queue", async () => {
    openDashboard([ARSENAL, WREXHAM]);
    const waiting = await screen.findByRole("list", { name: uncolouredTitle });
    expect(within(waiting).getAllByRole("listitem").map((item) => item.textContent)).toEqual([WREXHAM.name]);
  });

  it("says so when every club has its colours", async () => {
    openDashboard([ARSENAL]);
    expect(await screen.findByText(noUncolouredWords)).toBeTruthy();
  });

  it("starts on a club with no colours, and saves the colours and pattern chosen for it", async () => {
    const app = openDashboard([ARSENAL, WREXHAM]);
    const menu = (await screen.findByRole("combobox", { name: coloursClubLabel })) as HTMLSelectElement;
    expect(menu.selectedOptions[0].textContent).toBe(WREXHAM.name);
    fireEvent.input(screen.getByLabelText(primaryLabel), { target: { value: "#d71920" } });
    fireEvent.input(screen.getByLabelText(secondaryLabel), { target: { value: "#000000" } });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: patternLabel }), patternWords.stripes);
    await userEvent.click(screen.getByRole("button", { name: saveColoursWords }));
    expect(app.admin.setClubColours).toHaveBeenCalledExactlyOnceWith(WREXHAM.code, { primary: "#d71920", secondary: "#000000", pattern: "stripes" });
  });

  it("starts from a chosen club's colours as held", async () => {
    const app = openDashboard([ARSENAL, WREXHAM]);
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: coloursClubLabel }), ARSENAL.name);
    expect((screen.getByLabelText(primaryLabel) as HTMLInputElement).value).toBe("#e50107");
    await userEvent.click(screen.getByRole("button", { name: saveColoursWords }));
    expect(app.admin.setClubColours).toHaveBeenCalledExactlyOnceWith(ARSENAL.code, ARSENAL.colours);
  });
});
