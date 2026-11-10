// A player's card (#381, #1027; spec/12 The player card, laid out to its approved picture): its own
// page with Back, opened from a player's name on Scouting and the squads page, by anyone in the
// league; his head with who he is, who owns him, his figures and the actions that follow who he
// is, FPL's news, last season's line and his club's next fixtures, and the placeholders that keep
// their places. This season's matches are season.test.tsx's; the shortlist's own tests are in
// tests/src/scouting/shortlist/shortlist.test.tsx.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ListedPlayer } from "../../../convex/scouting/playersList";
import { NO_FIGURES } from "../../../convex/scouting/playersOrder";
import { SCOUTING_PATH, TRADES_NEW_PATH } from "../../../src/frame/menu";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { playerCardPath } from "../../../src/playerCard/paths";
import type { PlayerCard } from "../../../src/playerCard/seam";
import {
  backWords,
  CAPTAIN_TITLE,
  captainLabel,
  chanceWords,
  dropWords,
  figureLabels,
  freeAgentWords,
  goneWords,
  LAST_SEASON_TITLE,
  lastSeasonNotHeldWords,
  loadingWords,
  NEWS_TITLE,
  newsNotesLabel,
  nextFixturesTitle,
  noFigureWords,
  noNewsWords,
  noSuchPlayerWords,
  notInLastSeasonWords,
  pickUpWords,
  portraitLabel,
  ROLE_FIT_TITLE,
  roleFitLabel,
  offerTradeWords,
  rankLabel,
  SEASON_TITLE,
} from "../../../src/playerCard/words";
import { freeScoutsWords, sendScoutWords } from "../../../src/scouting/scouts/words";
import { addToShortlistWords } from "../../../src/scouting/shortlist/words";
import { squadsPath } from "../../../src/squads/paths";
import { crestUrl } from "../../../src/ui/ClubName";
import { difficultyNotRatedWords, gameweekShort } from "../../../src/shared/words";
import { ARSENAL, COVENTRY } from "../../support/convex/footballRows.harness";
import { HELD, NOT_ARRIVED, openCard, PRICED, RICE, SAKA, SAKA_POTATOES } from "../../support/src/playerCardScreen.harness";
import { commissioned, league, manager, managerIn, miniBeta, openApp } from "../../support/src/shell.harness";
import { squadWithWarnings } from "../../support/src/squads.harness";

/** The card's head, labelled by his name. */
const headOf = async (card: PlayerCard = SAKA) => within(await screen.findByRole("region", { name: card.fullName }));

/** His row on Scouting's list. */
const listed = ({ code, name, fullName, club, positions, ownerTeamName }: PlayerCard): ListedPlayer => ({ code, name, fullName, club, positions, ownerTeamName, onWaivers: null, seasonPoints: null, figures: NO_FIGURES, stat: null });

describe("reaching it", () => {
  it("a player's name on Scouting opens his card, and Back returns to Scouting", async () => {
    // A free agent, as Scouting opens on them.
    const app = openApp(SCOUTING_PATH, manager, { scouting: { clubs: [ARSENAL], players: [{ ...listed(SAKA), ownerTeamName: null }] }, playerCard: HELD });
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
    const head = await headOf();

    expect(head.getByText(ARSENAL.name).firstElementChild!.getAttribute("src")).toBe(crestUrl(ARSENAL.code));
    expect(head.getByTitle("Winger").textContent).toBe("W");
    expect(head.getByTitle("Attacking midfielder").textContent).toBe("CAM");
    expect(head.getByText("Saka Potatoes")).toBeTruthy();
    const news = within(screen.getByRole("region", { name: NEWS_TITLE }));
    expect(news.getByText(SAKA.news!)).toBeTruthy();
    expect(news.queryByText(chanceWords(75))).toBeNull();
  });

  it("keeps its title plate the plate's colour, never his club's (spec/12, Club colours)", async () => {
    openCard();
    await headOf();
    expect(document.body.querySelectorAll('[style*="background"]')).toHaveLength(0);
  });

  it("a chance of playing with no news stands alone", async () => {
    openCard(SAKA, { cards: [{ ...SAKA, news: null }] });
    expect(within(await screen.findByRole("region", { name: NEWS_TITLE })).getByText(chanceWords(75))).toBeTruthy();
  });

  it("a free agent FPL has no doubt about says so", async () => {
    openCard(RICE);
    expect((await headOf(RICE)).getByText(freeAgentWords)).toBeTruthy();
    expect(within(screen.getByRole("region", { name: NEWS_TITLE })).getByText(noNewsWords)).toBeTruthy();
  });

  it("a player who has left the Premier League is marked so", async () => {
    openCard(SAKA, { cards: [{ ...SAKA, gone: true }] });
    expect(await screen.findByText(goneWords)).toBeTruthy();
  });

  it("last season's line holds his appearances, minutes and points at the position the switch picks (Craig, 6 Nov 2026)", async () => {
    openCard();
    const lastSeason = await screen.findByLabelText(LAST_SEASON_TITLE);
    expect(lastSeason.textContent).toContain("25/26: 34 apps, 2810 min, 212 pts");

    await userEvent.click(within(screen.getByRole("region", { name: SEASON_TITLE })).getByRole("radio", { name: "W" }));
    expect(lastSeason.textContent).toContain("25/26: 34 apps, 2810 min, 198 pts");
  });

  it("a player not in last season's data is not in the Premier League last season", async () => {
    const newcomer = { ...SAKA, lastSeason: { season: 2025, played: null } };
    openCard(newcomer, { cards: [newcomer] });
    expect((await screen.findByLabelText(LAST_SEASON_TITLE)).textContent).toContain(notInLastSeasonWords);
  });

  it("last season's line says it isn't held while no past season is", async () => {
    const unheld = { ...SAKA, lastSeason: null };
    openCard(unheld, { cards: [unheld] });
    expect((await screen.findByLabelText(LAST_SEASON_TITLE)).textContent).toContain(lastSeasonNotHeldWords);
  });

  it("lists his club's next fixtures by gameweek", async () => {
    openCard();
    const fixtures = within(await screen.findByRole("region", { name: nextFixturesTitle(ARSENAL.name) }));
    const [next] = fixtures.getAllByRole("listitem");

    expect(next.textContent).toContain(gameweekShort(10));
    // From his club's side, its fill waiting for fixture difficulty.
    expect(within(next).getByRole("img", { name: `${COVENTRY.shortName} (A) ${difficultyNotRatedWords}` }).textContent).toBe(`${COVENTRY.shortName} (A)`);
  });

  it("offers no action but Back, the shortlist and the scout, the ones built", async () => {
    openCard();
    const head = await headOf();
    expect(head.getAllByRole("button").map((button) => button.textContent)).toEqual([backWords, addToShortlistWords, sendScoutWords]);
    // How many of the team's three scouts are free, beside Send a scout.
    expect(head.getByText(freeScoutsWords(3, 3))).toBeTruthy();
  });
});

describe("the card's head (#1027)", () => {
  it("another team's player's Offer a trade opens New offer with his owner chosen and him asked for (Craig, 9 Nov 2026)", async () => {
    const app = openCard();
    await userEvent.click((await headOf()).getByRole("link", { name: offerTradeWords }));
    expect(app.path()).toBe(TRADES_NEW_PATH);
    expect(Object.fromEntries(new URLSearchParams(app.search()))).toEqual({ team: SAKA_POTATOES, player: String(SAKA.code) });
  });

  it("a free agent offers Pick up in place of a trade", async () => {
    openCard(RICE, { ...HELD, actions: new Map([[RICE.code, { kind: "pickUp", squad: [] }]]) });
    const head = await headOf(RICE);
    expect(head.getAllByRole("button").map((button) => button.textContent)).toEqual([backWords, addToShortlistWords, sendScoutWords, pickUpWords]);
    expect(head.queryByRole("link", { name: offerTradeWords })).toBeNull();
  });

  it("his rank at the position the switch is on: among every player holding it, ties sharing a place (Craig, 9 Nov 2026)", async () => {
    const app = openCard(SAKA, {
      ...HELD,
      ranks: new Map([
        [`${SAKA.code} CAM`, { place: 4, of: 38 }],
        [`${SAKA.code} W`, { place: null, of: 52 }],
      ]),
    });
    const head = await headOf();
    expect(head.getByText(rankLabel("CAM")).nextElementSibling!.textContent).toBe("4th of 38");
    expect(app.playerCard.usePositionRank.mock.lastCall).toEqual([league.leagueId, SAKA.code, "CAM"]);

    await userEvent.click(within(screen.getByRole("region", { name: SEASON_TITLE })).getByRole("radio", { name: "W" }));
    expect(head.getByText(rankLabel("W")).nextElementSibling!.textContent).toBe(noFigureWords);
  });

  it("a player with no priced position has no rank, and none is asked for", async () => {
    const support = { ...SAKA, positions: ["SS" as const], pricedAt: [] };
    const app = openCard(support, { cards: [support] });
    const head = await headOf();
    expect(head.getByText(rankLabel(null)).nextElementSibling!.textContent).toBe(noFigureWords);
    expect(app.playerCard.usePositionRank.mock.lastCall![2]).toBeNull();
  });

  it("the manager's own player offers Drop alone", async () => {
    openCard(SAKA, { ...HELD, actions: new Map([[SAKA.code, { kind: "drop" }]]) });
    const head = await headOf();
    expect(head.getAllByRole("button").map((button) => button.textContent)).toEqual([backWords, dropWords]);
  });

  it("his figures beside his name are at the position the switch is on: base points, a match, minutes and his last five", async () => {
    const overridden = { ...PRICED, fixtureCode: 3, gameweek: 1, minutes: 45, override: { points: 2, reason: "A goal given to another" } };
    openCard(SAKA, { cards: [{ ...SAKA, matches: [...SAKA.matches, overridden] }] });
    const head = await headOf();
    const figure = (label: string) => head.getByText(label).nextElementSibling!.textContent;

    // S12.1. At CAM: 12, then the override's 2; the match not yet arrived counts for nothing.
    expect(figure(figureLabels.seasonPoints)).toBe("14");
    expect(figure(figureLabels.aMatch)).toBe("7");
    expect(figure(figureLabels.minutes)).toBe("135");
    expect(figure(figureLabels.lastFive)).toBe("122");

    await userEvent.click(within(screen.getByRole("region", { name: SEASON_TITLE })).getByRole("radio", { name: "W" }));
    expect(figure(figureLabels.seasonPoints)).toBe("13");
  });

  it("shows no minutes, not 0, while none of his matches' records has arrived", async () => {
    openCard(SAKA, { cards: [{ ...SAKA, matches: [NOT_ARRIVED] }] });
    const head = await headOf();
    expect(head.getByText(figureLabels.minutes).nextElementSibling!.textContent).toBe(noFigureWords);
  });

  it("keeps the portrait, a news note, role fit and the club captain hint (S17.7) in their places as placeholders", async () => {
    openCard();
    expect((await headOf()).getByRole("img", { name: portraitLabel })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: NEWS_TITLE })).getByRole("img", { name: newsNotesLabel })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: ROLE_FIT_TITLE })).getByRole("img", { name: roleFitLabel })).toBeTruthy();
    const captain = within(screen.getByRole("region", { name: CAPTAIN_TITLE }));
    expect(captain.getByText(captainLabel)).toBeTruthy();
    expect(captain.getAllByRole("img")).toHaveLength(1);
  });

  it("shows no set-piece hint: set-piece duties come back only as roles (S05.24)", async () => {
    openCard();
    await headOf();
    expect(screen.queryByText(/set pieces/i)).toBeNull();
  });
});
