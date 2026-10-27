// My team's Transactions tab (#366; spec/12, My team's tabs): reached from My team's tabs; the
// team's transactions newest first, as the server sends them, each saying what it did to the team
// and who did it; and why there are none, or why some are left out.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MY_TEAM_PATH, MY_TEAM_TRANSACTIONS_PATH } from "../../../src/frame/menu";
import { sectionTabsLabel } from "../../../src/frame/words";
import type { TeamTransactions } from "../../../src/myTeam/seam";
import { playerCardPath } from "../../../src/playerCard/paths";
import {
  noTeamWords,
  noTransactionsWords,
  transactionsCutWords,
  transactionsLoadingWords,
  transactionsTableLabel,
  TRANSACTIONS_TITLE,
  whenWords,
} from "../../../src/myTeam/words";
import type { MyTeamData } from "../../support/src/myTeam.harness";
import { commissioner, league, manager, openApp } from "../../support/src/shell.harness";

type Transaction = TeamTransactions["transactions"][number];

const openTransactions = (myTeam: MyTeamData = {}, session = manager) => openApp(MY_TEAM_TRANSACTIONS_PATH, session, { myTeam });
const rows = () =>
  within(screen.getByRole("table", { name: transactionsTableLabel("Team 1") }))
    .getAllByRole<HTMLTableRowElement>("row")
    .slice(1);
const cells = (row: HTMLTableRowElement) => Array.from(row.cells, (cell) => cell.textContent);

const AT = Date.parse("2026-10-20T18:00:00Z");
const SAKA = 1001;
const transaction = (kind: Transaction["kind"], otherTeamName: string | null = null): Transaction => ({
  at: AT,
  kind,
  playerCode: SAKA,
  playerName: "Saka",
  otherTeamName,
  by: "commish@example.com",
});

describe("reaching it", () => {
  it("a manager opens it from My team's Transactions tab, for the league the app is in", async () => {
    const app = openApp(MY_TEAM_PATH, manager);
    await userEvent.click(within(await screen.findByRole("navigation", { name: sectionTabsLabel })).getByRole("link", { name: TRANSACTIONS_TITLE }));

    expect(await screen.findByRole("heading", { level: 1, name: TRANSACTIONS_TITLE })).toBeTruthy();
    expect(app.path()).toBe(MY_TEAM_TRANSACTIONS_PATH);
    expect(app.myTeam.useTeamTransactions).toHaveBeenCalledWith(league.leagueId);
  });

  it("says so while it loads", async () => {
    openTransactions({ loading: true });
    expect((await screen.findByRole("status")).textContent).toBe(transactionsLoadingWords);
  });

  it("tells someone running no team in the league there's nothing to show, and reads nothing", async () => {
    const app = openTransactions({}, commissioner);
    expect(await screen.findByText(noTeamWords)).toBeTruthy();
    expect(app.myTeam.useTeamTransactions).not.toHaveBeenCalled();
  });
});

describe("the transactions", () => {
  it("lists each kind in the server's order: when, the player, what it did to the team, and who did it", async () => {
    const kinds = [transaction("released"), transaction("movedIn", "Team 2"), transaction("movedOut", "Team 3"), transaction("assigned")];
    openTransactions({ transactions: { transactions: kinds, cut: false } });
    await screen.findByRole("table");

    expect(rows().map(cells)).toEqual([
      [whenWords(AT), "Saka", "Released to free agency", "commish@example.com"],
      [whenWords(AT), "Saka", "Moved in from Team 2", "commish@example.com"],
      [whenWords(AT), "Saka", "Moved out to Team 3", "commish@example.com"],
      [whenWords(AT), "Saka", "Assigned to the team", "commish@example.com"],
    ]);
  });

  it("opens a player's card from his name", async () => {
    const app = openTransactions({ transactions: { transactions: [transaction("assigned")], cut: false } });
    await userEvent.click(await screen.findByRole("link", { name: "Saka" }));
    expect(app.path()).toBe(playerCardPath(league.leagueId, SAKA));
  });

  it("says when none are held yet", async () => {
    openTransactions();
    expect(await screen.findByText(noTransactionsWords)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText(transactionsCutWords)).toBeNull();
  });

  it("says when older ones were left out", async () => {
    openTransactions({ transactions: { transactions: [transaction("assigned")], cut: true } });
    expect(await screen.findByText(transactionsCutWords)).toBeTruthy();
    expect(rows()).toHaveLength(1);
  });
});
