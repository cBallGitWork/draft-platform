// Deleting a league on "Your leagues" (#75, spec/13, Deleting): Delete league and its plain
// confirm for the admin or the commissioner, and Undo while it's being deleted.

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { GAMEWEEKS_TITLE } from "../../../src/gameweeks/words";
import { invitesTitle } from "../../../src/joining/words";
import { SQUADS_TITLE } from "../../../src/squads/words";
import { adminSeeing, beingDeleted, commissioned, deleterOf, league, managerIn, openApp } from "../../support/src/shell.harness";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { confirmDelete, unemailed, unsentLinkWords } from "../../../src/leagues/words";

const deleter = deleterOf(
  beingDeleted(commissioned, {
    deletesAt: Date.parse("2026-10-21T09:00:00Z"),
    unemailed: [{ email: "ann@example.com", reason: "paused" }],
  }),
);

const deleteButton = () => screen.queryByRole("button", { name: "Delete league" });
const deleteButtonShown = () => screen.findByRole("button", { name: "Delete league" });

describe("Delete league", () => {
  it.each([
    ["the commissioner", managerIn(commissioned)],
    ["the admin", adminSeeing({ ...league, roles: [] })],
  ])("%s is offered it", async (_, session) => {
    openApp(LEAGUES_PATH, session);
    expect(await deleteButtonShown()).toBeTruthy();
  });

  it.each([
    ["a manager", managerIn(league)],
    ["the co-commissioner", managerIn({ ...league, roles: ["co-commissioner", "manager"] })],
  ])("%s isn't", async (_, session) => {
    openApp(LEAGUES_PATH, session);
    await screen.findByRole("rowheader", { name: new RegExp(`^${league.name}`) });
    expect(deleteButton()).toBeNull();
  });

  it("asks first, and deletes the league once confirmed", async () => {
    const app = openApp(LEAGUES_PATH, managerIn(commissioned));
    await userEvent.click(await deleteButtonShown());
    expect(screen.getByText(confirmDelete(league.name))).toBeTruthy();
    expect(app.leagues.deleteLeague).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Delete it" }));
    expect(app.leagues.deleteLeague).toHaveBeenCalledExactlyOnceWith(league.leagueId);
  });

  it("Keep it deletes nothing", async () => {
    const app = openApp(LEAGUES_PATH, managerIn(commissioned));
    await userEvent.click(await deleteButtonShown());
    await userEvent.click(screen.getByRole("button", { name: "Keep it" }));

    expect(screen.queryByText(confirmDelete(league.name))).toBeNull();
    expect(deleteButton()).toBeTruthy();
    expect(app.leagues.deleteLeague).not.toHaveBeenCalled();
  });

  it("says why, when the server refuses", async () => {
    const app = openApp(LEAGUES_PATH, managerIn(commissioned));
    app.leagues.deleteLeague.mockResolvedValue("Only the league's commissioner or the admin can delete it.");
    await userEvent.click(await deleteButtonShown());
    await userEvent.click(screen.getByRole("button", { name: "Delete it" }));

    const refusal = await screen.findByRole("alert");
    expect(refusal.textContent).toBe("Only the league's commissioner or the admin can delete it.");
    // In the alert strip, as every refusal is (Problem).
    expect(refusal.classList.contains("alert-strip")).toBe(true);
  });
});

describe("a league being deleted", () => {
  it("shows when it goes on the email's clock, and who wasn't told, and Undo undoes it", async () => {
    const app = openApp(LEAGUES_PATH, deleter);

    // The moment tests/convex/leagues/deletionNotices.test.ts finds in the email, said the same way.
    expect(await screen.findByText(/goes for good on Wednesday 21 October at 10:00 BST\./)).toBeTruthy();
    expect(screen.getByText(unemailed("ann@example.com", unsentLinkWords.paused))).toBeTruthy();
    expect(deleteButton()).toBeNull();
    // Frozen, it offers nothing to change: no gameweeks, no invites, no squads.
    expect(screen.queryByRole("link", { name: GAMEWEEKS_TITLE })).toBeNull();
    expect(screen.queryByRole("link", { name: invitesTitle })).toBeNull();
    expect(screen.queryByRole("link", { name: SQUADS_TITLE })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(app.leagues.undoDeletion).toHaveBeenCalledExactlyOnceWith(league.leagueId);
  });

  it("says why Undo didn't work", async () => {
    const app = openApp(LEAGUES_PATH, deleter);
    app.leagues.undoDeletion.mockResolvedValue("It's too late to undo: the league is being deleted for good.");
    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));

    const refusal = await screen.findByRole("alert");
    expect(refusal.textContent).toBe("It's too late to undo: the league is being deleted for good.");
    // The row is already the alert strip, so the refusal is a line in it, not a strip inside a strip.
    expect(refusal.classList.contains("alert-strip")).toBe(false);
    expect(refusal.closest("td")?.classList.contains("alert-strip")).toBe(true);
  });
});
