// A player's card's season (#381, spec/12 The player card): this season's matches by category at
// his base points, at each position he has by a switch (Craig, 31 Oct 2026), his role's line apart,
// and whether the points may still move.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  breakdownLabel,
  columns,
  liveWords,
  noFigureWords,
  noMatchesWords,
  nothingEarnedWords,
  pricedAtLabel,
  provisionalWords,
  roleLineLabel,
  scoredUnderWords,
  SEASON_TITLE,
} from "../../../src/playerCard/words";
import { versusWords } from "../../../src/shared/words";
import { ARSENAL, COVENTRY } from "../../support/convex/footballRows.harness";
import { expectColumnHeads } from "../../support/src/columnHeads";
import { AT_ONE, AT_W, breakdownLines, CATEGORIES, category, openCard, perAction, PRICED_VERSION, RICE } from "../../support/src/playerCardScreen.harness";

/** The priced match's row head, as a screen reader names it. */
const MATCH_NAME = `${ARSENAL.shortName} ${versusWords} ${COVENTRY.shortName}`;

describe("this season", () => {
  it("each match shows his base points plainly, with no note on how they were priced, and each category he earned points in", async () => {
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [AT_W] }] });
    const seasonPanel = await screen.findByRole("region", { name: SEASON_TITLE });
    const season = within(seasonPanel);

    expect(seasonPanel.querySelectorAll("p")).toHaveLength(0);
    expectColumnHeads(seasonPanel, Object.values(columns));
    const row = season.getByRole("rowheader", { name: MATCH_NAME }).closest("tr")!;
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2", "90", "W", "11"]);
    expect(breakdownLines(season, 2)).toEqual(["Goals scored 5 (1 at 5 each)", "Assists 4 (1 at 4 each for W)", "Minutes 2 (90, 2 for 60+)", scoredUnderWords(PRICED_VERSION)]);
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
    const row = season.getAllByRole("rowheader", { name: MATCH_NAME })[1].closest("tr")!;
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2", "90", "CAM", "12"]);
    expect(breakdownLines(season, 2)).toEqual(["Goals scored 5 (1 at 5 each)", "Assists 5 (1 at 5 each for CAM)", "Minutes 2 (90, 2 for 60+)", scoredUnderWords(PRICED_VERSION)]);
  });

  it("choosing another position re-prices every match there", async () => {
    openCard();
    const season = within(await screen.findByRole("region", { name: SEASON_TITLE }));
    await userEvent.click(season.getByRole("radio", { name: "W" }));

    expect((season.getByRole("radio", { name: "W" }) as HTMLInputElement).checked).toBe(true);
    const row = season.getAllByRole("rowheader", { name: MATCH_NAME })[1].closest("tr")!;
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2", "90", "W", "11"]);
    expect(breakdownLines(season, 2)).toEqual(["Goals scored 5 (1 at 5 each)", "Assists 4 (1 at 4 each for W)", "Minutes 2 (90, 2 for 60+)", scoredUnderWords(PRICED_VERSION)]);
  });

  it("the arrow keys move the switch, as a radio group", async () => {
    openCard();
    const season = within(await screen.findByRole("region", { name: SEASON_TITLE }));
    await userEvent.click(season.getByRole("radio", { name: "CAM" }));
    await userEvent.keyboard("{ArrowRight}");
    expect((season.getByRole("radio", { name: "W" }) as HTMLInputElement).checked).toBe(true);
  });

  it("a player none of whose positions has a price yet is priced once, at his best, with no switch", async () => {
    openCard(AT_ONE, { cards: [{ ...AT_ONE, positions: ["SS"], pricedAt: [], matches: [AT_W] }] });
    const season = within(await screen.findByRole("region", { name: SEASON_TITLE }));
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
    const row = screen.getByRole("rowheader", { name: MATCH_NAME }).closest("tr")!;
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2", "90", "W", "11"]);
  });

  it("a match that cost him points shows the true minus in its total, breakdown and role line, never a hyphen (#564)", async () => {
    const role = { name: "Inside forward", points: -1, lines: [{ stat: "yellow_cards", name: "Yellow cards", actions: 1, points: -1 }] };
    const categories = [category("minutes", "Minutes", 1), category("yellow_cards", "Yellow cards", -3, perAction(3, -1))];
    const booked = { ...AT_W, points: [{ position: "W" as const, total: -2, categories }], role };
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [booked] }] });
    const season = within(await screen.findByRole("region", { name: SEASON_TITLE }));
    const row = season.getAllByRole("rowheader", { name: MATCH_NAME })[0].closest("tr")!;

    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2", "90", "W", "−2"]);
    expect(breakdownLines(season, 2).slice(0, 2)).toEqual(["Minutes 1 (1 at 1 each)", "Yellow cards −3 (3 at −1 each)"]);
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
});
