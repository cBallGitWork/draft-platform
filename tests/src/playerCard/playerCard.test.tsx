// A player's card (#381, spec/12 The player card): its own page with Back, opened from a player's
// name on Scouting and the squads page, by anyone in the league; who he is and who owns him, FPL's
// news, last season's line (not held yet) and his club's next fixtures. This season's matches are
// season.test.tsx's. Of its actions only the shortlist is built (#374, its own tests in
// tests/src/scouting/shortlist/shortlist.test.tsx).

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ListedPlayer } from "../../../convex/scouting/playersList";
import { SCOUTING_PATH } from "../../../src/frame/menu";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { playerCardPath } from "../../../src/playerCard/paths";
import type { PlayerCard } from "../../../src/playerCard/seam";
import {
  backWords,
  chanceWords,
  freeAgentWords,
  goneWords,
  LAST_SEASON_TITLE,
  lastSeasonNotHeldWords,
  loadingWords,
  NEXT_FIXTURES_TITLE,
  noNewsWords,
  noSuchPlayerWords,
  PLAYER_TITLE,
  SEASON_TITLE,
} from "../../../src/playerCard/words";
import { addToShortlistWords } from "../../../src/scouting/shortlist/words";
import { squadsPath } from "../../../src/squads/paths";
import { gameweekWords, versusWords } from "../../../src/shared/words";
import { ARSENAL, COVENTRY } from "../../support/convex/footballRows.harness";
import { HELD, openCard, RICE, SAKA } from "../../support/src/playerCardScreen.harness";
import { commissioned, league, manager, managerIn, miniBeta, openApp } from "../../support/src/shell.harness";
import { squadWithWarnings } from "../../support/src/squads.harness";

/** His row on Scouting's list. */
const listed = ({ code, name, fullName, club, positions, ownerTeamName }: PlayerCard): ListedPlayer => ({ code, name, fullName, club, positions, ownerTeamName, seasonPoints: null, stat: null });

describe("reaching it", () => {
  it("a player's name on Scouting opens his card, and Back returns to Scouting", async () => {
    const app = openApp(SCOUTING_PATH, manager, { scouting: { clubs: [ARSENAL], players: [listed(SAKA)] }, playerCard: HELD });
    await userEvent.click(await screen.findByRole("link", { name: "Saka" }));

    expect(await screen.findByRole("heading", { level: 1, name: SAKA.fullName })).toBeTruthy();
    expect(app.path()).toBe(playerCardPath(league.leagueId, SAKA.code));
    expect(app.playerCard.usePlayerCard.mock.lastCall!.slice(0, 2)).toEqual([league.leagueId, SAKA.code]);

    await userEvent.click(screen.getByRole("button", { name: backWords }));
    expect(app.path()).toBe(SCOUTING_PATH);
  });

  it("a player's name on the squads page opens his card, and Back returns there", async () => {
    const squads = squadsPath(league.leagueId);
    const app = openApp(squads, managerIn(commissioned), {
      squads: { squads: [squadWithWarnings("team-1", "Team 1", [{ code: SAKA.code, name: "Saka", clubShortName: "ARS", gone: false }])] },
      playerCard: HELD,
    });
    await userEvent.click(await screen.findByRole("link", { name: "Saka" }));

    expect(await screen.findByRole("heading", { level: 1, name: SAKA.fullName })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: backWords }));
    expect(app.path()).toBe(squads);
  });

  it("Back on a card opened straight from a link goes to Scouting", async () => {
    const app = openCard();
    await userEvent.click(await screen.findByRole("button", { name: backWords }));
    expect(app.path()).toBe(SCOUTING_PATH);
  });

  it("someone not in the league is sent to their leagues", async () => {
    const app = openApp(playerCardPath(league.leagueId, SAKA.code), managerIn(miniBeta), { playerCard: HELD });
    await screen.findByRole("heading", { level: 1 });
    expect(app.path()).toBe(LEAGUES_PATH);
  });

  it("an address whose code isn't a number goes to Scouting", async () => {
    const app = openApp(playerCardPath(league.leagueId, SAKA.code).replace(String(SAKA.code), "saka"), manager, { playerCard: HELD });
    await screen.findByRole("heading", { level: 1 });
    expect(app.path()).toBe(SCOUTING_PATH);
  });

  it("says so while the card loads", async () => {
    openCard(SAKA, { loading: true });
    expect((await screen.findByRole("status")).textContent).toBe(loadingWords);
  });

  it("says so when no player has the code", async () => {
    openCard({ ...SAKA, code: 999 });
    expect(await screen.findByText(noSuchPlayerWords)).toBeTruthy();
  });
});

describe("the card", () => {
  it("names his club, positions and owner, and FPL's news, which says his chance of playing itself", async () => {
    openCard();
    const facts = within(await screen.findByRole("region", { name: PLAYER_TITLE }));

    expect(facts.getByText(ARSENAL.name)).toBeTruthy();
    expect(facts.getByTitle("Winger").textContent).toBe("W");
    expect(facts.getByTitle("Attacking midfielder").textContent).toBe("CAM");
    expect(facts.getByText("Saka Potatoes")).toBeTruthy();
    expect(facts.getByText(SAKA.news!)).toBeTruthy();
    expect(facts.queryByText(chanceWords(75))).toBeNull();
  });

  it("a chance of playing with no news stands alone", async () => {
    openCard(SAKA, { cards: [{ ...SAKA, news: null }] });
    expect(within(await screen.findByRole("region", { name: PLAYER_TITLE })).getByText(chanceWords(75))).toBeTruthy();
  });

  it("a free agent FPL has no doubt about says so", async () => {
    openCard(RICE);
    const facts = within(await screen.findByRole("region", { name: PLAYER_TITLE }));

    expect(facts.getByText(freeAgentWords)).toBeTruthy();
    expect(facts.getByText(noNewsWords)).toBeTruthy();
  });

  it("a player who has left the Premier League is marked so", async () => {
    openCard(SAKA, { cards: [{ ...SAKA, gone: true }] });
    expect(await screen.findByText(goneWords)).toBeTruthy();
  });

  it("last season's line says it isn't held yet", async () => {
    openCard();
    expect(within(await screen.findByRole("region", { name: LAST_SEASON_TITLE })).getByText(lastSeasonNotHeldWords)).toBeTruthy();
  });

  it("lists his club's next fixtures by gameweek", async () => {
    openCard();
    const fixtures = within(await screen.findByRole("region", { name: NEXT_FIXTURES_TITLE }));
    const [next] = fixtures.getAllByRole("listitem");

    expect(next.textContent).toContain(gameweekWords(10));
    expect(next.textContent).toContain(`${COVENTRY.shortName} ${versusWords} ${ARSENAL.shortName}`);
  });

  it("offers no action but Back and the shortlist, the one built", async () => {
    openCard();
    await screen.findByRole("region", { name: SEASON_TITLE });
    expect(screen.getAllByRole("button").filter((button) => button.closest("main")).map((button) => button.textContent)).toEqual([backWords, addToShortlistWords]);
  });
});
