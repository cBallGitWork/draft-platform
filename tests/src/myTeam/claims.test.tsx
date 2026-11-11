// My team's Transactions tab's waiver claims (#1200; docs/design/approved/waivers): the manager's
// pending claims by run, ranked in each, with a clash marked; a selected claim's panel to change its
// drop, move it or withdraw it; claims closed in a word; the commissioner's Every team view; and the
// whole waiver order and the runs beside them.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { DAY_MS } from "../../../convex/shared/time";
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
  freeAgentsNotOpenWords,
  freeAgentsWords,
  moveDownWords,
  moveUpWords,
  nextRunWords,
  runGroupWords,
  runWords,
  RUNS_TITLE,
  selectClaimLabel,
  WAIVER_ORDER_TITLE,
  skippedIfWords,
  withdrawWords,
} from "../../../src/myTeam/claims/words";
import type { TeamSquad } from "../../../src/myTeam/seam";
import { idOf } from "../../../src/table/drawnTable";
import { MY_TEAM_ID, NO_WAIVERS, type MyTeamData } from "../../support/src/myTeam.harness";
import { league, manager, managerIn, openApp } from "../../support/src/shell.harness";

const WED = Date.parse("2026-11-11T18:00:00Z");
const THU = WED + DAY_MS;
/** A run that is surely made, and one that is skipped if `gameweek` is still on at it. */
const made = (at: number) => ({ at, skippedIf: null });
const mayBeSkipped = (at: number, gameweek: number) => ({ at, skippedIf: gameweek });
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

  it("waits for a drag's order to save before taking another, as the Move buttons do (#1490)", async () => {
    const app = open();
    let saved: (answer: null) => void = () => undefined;
    app.myTeam.claimChanges.rank.mockImplementationOnce(() => new Promise((resolve) => (saved = resolve)));
    const handleOf = (name: string) => screen.findByRole("img", { name: dragHandleLabel(name) });
    const rowOf = (name: string) => screen.getByRole("button", { name: selectClaimLabel(name) }).closest("tr")!;
    fireEvent.dragStart(await handleOf("Eze"));
    fireEvent.drop(rowOf("Semenyo"));
    expect(app.myTeam.claimChanges.rank).toHaveBeenCalledTimes(1);

    expect((await handleOf("Semenyo")).getAttribute("draggable")).toBe("false");
    fireEvent.dragStart(await handleOf("Semenyo"));
    fireEvent.drop(rowOf("Eze"));
    expect(app.myTeam.claimChanges.rank).toHaveBeenCalledTimes(1);

    saved(null);
    await waitFor(async () => expect((await handleOf("Semenyo")).getAttribute("draggable")).toBe("true"));
    fireEvent.dragStart(await handleOf("Semenyo"));
    fireEvent.drop(rowOf("Eze"));
    expect(app.myTeam.claimChanges.rank).toHaveBeenCalledTimes(2);
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

  const runs = async (waivers: WaiversView) => {
    open({ waivers });
    return within(await screen.findByRole("region", { name: RUNS_TITLE })).getAllByRole("listitem").map((row) => row.textContent);
  };

  it("before the season, says free agency opens once it is, marking no run Next", async () => {
    expect(await runs({ ...NO_WAIVERS, drafted: false, windowOpen: true, runs: [made(WED)], windowShuts: { gameweek: 1, at: THU } })).toEqual([
      runWords(WED),
      `${freeAgentsWords}${freeAgentsNotOpenWords}`,
    ]);
  });

  it("mid-season, says the same rather than the next run's time", async () => {
    expect(await runs({ ...NO_WAIVERS, drafted: false, runs: [made(WED), mayBeSkipped(THU, 12)], windowShuts: { gameweek: 12, at: THU } })).toEqual([
      runWords(WED),
      runWords(THU),
      `${freeAgentsWords}${freeAgentsNotOpenWords}`,
    ]);
  });

  it("once it is, marks the first run Next and says when free agency opens", async () => {
    expect(await runs({ ...NO_WAIVERS, runs: [made(WED)], windowShuts: { gameweek: 12, at: THU } })).toEqual([
      `${runWords(WED)}${nextRunWords}`,
      `${freeAgentsWords}From Wed 18:00 to the GW12 deadline`,
    ]);
  });
});

describe("a midweek gameweek, its deadline before both runs (#1488)", () => {
  const runs = async (waivers: WaiversView) => {
    open({ waivers });
    return within(await screen.findByRole("region", { name: RUNS_TITLE })).getAllByRole("listitem").map((row) => row.textContent);
  };

  it("marks each run that may fall in its lock, none Next, and free agency from after its last match to the deadline after", async () => {
    expect(await runs({ ...NO_WAIVERS, runs: [mayBeSkipped(WED, 12), mayBeSkipped(THU, 12)], windowShuts: { gameweek: 13, at: THU + 2 * DAY_MS } })).toEqual([
      `${runWords(WED)}${skippedIfWords(12)}`,
      `${runWords(THU)}${skippedIfWords(12)}`,
      `${freeAgentsWords}From the first run after GW12's last match to the GW13 deadline`,
    ]);
    expect(skippedIfWords(12)).toBe("Skipped if GW12 is still on");
  });

  it("with free agency open until that deadline, still marks the runs after it", async () => {
    expect(await runs({ ...NO_WAIVERS, windowOpen: true, runs: [mayBeSkipped(WED, 12)], windowShuts: { gameweek: 12, at: WED - DAY_MS } })).toEqual([
      `${runWords(WED)}${skippedIfWords(12)}`,
      `${freeAgentsWords}Open to the GW12 deadline`,
    ]);
  });

  it("in the lock, names the gameweek under way", async () => {
    expect(await runs({ ...NO_WAIVERS, locked: true, resetsAfter: 12, runs: [mayBeSkipped(WED, 12)], windowShuts: { gameweek: 13, at: THU + 2 * DAY_MS } })).toEqual([
      `${runWords(WED)}${skippedIfWords(12)}`,
      `${freeAgentsWords}From the first run after GW12's last match to the GW13 deadline`,
    ]);
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
