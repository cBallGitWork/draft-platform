// The admin's dashboard (#87; spec/06 The admin oversees them): reached from Your leagues by the
// admin alone; the queue of new signings and starts waiting; approving a club; how starts count;
// and correcting any player's positions.

import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { LEAGUES_PATH, LEAGUES_TITLE } from "../../../src/leagues/paths";
import { admin, commissioner, openApp } from "../../support/src/shell.harness";
import type { AdminData } from "../../support/src/admin.harness";
import { EMPTY_QUEUE } from "../../support/src/admin.harness";
import { ADMIN_PATH } from "../../../src/admin/paths";
import {
  ADMIN_TITLE,
  approveLabel,
  confirmLabel,
  changesTitle,
  findLabel,
  findTitle,
  flagAfterLabel,
  foundListLabel,
  loadingWords,
  removeAfterLabel,
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
    flagged: [{ code: 3, name: "Woltemade", fullName: "Nick Woltemade", clubCode: 4, position: "ST", startsElsewhere: 4 }],
    removed: [{ code: 5, name: "Gordon", fullName: "Anthony Gordon", clubCode: 4, position: "W" }],
    clubs: [
      { code: 3, name: "Arsenal" },
      { code: 4, name: "Newcastle" },
    ],
    approveMode: "proposals",
    thresholds: { flagAfter: 3, removeAfter: 6 },
  },
  found: [
    {
      code: 3,
      name: "Woltemade",
      fullName: "Nick Woltemade",
      clubCode: 4,
      positions: [
        { position: "ST", source: "starts", confirmed: true, flaggedElsewhere: 4 },
        { position: "CAM", source: "label", confirmed: false, flaggedElsewhere: null },
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
    await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE });
    expect(screen.queryByRole("link", { name: ADMIN_TITLE })).toBeNull();

    cleanup();
    const app = openApp(ADMIN_PATH, commissioner);
    await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE });
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
    expect(screen.getByText("No position is flagged or removed.")).toBeTruthy();
  });
});

describe("position changes", () => {
  it("shows each position flagged, as needing him, with its starts in a row elsewhere, and each removed, muted", async () => {
    openDashboard();
    const changes = await screen.findByRole("region", { name: changesTitle });
    expect(within(changes).getByText(/flagged after 3 starts in a row somewhere else, and removed after 6/)).toBeTruthy();

    const flagged = within(changes).getByRole("list", { name: "Flagged" });
    expect(within(flagged).getByText("Nick Woltemade")).toBeTruthy();
    expect(within(flagged).getByText("ST: 4 starts in a row elsewhere").className).toContain("text-event");

    const removed = within(changes).getByRole("list", { name: "Removed" });
    expect(removed.textContent).toBe("Anthony GordonW removed");
    expect(removed.className).toContain("text-muted");
  });

  it("with only a removed position, doesn't say none changed", async () => {
    openDashboard({ queue: { ...EMPTY_QUEUE, removed: DATA.queue!.removed } });
    const changes = await screen.findByRole("region", { name: changesTitle });
    expect(within(changes).getByRole("list", { name: "Removed" })).toBeTruthy();
    expect(within(changes).queryByText("No position is flagged or removed.")).toBeNull();
  });
});

describe("settings", () => {
  it("approves the club chosen, whole", async () => {
    const app = openDashboard();
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Club" }), "Newcastle");
    await userEvent.click(screen.getByRole("button", { name: "Approve the club" }));
    expect(app.admin.approveClub).toHaveBeenCalledExactlyOnceWith(4);
  });

  it("shows the thresholds, and saves the ones typed", async () => {
    const app = openDashboard();
    const flagAfter = await screen.findByRole("spinbutton", { name: flagAfterLabel });
    const removeAfter = screen.getByRole("spinbutton", { name: removeAfterLabel });
    expect([flagAfter, removeAfter].map((input) => (input as HTMLInputElement).value)).toEqual(["3", "6"]);

    await userEvent.clear(flagAfter);
    await userEvent.type(flagAfter, "2");
    await userEvent.clear(removeAfter);
    await userEvent.type(removeAfter, "5");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(app.admin.setChangeThresholds).toHaveBeenCalledExactlyOnceWith({ flagAfter: 2, removeAfter: 5 });
  });

  it("shows why thresholds were refused", async () => {
    const app = openDashboard();
    const refusal = "Remove a position after a whole number of starts, more than it takes to flag it.";
    app.admin.setChangeThresholds.mockResolvedValueOnce(refusal);
    await userEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toBe(refusal);
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
      "ST from his starts, flagged: 4 starts in a row elsewhereRemove",
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
