// A player's card (#381, spec/12 The player card): its own page with Back, opened from a player's
// name on Scouting and the squads page, by anyone in the league; who he is and who owns him, FPL's
// news, this season's matches by category at his best position, last season's line (not held yet)
// and his club's next fixtures. Of its actions only the shortlist is built (#374, its own tests in
// tests/src/scouting/shortlist.test.tsx).

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ListedPlayer } from "../../../convex/scouting/playersList";
import { SCOUTING_PATH } from "../../../src/frame/menu";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { playerCardPath } from "../../../src/playerCard/paths";
import type { PlayedMatch, PlayerCard } from "../../../src/playerCard/seam";
import {
  backWords,
  breakdownLabel,
  roleLineLabel,
  chanceWords,
  columns,
  freeAgentWords,
  goneWords,
  LAST_SEASON_TITLE,
  lastSeasonNotHeldWords,
  loadingWords,
  NEXT_FIXTURES_TITLE,
  noFigureWords,
  noMatchesWords,
  noNewsWords,
  noSuchPlayerWords,
  nothingEarnedWords,
  PLAYER_TITLE,
  pricedNotes,
  SEASON_TITLE,
} from "../../../src/playerCard/words";
import { addToShortlistWords } from "../../../src/scouting/shortlistWords";
import { squadsPath } from "../../../src/squads/paths";
import { gameweekWords, versusWords } from "../../../src/words";
import type { PlayerCardData } from "../../support/src/playerCard.harness";
import { commissioned, league, manager, managerIn, miniBeta, openApp } from "../../support/src/shell.harness";
import { teamSquad } from "../../support/src/squads.harness";

const ARSENAL = { code: 3, name: "Arsenal", shortName: "ARS" };
const COVENTRY = { code: 9, name: "Coventry", shortName: "COV" };
const category = (stat: string, name: string, points: number | null) => ({ stat, name, points });
const PRICED: PlayedMatch = {
  fixtureCode: 1,
  gameweek: 2,
  kickoff: Date.parse("2026-08-29T14:00:00Z"),
  home: ARSENAL,
  away: COVENTRY,
  minutes: 90,
  points: {
    scoredAs: "bestPosition",
    position: "W",
    total: 11,
    categories: [category("goals_scored", "Goals scored", 5), category("assists", "Assists", 4), category("minutes", "Minutes", 2), category("yellow_cards", "Yellow cards", 0)],
  },  override: null,
};
const NOT_ARRIVED: PlayedMatch = {
  ...PRICED,
  fixtureCode: 2,
  gameweek: 3,
  minutes: null,
  points: { scoredAs: "bestPosition", position: null, total: null, categories: PRICED.points.categories.map((each) => ({ ...each, points: null })) },
};
const SAKA: PlayerCard = {
  code: 1001,
  name: "Saka",
  fullName: "Bukayo Saka",
  club: ARSENAL,
  gone: false,
  positions: ["W", "CAM"],
  ownerTeamName: "Saka Potatoes",
  news: "Hamstring injury - 75% chance of playing",
  chanceOfPlaying: 75,
  matches: [NOT_ARRIVED, PRICED],
  nextFixtures: [{ fixtureCode: 9, gameweek: 10, kickoff: Date.parse("2026-11-07T15:00:00Z"), home: COVENTRY, away: ARSENAL }],
};
const RICE: PlayerCard = { ...SAKA, code: 1002, name: "Rice", fullName: "Declan Rice", ownerTeamName: null, news: null, chanceOfPlaying: null, matches: [], nextFixtures: [] };
const HELD: PlayerCardData = { cards: [SAKA, RICE] };

/** His row on Scouting's list. */
const listed = ({ code, name, fullName, club, positions, ownerTeamName }: PlayerCard): ListedPlayer => ({ code, name, fullName, club, positions, ownerTeamName, seasonPoints: null, stat: null });
const openCard = (card: PlayerCard = SAKA, playerCard: PlayerCardData = HELD) => openApp(playerCardPath(league.leagueId, card.code), manager, { playerCard });

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
      squads: { squads: [teamSquad("team-1", "Team 1", [{ code: SAKA.code, name: "Saka", clubShortName: "ARS", gone: false }])] },
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

  it("each match shows its figures at his best position, labelled so, and each category he earned points in", async () => {
    openCard();
    const season = within(await screen.findByRole("region", { name: SEASON_TITLE }));

    expect(season.getByText(pricedNotes.bestPosition)).toBeTruthy();
    expect(season.getAllByRole("columnheader").map((head) => head.textContent)).toEqual(Object.values(columns).map((column) => column.short));
    const row = season.getAllByRole("rowheader", { name: `${ARSENAL.shortName} ${versusWords} ${COVENTRY.shortName}` })[1].closest("tr")!;
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2", "90", "W", "11"]);
    expect(season.getByLabelText(breakdownLabel(2)).textContent).toBe("Goals scored 5, Assists 4, Minutes 2");
  });

  it("a match whose record hasn't arrived reads '—' and has no breakdown", async () => {
    openCard();
    const season = within(await screen.findByRole("region", { name: SEASON_TITLE }));
    const row = season.getAllByRole("rowheader")[0].closest("tr")!;

    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["3", noFigureWords, noFigureWords, noFigureWords]);
    expect(season.queryByLabelText(breakdownLabel(3))).toBeNull();
  });

  it("a match where no category earned him points says so", async () => {
    const nothing = { ...PRICED, points: { ...PRICED.points, total: 0, categories: PRICED.points.categories.map((each) => ({ ...each, points: 0 })) } };
    openCard(SAKA, { cards: [{ ...SAKA, matches: [nothing] }] });
    expect(await screen.findByText(nothingEarnedWords)).toBeTruthy();
  });

  it("a match his team started him in shows his role's adjustment and what made it (#10)", async () => {
    const role = { name: "Inside forward", points: 2, lines: [{ stat: "goals_scored", name: "Goals scored", actions: 1, points: 2 }] };
    const started = { ...PRICED, points: { ...PRICED.points, scoredAs: "slot" as const, total: 13, role } };
    openCard(SAKA, { cards: [{ ...SAKA, matches: [started] }] });
    expect((await screen.findByLabelText(roleLineLabel("Inside forward"))).textContent).toBe("Inside forward +2 (Goals scored 1)");
  });

  it("says how its matches are priced, both ways when some are at his slot and some at his best position", async () => {
    const started = { ...PRICED, fixtureCode: 9, points: { ...PRICED.points, scoredAs: "slot" as const } };
    openCard(SAKA, { cards: [{ ...SAKA, matches: [started, PRICED] }] });
    const season = within(await screen.findByRole("region", { name: SEASON_TITLE }));
    expect(season.getByText(pricedNotes.slot)).toBeTruthy();
    expect(season.getByText(pricedNotes.bestPosition)).toBeTruthy();
  });

  it("an overridden match shows no role line: the override is its whole score", async () => {
    const role = { name: "Inside forward", points: 2, lines: [] };
    const overridden = { ...PRICED, points: { ...PRICED.points, role }, override: { points: 9, reason: "A goal the feed gave someone else" } };
    openCard(SAKA, { cards: [{ ...SAKA, matches: [overridden] }] });
    await screen.findByRole("region", { name: SEASON_TITLE });
    expect(screen.queryByLabelText(roleLineLabel("Inside forward"))).toBeNull();
  });

  it("a player with no matches this season says so", async () => {
    openCard(RICE);
    expect(within(await screen.findByRole("region", { name: SEASON_TITLE })).getByText(noMatchesWords)).toBeTruthy();
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
