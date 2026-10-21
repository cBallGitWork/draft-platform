// The admin's dashboard (#87; spec/06 The admin oversees them): reached from Your leagues by the
// admin alone; the queue of new signings and starts waiting; approving a club; how starts count;
// and correcting any player's positions.

import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { admin, commissioner, openApp } from "../../support/src/shell.harness";
import type { AdminData } from "../../support/src/admin.harness";
import { EMPTY_QUEUE } from "../../support/src/admin.harness";
import { ADMIN_PATH } from "../../../src/admin/paths";
import {
  ADMIN_TITLE,
  approveLabel,
  confirmLabel,
  findLabel,
  findTitle,
  foundListLabel,
  loadingWords,
  removeLabel,
  searchingWords,
  setLabel,
  switchModeWords,
} from "../../../src/admin/words";

afterEach(cleanup);

const STEUR = { code: 1, name: "Steur", fullName: "Jacob Steur", clubCode: 4, label: "Centre Central Midfielder" };
const BARNES = { code: 2, name: "Barnes", fullName: "Harvey Barnes", clubCode: 4, proposals: ["W" as const] };
const DATA: AdminData = {
  queue: {
    newSignings: [STEUR],
    waiting: [BARNES],
    clubs: [
      { code: 3, name: "Arsenal" },
      { code: 4, name: "Newcastle" },
    ],
    approveMode: "proposals",
  },
  found: [
    {
      code: 3,
      name: "Woltemade",
      fullName: "Nick Woltemade",
      clubCode: 4,
      positions: [
        { position: "ST", source: "starts", confirmed: true },
        { position: "CAM", source: "label", confirmed: false },
      ],
    },
  ],
};
const openDashboard = (data: AdminData = DATA) => openApp(ADMIN_PATH, admin, { admin: data });

describe("reaching the dashboard", () => {
  it("the admin opens it from Your leagues", async () => {
    const app = openApp(LEAGUES_PATH, admin);
    await userEvent.click(await screen.findByRole("link", { name: ADMIN_TITLE }));
    expect(await screen.findByRole("heading", { level: 1, name: ADMIN_TITLE })).toBeTruthy();
    expect(app.path()).toBe(ADMIN_PATH);
  });

  it("anyone else isn't offered it, and is sent back to Your leagues if they go there", async () => {
    openApp(LEAGUES_PATH, commissioner);
    await screen.findByRole("heading", { level: 1, name: "Your leagues" });
    expect(screen.queryByRole("link", { name: ADMIN_TITLE })).toBeNull();

    cleanup();
    const app = openApp(ADMIN_PATH, commissioner);
    await screen.findByRole("heading", { level: 1, name: "Your leagues" });
    expect(app.path()).toBe(LEAGUES_PATH);
  });
});

describe("the queue", () => {
  it("#87 Done: a new signing shows his label and links to read up on him, and Confirm approves him", async () => {
    const app = openDashboard();
    const signings = await screen.findByRole("list", { name: "New signings" });
    expect(within(signings).getByText("Label: Centre Central Midfielder")).toBeTruthy();
    const links = within(signings).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Transfermarkt", "FotMob", "Understat"]);
    expect(links[0].getAttribute("href")).toContain(encodeURIComponent("site:transfermarkt.co.uk Jacob Steur"));

    await userEvent.click(within(signings).getByRole("button", { name: confirmLabel("Steur") }));
    expect(app.admin.approvePlayer).toHaveBeenCalledExactlyOnceWith(STEUR.code);
  });

  it("a man whose starts wait shows what they'd give him, and Approve approves him", async () => {
    const app = openDashboard();
    const waiting = await screen.findByRole("list", { name: "Starts waiting for you" });
    expect(within(waiting).getByText("From his starts: W")).toBeTruthy();
    await userEvent.click(within(waiting).getByRole("button", { name: approveLabel("Barnes") }));
    expect(app.admin.approvePlayer).toHaveBeenCalledExactlyOnceWith(BARNES.code);
  });

  it("says so when nothing waits", async () => {
    openDashboard({ queue: EMPTY_QUEUE });
    expect(await screen.findByText("No new signings wait for you.")).toBeTruthy();
    expect(screen.getByText("No starts wait for you.")).toBeTruthy();
  });
});

describe("settings", () => {
  it("approves the club chosen, whole", async () => {
    const app = openDashboard();
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Club" }), "Newcastle");
    await userEvent.click(screen.getByRole("button", { name: "Approve the club" }));
    expect(app.admin.approveClub).toHaveBeenCalledExactlyOnceWith(4);
  });

  it("switches how starts count, to the other way", async () => {
    const app = openDashboard();
    await userEvent.click(await screen.findByRole("button", { name: switchModeWords.countAtOnce }));
    expect(app.admin.setApproveMode).toHaveBeenCalledExactlyOnceWith("countAtOnce");
  });
});

describe("correcting a player", () => {
  const findWoltemade = async () => {
    await userEvent.type(await screen.findByRole("searchbox", { name: findLabel }), "Woltemade");
    return screen.getByRole("list", { name: foundListLabel });
  };

  it("shows each position, where it came from, and whether it's confirmed", async () => {
    openDashboard();
    const positions = within(await findWoltemade()).getByRole("list", { name: "Woltemade's positions" });
    expect(within(positions).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "ST from his startsRemove",
      "CAM from his label, unconfirmedRemove",
    ]);
  });

  it("removes a position, and sets one he hasn't got, SS among them", async () => {
    const app = openDashboard();
    const found = await findWoltemade();
    await userEvent.click(within(found).getByRole("button", { name: removeLabel("CAM", "Woltemade") }));
    expect(app.admin.removePosition).toHaveBeenCalledExactlyOnceWith(3, "CAM");

    const give = within(found).getByRole("combobox", { name: setLabel("Woltemade") });
    expect(within(give).queryByRole("option", { name: "ST" })).toBeNull();
    await userEvent.selectOptions(give, "SS");
    await userEvent.click(within(found).getByRole("button", { name: "Set" }));
    expect(app.admin.setPosition).toHaveBeenCalledExactlyOnceWith(3, "SS");
  });

  it("shows why a change was refused", async () => {
    const app = openDashboard();
    app.admin.approvePlayer.mockResolvedValueOnce("Only the admin can do that.");
    await userEvent.click(await screen.findByRole("button", { name: approveLabel("Barnes") }));
    expect((await screen.findByRole("alert")).textContent).toBe("Only the admin can do that.");
  });
});

describe("while the server answers", () => {
  it("says the queue is loading, to screen readers too", async () => {
    openDashboard({ loading: true });
    await screen.findByRole("heading", { level: 1, name: ADMIN_TITLE });
    expect(screen.getByRole("status").textContent).toBe(loadingWords);
  });

  it("says a search is under way, to screen readers too", async () => {
    openDashboard({ ...DATA, searching: true });
    await userEvent.type(await screen.findByRole("searchbox", { name: findLabel }), "Woltemade");
    expect(within(screen.getByRole("region", { name: findTitle })).getByRole("status").textContent).toBe(searchingWords);
  });
});
