// A player's card (#381, spec/12 The player card): its own page with Back, opened from a player's
// name on Scouting and the squads page, by anyone in the league; who he is and who owns him, FPL's
// news, this season's matches by category at his base points, at each position he has by a switch
// (Craig, 31 Oct 2026), last season's line (not held yet)
// and his club's next fixtures. Of its actions only the shortlist is built (#374, its own tests in
// tests/src/scouting/shortlist/shortlist.test.tsx).

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
  basePointsNote,
  bestPositionNote,
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
  liveWords,
  PLAYER_TITLE,
  pricedAtLabel,
  provisionalWords,
  SEASON_TITLE,
} from "../../../src/playerCard/words";
import { addToShortlistWords } from "../../../src/scouting/shortlist/words";
import { squadsPath } from "../../../src/squads/paths";
import { gameweekWords, versusWords } from "../../../src/shared/words";
import { ARSENAL, COVENTRY } from "../../support/convex/footballRows.harness";
import { expectColumnHeads } from "../../support/src/columnHeads";
import type { PlayerCardData } from "../../support/src/playerCard.harness";
import { commissioned, league, manager, managerIn, miniBeta, openApp } from "../../support/src/shell.harness";
import { squadWithWarnings } from "../../support/src/squads.harness";

const category = (stat: string, name: string, points: number | null) => ({ stat, name, points });
const CATEGORIES = [category("goals_scored", "Goals scored", 5), category("assists", "Assists", 4), category("minutes", "Minutes", 2), category("yellow_cards", "Yellow cards", 0)];
const PRICED: PlayedMatch = {
  fixtureCode: 1,
  gameweek: 2,
  kickoff: Date.parse("2026-08-29T14:00:00Z"),
  home: ARSENAL,
  away: COVENTRY,
  minutes: 90,
  // At CAM, where his assist is worth one more, then at W: back to front, as pricedAt.
  points: [
    { position: "CAM", total: 12, categories: CATEGORIES.map((each) => (each.stat === "assists" ? { ...each, points: 5 } : each)) },
    { position: "W", total: 11, categories: CATEGORIES },
  ],
  override: null,
  provisional: false,
};
const NOT_ARRIVED: PlayedMatch = {
  ...PRICED,
  fixtureCode: 2,
  gameweek: 3,
  minutes: null,
  points: PRICED.points.map((each) => ({ ...each, total: null, categories: each.categories.map((one) => ({ ...one, points: null })) })),
};
/** PRICED with only the winger's price, for a card priced at one position. */
const AT_W: PlayedMatch = { ...PRICED, points: [PRICED.points[1]] };
const SAKA: PlayerCard = {
  code: 1001,
  name: "Saka",
  fullName: "Bukayo Saka",
  club: ARSENAL,
  gone: false,
  positions: ["W", "CAM"],
  pricedAt: ["CAM", "W"],
  ownerTeamName: "Saka Potatoes",
  news: "Hamstring injury - 75% chance of playing",
  chanceOfPlaying: 75,
  matches: [NOT_ARRIVED, PRICED],
  nextFixtures: [{ fixtureCode: 9, gameweek: 10, kickoff: Date.parse("2026-11-07T15:00:00Z"), home: COVENTRY, away: ARSENAL }],
};
/** Saka priced at one position, so with no switch. */
const AT_ONE: PlayerCard = { ...SAKA, pricedAt: ["W"] };
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

  it("each match shows his base points, said so, and each category he earned points in", async () => {
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [AT_W] }] });
    const seasonPanel = await screen.findByRole("region", { name: SEASON_TITLE });
    const season = within(seasonPanel);

    expect(season.getByText(basePointsNote)).toBeTruthy();
    expectColumnHeads(seasonPanel, Object.values(columns));
    const row = season.getByRole("rowheader", { name: `${ARSENAL.shortName} ${versusWords} ${COVENTRY.shortName}` }).closest("tr")!;
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2", "90", "W", "11"]);
    expect(season.getByLabelText(breakdownLabel(2)).textContent).toBe("Goals scored 5, Assists 4, Minutes 2");
  });

  it("a player priced at one position has no switch", async () => {
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [AT_W] }] });
    const season = within(await screen.findByRole("region", { name: SEASON_TITLE }));
    expect(season.queryByRole("radiogroup")).toBeNull();
  });

  it("a player with two positions has a key for each, back to front, opening on the first", async () => {
    openCard();
    const season = within(await screen.findByRole("region", { name: SEASON_TITLE }));
    const keys = within(season.getByRole("radiogroup", { name: pricedAtLabel })).getAllByRole("radio");

    expect(keys.map((key) => key.closest("label")!.textContent)).toEqual(["CAM", "W"]);
    expect(keys.map((key) => (key as HTMLInputElement).checked)).toEqual([true, false]);
    const row = season.getAllByRole("rowheader", { name: `${ARSENAL.shortName} ${versusWords} ${COVENTRY.shortName}` })[1].closest("tr")!;
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2", "90", "CAM", "12"]);
    expect(season.getByLabelText(breakdownLabel(2)).textContent).toBe("Goals scored 5, Assists 5, Minutes 2");
  });

  it("choosing another position re-prices every match there", async () => {
    openCard();
    const season = within(await screen.findByRole("region", { name: SEASON_TITLE }));
    await userEvent.click(season.getByRole("radio", { name: "W" }));

    expect((season.getByRole("radio", { name: "W" }) as HTMLInputElement).checked).toBe(true);
    const row = season.getAllByRole("rowheader", { name: `${ARSENAL.shortName} ${versusWords} ${COVENTRY.shortName}` })[1].closest("tr")!;
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2", "90", "W", "11"]);
    expect(season.getByLabelText(breakdownLabel(2)).textContent).toBe("Goals scored 5, Assists 4, Minutes 2");
  });

  it("the arrow keys move the switch, as a radio group", async () => {
    openCard();
    const season = within(await screen.findByRole("region", { name: SEASON_TITLE }));
    await userEvent.click(season.getByRole("radio", { name: "CAM" }));
    await userEvent.keyboard("{ArrowRight}");
    expect((season.getByRole("radio", { name: "W" }) as HTMLInputElement).checked).toBe(true);
  });

  it("a player none of whose positions has a price yet is priced once, at his best, said so", async () => {
    openCard(AT_ONE, { cards: [{ ...AT_ONE, positions: ["SS"], pricedAt: [], matches: [AT_W] }] });
    const season = within(await screen.findByRole("region", { name: SEASON_TITLE }));
    expect(season.getByText(bestPositionNote)).toBeTruthy();
    expect(season.queryByRole("radiogroup")).toBeNull();
    const row = season.getByRole("rowheader").closest("tr")!;
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2", "90", "W", "11"]);
  });

  it("a match whose record hasn't arrived reads '—' and has no breakdown", async () => {
    openCard();
    const season = within(await screen.findByRole("region", { name: SEASON_TITLE }));
    const row = season.getAllByRole("rowheader")[0].closest("tr")!;

    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["3", noFigureWords, "CAM", noFigureWords]);
    expect(season.queryByLabelText(breakdownLabel(3))).toBeNull();
  });

  it("a match where no category earned him points says so", async () => {
    const nothing = { ...AT_W, points: [{ ...AT_W.points[0], total: 0, categories: CATEGORIES.map((each) => ({ ...each, points: 0 })) }] };
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [nothing] }] });
    expect(await screen.findByText(nothingEarnedWords)).toBeTruthy();
  });

  it("a match his team started him in shows his base points, and his role's adjustment apart, with what made it (#10)", async () => {
    const role = { name: "Inside forward", points: 2, lines: [{ stat: "goals_scored", name: "Goals scored", actions: 1, points: 2 }] };
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [{ ...AT_W, role }] }] });
    expect((await screen.findByLabelText(roleLineLabel("Inside forward"))).textContent).toBe("Inside forward +2 (Goals scored 1)");
    const row = screen.getByRole("rowheader", { name: `${ARSENAL.shortName} ${versusWords} ${COVENTRY.shortName}` }).closest("tr")!;
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2", "90", "W", "11"]);
  });

  it("a match that cost him points shows the true minus in its total, breakdown and role line, never a hyphen (#564)", async () => {
    const role = { name: "Inside forward", points: -1, lines: [{ stat: "yellow_cards", name: "Yellow cards", actions: 1, points: -1 }] };
    const categories = [category("minutes", "Minutes", 1), category("yellow_cards", "Yellow cards", -3)];
    const booked = { ...AT_W, points: [{ position: "W" as const, total: -2, categories }], role };
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [booked] }] });
    const season = within(await screen.findByRole("region", { name: SEASON_TITLE }));
    const row = season.getAllByRole("rowheader", { name: `${ARSENAL.shortName} ${versusWords} ${COVENTRY.shortName}` })[0].closest("tr")!;

    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2", "90", "W", "−2"]);
    expect(season.getByLabelText(breakdownLabel(2)).textContent).toBe("Minutes 1, Yellow cards −3");
    expect(season.getByLabelText(roleLineLabel("Inside forward")).textContent).toBe("Inside forward −1 (Yellow cards 1)");
  });

  it("a match whose points may still move is marked live, and the card says why (#577)", async () => {
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [{ ...AT_W, provisional: true }] }] });
    const season = within(await screen.findByRole("region", { name: SEASON_TITLE }));
    expect(season.getByText(provisionalWords)).toBeTruthy();
    expect(season.getByText(liveWords)).toBeTruthy();
  });

  it("a final match has no live mark", async () => {
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [AT_W] }] });
    const season = within(await screen.findByRole("region", { name: SEASON_TITLE }));
    expect(season.queryByText(provisionalWords)).toBeNull();
    expect(season.queryByText(liveWords)).toBeNull();
  });

  it("an overridden match shows no role line: the override is its whole score", async () => {
    const role = { name: "Inside forward", points: 2, lines: [] };
    const overridden = { ...AT_W, role, override: { points: 9, reason: "A goal the feed gave someone else" } };
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [overridden] }] });
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
