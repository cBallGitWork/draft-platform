// The shortlist on screen (#374, spec/19 The shortlist; spec/12 The player card): the manager's own
// list on Scouting, each player opening his card and taken off with a button; the card adds him or
// takes him off. Someone who runs no team has none, so neither screen shows it.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SCOUTING_PATH } from "../../../src/frame/menu";
import { playerCardPath } from "../../../src/playerCard/paths";
import type { PlayerCard } from "../../../src/playerCard/seam";
import {
  addToShortlistWords,
  emptyShortlistWords,
  freeAgentWords,
  goneWords,
  loadingShortlistWords,
  onShortlistWords,
  removeFromShortlistWords,
  removeNamedLabel,
  SHORTLIST_TITLE,
  shortlistListLabel,
} from "../../../src/scouting/shortlistWords";
import type { ShortlistData } from "../../support/src/shortlist.harness";
import { shortlisted } from "../../support/src/shortlist.harness";
import { commissioner, league, manager, openApp } from "../../support/src/shell.harness";

const SAKA = shortlisted(1001, "Saka", "Saka Potatoes");
const RICE = shortlisted(1002, "Rice");
const REFUSAL = "A shortlist holds at most 100 players. Take one off first.";

const openScouting = (shortlist: ShortlistData, session = manager) => openApp(SCOUTING_PATH, session, { scouting: { shortlist } });
const shortlistPanel = () => screen.findByRole("region", { name: SHORTLIST_TITLE });

describe("on Scouting", () => {
  it("lists the manager's own shortlist: each player opening his card, his club, and who owns him", async () => {
    const app = openScouting({ players: [RICE, SAKA] });
    const list = within(await shortlistPanel()).getByRole("list", { name: shortlistListLabel });
    const rows = within(list).getAllByRole("listitem");

    expect(rows.map((row) => within(row).getByRole("link").textContent)).toEqual(["Rice", "Saka"]);
    expect(rows[0].textContent).toContain(freeAgentWords);
    expect(rows[1].textContent).toContain("Saka Potatoes");
    expect(rows[1].textContent).toContain("ARS");
    expect(app.scouting.useShortlist.mock.lastCall).toEqual([league.leagueId]);

    await userEvent.click(within(rows[1]).getByRole("link", { name: "Saka" }));
    expect(app.path()).toBe(playerCardPath(league.leagueId, SAKA.code));
  });

  it("says a player who has left the Premier League has", async () => {
    openScouting({ players: [{ ...SAKA, gone: true }] });
    expect(within(await shortlistPanel()).getByText(goneWords)).toBeTruthy();
  });

  it("Take off takes him off, asking for this league", async () => {
    const app = openScouting({ players: [RICE, SAKA] });
    await userEvent.click(within(await shortlistPanel()).getByRole("button", { name: removeNamedLabel("Saka") }));
    expect(app.scouting.shortlistChanges.remove).toHaveBeenCalledWith(league.leagueId, SAKA.code);
  });

  it("says the server's refusal", async () => {
    openScouting({ players: [SAKA], refusal: REFUSAL });
    await userEvent.click(within(await shortlistPanel()).getByRole("button", { name: removeNamedLabel("Saka") }));
    expect((await screen.findByRole("alert")).textContent).toBe(REFUSAL);
  });

  it("says when it is empty, and how to add one", async () => {
    openScouting({ players: [] });
    expect(within(await shortlistPanel()).getByText(emptyShortlistWords)).toBeTruthy();
  });

  it("says so while it loads", async () => {
    openScouting({ loading: true });
    expect(within(await shortlistPanel()).getByRole("status").textContent).toBe(loadingShortlistWords);
  });

  it("isn't there for a commissioner running no team, who has none", async () => {
    openScouting({ players: null }, commissioner);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("region", { name: SHORTLIST_TITLE })).toBeNull();
  });
});

const card = (code: number, name: string, gone = false): PlayerCard => ({
  code,
  name,
  fullName: name,
  club: { code: 3, name: "Arsenal", shortName: "ARS" },
  gone,
  positions: ["W"],
  ownerTeamName: null,
  news: null,
  chanceOfPlaying: null,
  matches: [],
  nextFixtures: [],
});

const openCard = (cardShown: PlayerCard, shortlist: ShortlistData, session = manager) =>
  openApp(playerCardPath(league.leagueId, cardShown.code), session, { playerCard: { cards: [cardShown], shortlist } });

describe("on the player card", () => {
  it("adds a player not on it, asking for this league", async () => {
    const app = openCard(card(SAKA.code, "Saka"), { players: [RICE] });
    await userEvent.click(await screen.findByRole("button", { name: addToShortlistWords }));
    expect(app.playerCard.shortlistChanges.add).toHaveBeenCalledWith(league.leagueId, SAKA.code);
    expect(screen.queryByText(onShortlistWords)).toBeNull();
  });

  it("says a player is on it, and takes him off", async () => {
    const app = openCard(card(SAKA.code, "Saka"), { players: [SAKA] });
    expect(await screen.findByText(onShortlistWords)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: removeFromShortlistWords }));
    expect(app.playerCard.shortlistChanges.remove).toHaveBeenCalledWith(league.leagueId, SAKA.code);
  });

  it("says the server's refusal", async () => {
    openCard(card(SAKA.code, "Saka"), { players: [], refusal: REFUSAL });
    await userEvent.click(await screen.findByRole("button", { name: addToShortlistWords }));
    expect((await screen.findByRole("alert")).textContent).toBe(REFUSAL);
  });

  it("offers no adding a player who has left the Premier League, but takes one on it off", async () => {
    openCard(card(SAKA.code, "Saka", true), { players: [] });
    await screen.findByRole("heading", { level: 1, name: "Saka" });
    expect(screen.queryByRole("button", { name: addToShortlistWords })).toBeNull();
  });

  it("takes off a player on it who has since left the Premier League", async () => {
    openCard(card(SAKA.code, "Saka", true), { players: [{ ...SAKA, gone: true }] });
    expect(await screen.findByRole("button", { name: removeFromShortlistWords })).toBeTruthy();
  });

  it.each([
    ["for a commissioner running no team", { players: null }],
    ["while the shortlist loads", { loading: true }],
  ])("offers nothing %s", async (_what, shortlist: ShortlistData) => {
    openCard(card(SAKA.code, "Saka"), shortlist, commissioner);
    await screen.findByRole("heading", { level: 1, name: "Saka" });
    expect(screen.queryByRole("button", { name: addToShortlistWords })).toBeNull();
    expect(screen.queryByRole("button", { name: removeFromShortlistWords })).toBeNull();
  });
});
