// Scouting's selected player (the approved picture, #1028): a row opens his panel at the top of the
// right column, with his season points and minutes, the player card's pickup or claim and
// shortlist actions, and his card; a shortlisted player is starred in the list.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NO_FIGURES } from "../../../convex/scouting/playersOrder";
import type { Stats } from "../../../convex/stats/statTotals";
import { pickUpWords } from "../../../src/playerCard/words";
import { playerCardPath } from "../../../src/playerCard/paths";
import {
  closePanelLabel,
  freeAgentWords,
  noFigureWords,
  noPointsYetWords,
  notRankedWords,
  panelMinutesWords,
  panelSeasonPointsWords,
  PER90_STAT_NAMES,
  per90Words,
  percentileLabel,
  periodLabel,
  periodWords,
  playerCardLinkWords,
  scoutingTabWords,
  selectPlayerLabel,
  shortlistedLabel,
  statLabel,
  versusWords,
  yourClaimWords,
} from "../../../src/scouting/words";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ListedPlayer } from "../../../convex/scouting/playersList";
import { MY_TEAM_TRANSACTIONS_PATH } from "../../../src/frame/menu";
import type { PendingClaim } from "../../../src/myTeam/claims/seam";
import { addToShortlistWords } from "../../../src/scouting/shortlist/words";
import { fakeScouting } from "../../support/src/scouting.harness";
import { HELD, lastAsk, openOnAll, openScouting, PALMER, RICE, rowOf, SAKA } from "../../support/src/scoutingScreen.harness";
import { shortlisted } from "../../support/src/shortlist.harness";
import { league } from "../../support/src/shell.harness";

/** Rice has played 540 minutes and has 42 points. */
const WITH_FIGURES = { ...HELD, players: HELD.players!.map((player) => (player.code === RICE.code ? { ...player, seasonPoints: 42, figures: { ...NO_FIGURES, minutes: 540 } } : player)) };
const panelOf = (name: string) => screen.getByRole("region", { name: new RegExp(`^${name}`) });
const factIn = (panel: HTMLElement, label: string) => within(panel).getByText(label).nextElementSibling!;

describe("selecting a player", () => {
  it("a row opens his panel: his season points and minutes, and the row is marked", async () => {
    openScouting(WITH_FIGURES);
    await userEvent.click(await screen.findByRole("button", { name: selectPlayerLabel("Rice") }));
    const panel = panelOf("CDM");
    expect(within(panel).getByText("Rice")).toBeTruthy();
    expect(factIn(panel, panelSeasonPointsWords).textContent).toBe("42");
    expect(factIn(panel, panelMinutesWords("season")).textContent).toBe("540");
    expect(rowOf("Rice").getAttribute("aria-current")).toBe("true");
  });

  it("a player with no points yet reads '—', saying why", async () => {
    await openOnAll();
    await userEvent.click(rowOf("Palmer"));
    const points = factIn(panelOf("CAM"), panelSeasonPointsWords);
    expect(points.textContent).toBe(noFigureWords);
    expect(points.getAttribute("title")).toBe(noPointsYetWords);
  });

  it("offers the player card's pickup and shortlist, and asks the server for each", async () => {
    const app = openScouting({ ...WITH_FIGURES, actions: new Map([[RICE.code, { kind: "pickUp", squad: [] }]]) });
    await userEvent.click(await screen.findByRole("button", { name: selectPlayerLabel("Rice") }));
    const panel = panelOf("CDM");
    await userEvent.click(within(panel).getByRole("button", { name: pickUpWords }));
    expect(app.scouting.waiverChanges.pickUp).toHaveBeenCalledWith(league.leagueId, RICE.code, null);
    await userEvent.click(within(panel).getByRole("button", { name: addToShortlistWords }));
    expect(app.scouting.shortlistChanges.add).toHaveBeenCalledWith(league.leagueId, RICE.code);
  });

  it("links to his card, and ✕ closes the panel", async () => {
    const app = openScouting();
    await userEvent.click(await screen.findByRole("button", { name: selectPlayerLabel("Rice") }));
    const card = within(panelOf("CDM")).getByRole("link", { name: playerCardLinkWords });
    expect(card.getAttribute("href")).toBe(playerCardPath(league.leagueId, RICE.code));

    await userEvent.click(within(panelOf("CDM")).getByRole("button", { name: closePanelLabel }));
    expect(screen.queryByRole("region", { name: /^CDM/ })).toBeNull();
    expect(app.path()).not.toBe(playerCardPath(league.leagueId, RICE.code));
  });

  it("a pickup that takes him out of the free agents still shows on his panel, with the period's minutes (#1551)", async () => {
    const app = openScouting(WITH_FIGURES);
    await userEvent.click(await screen.findByRole("button", { name: selectPlayerLabel("Rice") }));
    expect(lastAsk(app)[5]).toBe(RICE.code);
    expect(within(panelOf("CDM")).getByText(freeAgentWords)).toBeTruthy();

    // The server now has Rice on Saka Potatoes, with 90 minutes over the last 4: the free agents list drops him.
    const pickedUp = WITH_FIGURES.players!.map((player) => (player.code === RICE.code ? { ...player, ownerTeamName: "Saka Potatoes", figures: { ...NO_FIGURES, minutes: 90 } } : player));
    app.scouting.usePlayersList.mockImplementation(fakeScouting({ ...WITH_FIGURES, players: pickedUp }).usePlayersList);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: periodLabel }), periodWords.last4);
    expect(screen.queryByRole("button", { name: selectPlayerLabel("Rice") })).toBeNull();
    const panel = panelOf("CDM");
    expect(within(panel).getByText("Saka Potatoes")).toBeTruthy();
    expect(within(panel).queryByText(freeAgentWords)).toBeNull();
    expect(factIn(panel, panelMinutesWords("last4")).textContent).toBe("90");
  });

  it("after one who has left, the next selected shows while his list loads", async () => {
    const app = await openOnAll(WITH_FIGURES);
    await userEvent.click(await screen.findByRole("button", { name: selectPlayerLabel("Rice") }));
    // Rice leaves the Premier League: the server keeps nobody and the list drops him.
    const gone = fakeScouting({ ...WITH_FIGURES, players: WITH_FIGURES.players!.filter(({ code }) => code !== RICE.code) }).usePlayersList;
    app.scouting.usePlayersList.mockImplementation(gone);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: periodLabel }), periodWords.last4);
    expect(screen.queryByRole("region", { name: /^CDM/ })).toBeNull();

    // Saka's list is still loading, so the last one, kept null for Rice, stays up.
    app.scouting.usePlayersList.mockImplementation((...args) => (args[5] === SAKA.code ? undefined : gone(...args)));
    await userEvent.click(screen.getByRole("button", { name: selectPlayerLabel("Saka") }));
    expect(panelOf("W")).toBeTruthy();
  });

  it("his name in the list opens his card, not his panel", async () => {
    const app = openScouting();
    await screen.findByRole("table");
    await userEvent.click(within(rowOf("Rice")).getByRole("link", { name: "Rice" }));
    expect(app.path()).toBe(playerCardPath(league.leagueId, RICE.code));
  });
});

describe("his figures per 90", () => {
  // Palmer (CAM) and Saka (W) are both attacking mids with 900 minutes; Palmer has scored twice as often.
  const TOTALS: Record<number, Stats> = {
    [PALMER.code]: { minutes: 900, goals_scored: 10, total_att_assist: 9 },
    [SAKA.code]: { minutes: 900, goals_scored: 5, total_att_assist: 18 },
    [RICE.code]: { minutes: 180, goals_scored: 1 },
  };
  const rowIn = (panel: HTMLElement, name: string) => within(panel).getByRole("rowheader", { name }).closest("tr")!;

  it("lists his area's stats per 90 with a bar as long as his percentile against the area's players, hover giving it", async () => {
    await openOnAll({ ...HELD, totals: TOTALS });
    await userEvent.click(rowOf("Palmer"));
    const panel = panelOf("CAM");
    expect(within(panel).getByText(per90Words("season"))).toBeTruthy();
    expect(within(panel).getByText(versusWords("attackingMidfield"))).toBeTruthy();
    const goals = rowIn(panel, PER90_STAT_NAMES.goals_scored);
    expect(within(goals).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["1", "", "100"]);
    const bar = within(goals).getByRole("img", { name: percentileLabel(100, "attackingMidfield") });
    expect(bar.getAttribute("title")).toBe(percentileLabel(100, "attackingMidfield"));
    expect(within(rowIn(panel, PER90_STAT_NAMES.total_att_assist)).getAllByRole("cell").at(-1)!.textContent).toBe("50");
  });

  it("under 270 minutes he has figures but no bar, saying why", async () => {
    await openOnAll({ ...HELD, totals: TOTALS });
    await userEvent.click(rowOf("Rice"));
    const panel = panelOf("CDM");
    expect(within(panel).getByText(notRankedWords)).toBeTruthy();
    expect(within(rowIn(panel, PER90_STAT_NAMES.goals_scored)).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["0.5", "", noFigureWords]);
    expect(within(panel).queryByRole("img", { name: /percentile/ })).toBeNull();
  });

  it("asks for the list's stat to join them", async () => {
    const app = await openOnAll({ ...HELD, totals: TOTALS });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: statLabel }), "Saves");
    await userEvent.click(rowOf("Palmer"));
    expect(app.scouting.usePer90.mock.lastCall).toEqual([league.leagueId, PALMER.code, "saves", "season"]);
    expect(within(panelOf("CAM")).getByRole("rowheader", { name: PER90_STAT_NAMES.saves })).toBeTruthy();
  });
});

describe("a pending claim on him", () => {
  const WED = Date.parse("2026-11-11T18:00:00Z");
  const THU = WED + 24 * 60 * 60 * 1000;
  const claimOn = (id: string, { code, name, positions, club }: ListedPlayer, at: number, yours = true): PendingClaim => ({
    claimId: id as Id<"waiverClaims">,
    teamId: id as unknown as Id<"teams">,
    teamName: yours ? "Kroos Control" : "Saka Potatoes",
    yours,
    claim: { playerCode: code, playerName: name, positions, club, seasonPoints: null },
    drop: null,
    run: { at, skippedIf: null },
  });

  it("says where it stands in its run, linking to My team's Transactions; another team's claim says nothing", async () => {
    const claims = [claimOn("c1", SAKA, THU), claimOn("c2", PALMER, WED), claimOn("c3", RICE, WED), claimOn("c4", SAKA, WED, false)];
    const app = await openOnAll({ ...HELD, claims });
    await userEvent.click(rowOf("Rice"));
    expect(within(panelOf("CDM")).getByRole("link", { name: yourClaimWords(2, { at: WED, skippedIf: null }) })).toBeTruthy();
    expect(yourClaimWords(2, { at: WED, skippedIf: null })).toBe("Your claim 2, Wed run");
    expect(yourClaimWords(2, { at: WED, skippedIf: 12 })).toBe("Your claim 2, run after GW12's last match");
    await userEvent.click(rowOf("Saka"));
    await userEvent.click(within(panelOf("W")).getByRole("link", { name: yourClaimWords(1, { at: THU, skippedIf: null }) }));
    expect(app.path()).toBe(MY_TEAM_TRANSACTIONS_PATH);
  });

  it("with no claim of his on him, the panel says nothing of claims", async () => {
    await openOnAll({ ...HELD, claims: [claimOn("c1", PALMER, WED, false)] });
    await userEvent.click(rowOf("Palmer"));
    expect(within(panelOf("CAM")).queryByRole("link", { name: /^Your claim/ })).toBeNull();
  });
});

describe("the shortlist in the list", () => {
  it("a shortlisted player is starred after his name, and in his panel", async () => {
    await openOnAll({ ...HELD, shortlist: { players: [shortlisted(PALMER.code, "Palmer")] } });
    expect(within(rowOf("Palmer")).getByRole("img", { name: shortlistedLabel })).toBeTruthy();
    expect(within(rowOf("Rice")).queryByRole("img", { name: shortlistedLabel })).toBeNull();
    await userEvent.click(rowOf("Palmer"));
    expect(within(panelOf("CAM")).getByRole("img", { name: shortlistedLabel })).toBeTruthy();
  });
});

describe("the tabs", () => {
  it("the title plate carries Players, chosen, and Stat race, which shows the plate alone for now", async () => {
    openScouting();
    await screen.findByRole("table");
    const players = screen.getByRole("button", { name: scoutingTabWords.players });
    expect(players.getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: scoutingTabWords.statRace }));
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Scouting");
  });
});
