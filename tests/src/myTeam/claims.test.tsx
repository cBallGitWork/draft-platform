// My team's Transactions tab's waiver claims (#1200; docs/design/approved/waivers): the manager's
// pending claims by run, ranked in each, with a clash marked; a selected claim's panel to change its
// drop, move it or withdraw it; claims closed in a word; the commissioner's Every team view; and the
// whole waiver order and the runs beside them.

import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { MY_TEAM_TRANSACTIONS_PATH } from "../../../src/frame/menu";
import { pendingClaimsTabLabel, sectionTabsLabel } from "../../../src/frame/words";
import { TRANSACTIONS_TITLE } from "../../../src/myTeam/words";
import type { PendingClaim, WaiversView } from "../../../src/myTeam/claims/seam";
import {
  claimPanelTitle,
  claimsClosedWords,
  claimsNotOpenWords,
  claimsTableLabel,
  claimsViewWords,
  clashWords,
  dragHandleLabel,
  everyTeamTableLabel,
  failsIfWords,
  moveDownWords,
  moveUpWords,
  runGroupWords,
  selectClaimLabel,
  WAIVER_ORDER_TITLE,
  withdrawWords,
} from "../../../src/myTeam/claims/words";
import type { TeamSquad } from "../../../src/myTeam/seam";
import { idOf } from "../../../src/table/drawnTable";
import { MY_TEAM_ID, NO_WAIVERS, type MyTeamData } from "../../support/src/myTeam.harness";
import { league, manager, managerIn, openApp } from "../../support/src/shell.harness";

const WED = Date.parse("2026-11-11T18:00:00Z");
const THU = WED + 24 * 60 * 60 * 1000;
const club = { code: 1, name: "Arsenal", shortName: "ARS" };
const player = (playerCode: number, playerName: string) => ({ playerCode, playerName, positions: ["W" as const], club, seasonPoints: 20 });
const [SEMENYO, EZE, KUDUS, CALVERT_LEWIN, MBEUMO] = [player(1, "Semenyo"), player(2, "Eze"), player(3, "Kudus"), player(4, "Calvert-Lewin"), player(5, "Mbeumo")];

const claim = (id: string, claimed: PendingClaim["claim"], drop: PendingClaim["drop"], runAt: number, team = "Team 1"): PendingClaim => ({
  claimId: id as Id<"waiverClaims">,
  teamId: team === "Team 1" ? MY_TEAM_ID : idOf(team),
  teamName: team,
  yours: team === "Team 1",
  claim: claimed,
  drop,
  runAt,
});
const CLAIMS = [claim("c1", SEMENYO, CALVERT_LEWIN, WED), claim("c2", EZE, CALVERT_LEWIN, WED), claim("c3", KUDUS, MBEUMO, THU)];
const squad = { teamName: "Team 1", lastGameweek: null, players: [{ code: 4, name: "Calvert-Lewin" }, { code: 5, name: "Mbeumo" }], unheld: [], squadMaximum: null, scheduleGameweeks: [], limits: [] } as unknown as TeamSquad;

const open = (data: MyTeamData = {}, session = manager) => openApp(MY_TEAM_TRANSACTIONS_PATH, session, { myTeam: { claims: CLAIMS, squad, ...data } });
const claimRows = async (label = claimsTableLabel) =>
  within(await screen.findByRole("table", { name: label }))
    .getAllByRole<HTMLTableRowElement>("row")
    .slice(1)
    .map((row) => row.textContent);

describe("the pending claims", () => {
  it("groups them by run, soonest first, ranked within each, an earlier claim's drop marked", async () => {
    open();

    expect(await claimRows()).toEqual([
      `${runGroupWords(WED)} 2 claims`,
      "⋮⋮1WSemenyoARS20WCalvert-LewinARS",
      `⋮⋮2WEzeARS20WCalvert-LewinARS${failsIfWords(1)}`,
      `${runGroupWords(THU)} 1 claim`,
      "⋮⋮1WKudusARS20WMbeumoARS",
    ]);
  });

  it("opens a claim's panel, which changes its drop, keeping its rank, moves it within its run and withdraws it", async () => {
    const app = open();
    await userEvent.click(await screen.findByRole("button", { name: selectClaimLabel("Eze") }));
    const panel = screen.getByRole("region", { name: claimPanelTitle(WED, 2, "Eze") });

    expect(within(panel).getByText(clashWords(1, "Calvert-Lewin"))).toBeTruthy();
    expect((within(panel).getByRole("button", { name: moveDownWords }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.selectOptions(within(panel).getByRole("combobox"), "Mbeumo");
    expect(app.myTeam.claimChanges.changeDrop).toHaveBeenCalledWith(league.leagueId, "c2", 5);
    await userEvent.click(within(panel).getByRole("button", { name: moveUpWords }));
    expect(app.myTeam.claimChanges.rank).toHaveBeenCalledWith(league.leagueId, ["c2", "c1", "c3"]);
    await userEvent.click(within(panel).getByRole("button", { name: withdrawWords }));
    expect(app.myTeam.claimChanges.withdraw).toHaveBeenCalledWith(league.leagueId, "c2");
  });

  it("says why a change was refused", async () => {
    open({ claimAnswer: "Claims can't be put in now." });
    await userEvent.click(await screen.findByRole("button", { name: selectClaimLabel("Semenyo") }));
    await userEvent.click(screen.getByRole("button", { name: withdrawWords }));
    expect((await screen.findByRole("alert")).textContent).toBe("Claims can't be put in now.");
  });

  it("reorders a claim dragged by its handle onto another in its run, never into another run", async () => {
    const app = open();
    const handle = await screen.findByRole("img", { name: dragHandleLabel("Eze") });
    const rowOf = (name: string) => screen.getByRole("button", { name: selectClaimLabel(name) }).closest("tr")!;
    fireEvent.dragStart(handle);
    fireEvent.drop(rowOf("Kudus"));
    expect(app.myTeam.claimChanges.rank).not.toHaveBeenCalled();
    fireEvent.dragStart(handle);
    fireEvent.drop(rowOf("Semenyo"));
    expect(app.myTeam.claimChanges.rank).toHaveBeenCalledWith(league.leagueId, ["c2", "c1", "c3"]);
  });

  it("while claims are closed, says so in a word, with no handles or buttons", async () => {
    open({ waivers: { ...NO_WAIVERS, locked: true } });
    expect(await screen.findByText(claimsClosedWords)).toBeTruthy();
    expect(screen.queryByRole("img", { name: dragHandleLabel("Eze") })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: selectClaimLabel("Eze") }));
    expect(screen.queryByRole("button", { name: withdrawWords })).toBeNull();
  });
});

describe("before the league's draft is over (S08.1)", () => {
  it("says claims open once it is, with no handles or buttons", async () => {
    open({ waivers: { ...NO_WAIVERS, drafted: false } });
    expect(await screen.findByText(claimsNotOpenWords)).toBeTruthy();
    expect(screen.queryByRole("img", { name: dragHandleLabel("Eze") })).toBeNull();
  });
});

describe("the Transactions tab's count (Craig, 8 Nov 2026: \"Yes 1 and 2\")", () => {
  const transactionsTab = () => within(screen.getByRole("navigation", { name: sectionTabsLabel })).getByRole("link", { name: new RegExp(`^${TRANSACTIONS_TITLE}`) });

  it("carries the manager's pending claims while there are any", async () => {
    openApp(MY_TEAM_TRANSACTIONS_PATH, manager, { myTeam: { claims: CLAIMS, squad }, topBar: { unreadMail: 0, next: null, pendingClaims: 3 } });
    await screen.findByRole("table", { name: claimsTableLabel });

    expect(transactionsTab().textContent).toBe(`${TRANSACTIONS_TITLE}3`);
    expect(transactionsTab().getAttribute("aria-label")).toBe(pendingClaimsTabLabel(TRANSACTIONS_TITLE, 3));
  });

  it("carries none without any", async () => {
    open();
    await screen.findByRole("table", { name: claimsTableLabel });
    expect(transactionsTab().textContent).toBe(TRANSACTIONS_TITLE);
  });
});

describe("for the commissioner", () => {
  const runner = managerIn({ ...league, roles: ["commissioner", "manager"], powers: { names: true, runs: true } });
  const theirs = claim("c9", EZE, null, WED, "Team 2");
  const waivers: WaiversView = {
    ...NO_WAIVERS,
    teams: [
      { teamId: idOf("Team 2"), name: "Team 2", yours: false, tablePlace: 2, points: 3 },
      { teamId: MY_TEAM_ID, name: "Team 1", yours: true, tablePlace: 1, points: 6 },
    ],
  };

  it("switches to every team's claims, read-only, team by team in the waiver order", async () => {
    open({ claims: [...CLAIMS, theirs], waivers }, runner);
    await userEvent.click(await screen.findByRole("radio", { name: claimsViewWords.everyTeam }));
    const rows = await claimRows(everyTeamTableLabel);

    expect(rows[0]).toBe("Team 2 1st in the waiver order, 1 claim");
    expect(rows[2]).toBe("Team 1 2nd in the waiver order, 3 claims");
    expect(screen.queryByRole("img", { name: dragHandleLabel("Eze") })).toBeNull();
  });
});

describe("the waiver order", () => {
  it("lists every team with its table place and points, the manager's own marked", async () => {
    open({
      waivers: {
        ...NO_WAIVERS,
        teams: [
          { teamId: idOf("Team 2"), name: "Team 2", yours: false, tablePlace: 2, points: 3 },
          { teamId: MY_TEAM_ID, name: "Team 1", yours: true, tablePlace: 1, points: 6 },
        ],
      },
    });
    const order = within(await screen.findByRole("region", { name: WAIVER_ORDER_TITLE })).getAllByRole("listitem");

    expect(order.map((team) => team.textContent)).toEqual(["1Team 22nd in the table, 3 pts", "2Team 11st in the table, 6 pts"]);
    expect(order[1].getAttribute("aria-current")).toBe("true");
  });
});
