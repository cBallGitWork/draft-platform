// My team's Transactions tab (#366; spec/12, My team's tabs; the team-transactions picture, #1031):
// reached from My team's tabs; the team's transactions newest first, as the server sends them, each
// with its kind, who came in and who went out, and who made it; the Show keys; and why there are
// none, or why some are left out.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MY_TEAM_PATH, MY_TEAM_TRANSACTIONS_PATH } from "../../../src/frame/menu";
import { sectionTabsLabel } from "../../../src/frame/words";
import type { TeamTransactions } from "../../../src/myTeam/seam";
import { playerCardPath } from "../../../src/playerCard/paths";
import {
  dateWords,
  historyShows,
  historyShowWords,
  noneShownWords,
  noTeamWords,
  noTransactionsWords,
  transactionColumns,
  transactionsCutWords,
  transactionsLoadingWords,
  transactionsTableLabel,
  TRANSACTIONS_TITLE,
  withTeamWords,
} from "../../../src/myTeam/words";
import type { Id } from "../../../convex/_generated/dataModel";
import { claimsLoadingWords, waiverOrderLoadingWords } from "../../../src/myTeam/claims/words";
import { expectColumnHeads } from "../../support/src/columnHeads";
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
type PlayerTransaction = Exclude<Transaction, { kind: "traded" }>;
const transaction = (kind: PlayerTransaction["kind"], otherTeamName: string | null = null): PlayerTransaction => ({
  at: AT,
  kind,
  playerCode: SAKA,
  playerName: "Saka",
  otherTeamName,
  dropped: null,
  by: "commish@example.com",
  yours: false,
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
    const statuses = (await screen.findAllByRole("status")).map((status) => status.textContent);
    expect(statuses).toEqual([claimsLoadingWords, transactionsLoadingWords, waiverOrderLoadingWords]);
  });

  it("tells someone running no team in the league there's nothing to show, and reads nothing", async () => {
    const app = openTransactions({}, commissioner);
    expect(await screen.findByText(noTeamWords)).toBeTruthy();
    expect(app.myTeam.useTeamTransactions).not.toHaveBeenCalled();
  });
});

describe("the transactions", () => {
  it("lists each kind in the server's order: the date, its kind, who came in, who went out, and who made it (#1031)", async () => {
    const claimed: Transaction = { ...transaction("claimed"), dropped: { playerCode: 1002, playerName: "Rice" }, yours: true };
    const kinds = [transaction("released"), transaction("movedIn", "Team 2"), transaction("movedOut", "Team 3"), transaction("assigned"), claimed, transaction("pickedUp"), transaction("dropped")];
    openTransactions({ transactions: { transactions: kinds, cut: false } });
    await screen.findByRole("table");

    expect(rows().map(cells)).toEqual([
      [dateWords(AT), "Assigned", "", "Saka", "commish@example.com, to free agency"],
      [dateWords(AT), "Assigned", "Saka", "", "commish@example.com, from Team 2"],
      [dateWords(AT), "Assigned", "", "Saka", "commish@example.com, to Team 3"],
      [dateWords(AT), "Assigned", "Saka", "", "commish@example.com"],
      [dateWords(AT), "Claim", "Saka", "Rice", "You"],
      [dateWords(AT), "Free agent", "Saka", "", "commish@example.com"],
      [dateWords(AT), "Drop", "", "Saka", "commish@example.com"],
    ]);
  });

  it("shows a trade as one row: each player or pick in under In, each out under Out, one line each, and the other team in By (#1491)", async () => {
    const trade: Transaction = {
      at: AT,
      kind: "traded",
      in: { players: [{ playerCode: SAKA, playerName: "Saka" }], picks: [] },
      out: { players: [{ playerCode: 1002, playerName: "Rice" }], picks: [{ round: 4, teamId: "team-1" as Id<"teams">, teamName: "Pickford Pirates" }] },
      otherTeamName: "Hull Hearts",
      by: "bob@example.com",
      yours: false,
    };
    const app = openTransactions({ transactions: { transactions: [trade], cut: false } });
    await screen.findByRole("table");

    const [row] = rows();
    expect(cells(row)).toEqual([dateWords(AT), "Trade", "Saka", "RicePickford Pirates' round 4 pick", withTeamWords("Hull Hearts")]);
    expect(Array.from(row.cells[3].children, (line) => line.textContent)).toEqual(["Rice", "Pickford Pirates' round 4 pick"]);
    expect(screen.queryByRole("link", { name: "Pickford Pirates' round 4 pick" })).toBeNull();
    await userEvent.click(screen.getByRole("link", { name: "Rice" }));
    expect(app.path()).toBe(playerCardPath(league.leagueId, 1002));
  });

  it("shows one kind at a time from the Show keys, saying when it holds none of it (#1031)", async () => {
    openTransactions({ transactions: { transactions: [transaction("dropped"), transaction("released"), transaction("assigned")], cut: false } });
    await screen.findByRole("table");
    expect(screen.getAllByRole("radio").map((key) => key.closest("label")?.textContent)).toEqual(historyShows.map((show) => historyShowWords[show]));

    await userEvent.click(screen.getByRole("radio", { name: historyShowWords.assigned }));
    expect(rows().map((row) => row.cells[1].textContent)).toEqual(["Assigned", "Assigned"]);
    await userEvent.click(screen.getByRole("radio", { name: historyShowWords.trades }));
    expect(screen.getByText(noneShownWords)).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: historyShowWords.all }));
    expect(rows()).toHaveLength(3);
  });

  it("heads each column with its short word, named by its long one", async () => {
    openTransactions({ transactions: { transactions: [transaction("assigned")], cut: false } });
    expectColumnHeads(await screen.findByRole("table"), Object.values(transactionColumns));
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
