// A player's card's season (#381, #1027; spec/12 The player card): this season's matches as a game
// log at his base points, at each position he has by a switch (Craig, 31 Oct 2026), a column for
// each category that scores there or for every stat held, a postponed match keeping its row, and
// the selected match's breakdown in the right column, his role's line apart.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  breakdownLabel,
  columns,
  liveWords,
  logViewLabel,
  logViews,
  noFigureWords,
  noMatchesWords,
  nothingEarnedWords,
  overriddenWasWords,
  postponedWords,
  pricedAtLabel,
  provisionalWords,
  roleLineLabel,
  scoredUnderWords,
  SEASON_TITLE,
} from "../../../src/playerCard/words";
import { ARSENAL, CHELSEA, COVENTRY } from "../../support/convex/footballRows.harness";
import { expectColumnHeads } from "../../support/src/columnHeads";
import {
  AT_ONE,
  AT_W,
  breakdownLines,
  CATEGORIES,
  category,
  LOG_CATEGORIES,
  openCard,
  perAction,
  PRICED,
  PRICED_OPPONENT,
  PRICED_VERSION,
  RICE,
  SAKA,
  selectMatch,
} from "../../support/src/playerCardScreen.harness";

/** The game log, once the card has opened. */
async function seasonOf() {
  const panel = await screen.findByRole("region", { name: SEASON_TITLE });
  return { panel, season: within(panel) };
}
/** The cells of the `index`th match row named by `opponent`, its row head left out. */
const cellsOf = (season: ReturnType<typeof within>, index = 0, opponent = PRICED_OPPONENT) =>
  within(season.getAllByRole("rowheader", { name: opponent })[index].closest("tr")!)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
/** The scoring columns at a winger's or an attacking midfielder's position: all but clean sheets. */
const SCORING_HEADS = LOG_CATEGORIES.filter((each) => each.stat !== "clean_sheets").map(({ shortCode, name }) => ({ short: shortCode, long: name }));

describe("this season", () => {
  it("each match shows his base points plainly, with no note on how they were priced, and each category he earned points in", async () => {
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [AT_W] }] });
    const { panel, season } = await seasonOf();

    expect(panel.querySelectorAll("p:not([aria-label])")).toHaveLength(0);
    expectColumnHeads(panel, [columns.gameweek, columns.opponent, columns.score, columns.minutes, ...SCORING_HEADS, columns.points]);
    // His goal, his assist, no yellow card, then his points.
    expect(cellsOf(season)).toEqual(["2", "2–1", "90", "1", "1", "0", "11"]);
    expect(breakdownLines(2)).toEqual(["Goals scored 5 (1 at 5 each)", "Assists 4 (1 at 4 each for W)", "Minutes 2 (90, 2 for 60+)", scoredUnderWords(PRICED_VERSION)]);
  });

  it("a player priced at one position has no switch", async () => {
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [AT_W] }] });
    const { season } = await seasonOf();
    expect(season.queryByRole("radiogroup", { name: pricedAtLabel })).toBeNull();
  });

  it("a player with two positions has a key for each, back to front, opening on the first", async () => {
    openCard();
    const { season } = await seasonOf();
    const keys = within(season.getByRole("radiogroup", { name: pricedAtLabel })).getAllByRole("radio");

    expect(keys.map((key) => key.closest("label")!.textContent)).toEqual(["CAM", "W"]);
    expect(keys.map((key) => (key as HTMLInputElement).checked)).toEqual([true, false]);
    expect(cellsOf(season, 1)).toEqual(["2", "2–1", "90", "1", "1", "0", "12"]);
    await selectMatch(PRICED_OPPONENT, 1);
    expect(breakdownLines(2)).toEqual(["Goals scored 5 (1 at 5 each)", "Assists 5 (1 at 5 each for CAM)", "Minutes 2 (90, 2 for 60+)", scoredUnderWords(PRICED_VERSION)]);
  });

  it("choosing another position re-prices every match there", async () => {
    openCard();
    const { season } = await seasonOf();
    await userEvent.click(season.getByRole("radio", { name: "W" }));

    expect((season.getByRole("radio", { name: "W" }) as HTMLInputElement).checked).toBe(true);
    expect(cellsOf(season, 1)).toEqual(["2", "2–1", "90", "1", "1", "0", "11"]);
    await selectMatch(PRICED_OPPONENT, 1);
    expect(breakdownLines(2)).toEqual(["Goals scored 5 (1 at 5 each)", "Assists 4 (1 at 4 each for W)", "Minutes 2 (90, 2 for 60+)", scoredUnderWords(PRICED_VERSION)]);
  });

  it("the arrow keys move the switch, as a radio group", async () => {
    openCard();
    const { season } = await seasonOf();
    await userEvent.click(season.getByRole("radio", { name: "CAM" }));
    await userEvent.keyboard("{ArrowRight}");
    expect((season.getByRole("radio", { name: "W" }) as HTMLInputElement).checked).toBe(true);
  });

  it("a player none of whose positions has a price yet is priced once, at his best, with no switch", async () => {
    openCard(AT_ONE, { cards: [{ ...AT_ONE, positions: ["SS"], pricedAt: [], matches: [AT_W] }] });
    const { season } = await seasonOf();
    expect(season.queryByRole("radiogroup", { name: pricedAtLabel })).toBeNull();
    expect(cellsOf(season)).toEqual(["2", "2–1", "90", "1", "1", "0", "11"]);
  });

  it("a match whose record hasn't arrived reads '—' and has no breakdown", async () => {
    openCard();
    const { season } = await seasonOf();

    expect(cellsOf(season, 0)).toEqual(["3", noFigureWords, noFigureWords, noFigureWords, noFigureWords, noFigureWords, noFigureWords]);
    // It is the newest, so selected as the card opens.
    expect(screen.queryByLabelText(breakdownLabel(3))).toBeNull();
  });

  it("a match where no category earned him points says so", async () => {
    const nothing = { ...AT_W, points: [{ ...AT_W.points[0], total: 0, categories: CATEGORIES.map((each) => ({ ...each, points: 0 })) }] };
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [nothing] }] });
    expect(await screen.findByText(nothingEarnedWords)).toBeTruthy();
  });

  it("a match his team started him in shows his base points, and his role's points apart, each side with what made it (#10)", async () => {
    // S05.2. Craig, 5 Nov 2026: "Poacher: +1 (+2: 1 goal in box, 1 shot on target in box; −1: 1 big chance missed)".
    const role = {
      name: "Poacher",
      points: 1,
      sides: [
        { points: 2, lines: [{ stat: "att_ibox_goal", name: "Goal in box", actions: 1 }, { stat: "att_ibox_target", name: "Shot on target in box", actions: 1 }] },
        { points: -1, lines: [{ stat: "big_chance_missed", name: "Big chance missed", actions: 1 }] },
      ],
    };
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [{ ...AT_W, role }] }] });
    expect((await screen.findByLabelText(roleLineLabel("Poacher"))).textContent).toBe(
      "Poacher: +1 (+2: 1 goal in box, 1 shot on target in box; −1: 1 big chance missed)",
    );
    expect(cellsOf(within(screen.getByRole("region", { name: SEASON_TITLE })))).toEqual(["2", "2–1", "90", "1", "1", "0", "11"]);
  });

  it("a match that cost him points shows the true minus in its total, breakdown and role line, never a hyphen (#564)", async () => {
    const role = { name: "Inside forward", points: -1, sides: [{ points: -1, lines: [{ stat: "big_chance_missed", name: "Big chance missed", actions: 1 }] }] };
    const categories = [category("minutes", "Minutes", 1), category("yellow_cards", "Yellow cards", -3, perAction(3, -1))];
    const booked = { ...AT_W, points: [{ position: "W" as const, total: -2, categories }], role };
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [booked] }] });
    const { season } = await seasonOf();

    expect(cellsOf(season).at(-1)).toBe("−2");
    expect(breakdownLines(2).slice(0, 2)).toEqual(["Minutes 1 (1 at 1 each)", "Yellow cards −3 (3 at −1 each)"]);
    expect(screen.getByLabelText(roleLineLabel("Inside forward")).textContent).toBe("Inside forward: −1 (−1: 1 big chance missed)");
  });

  it("a match whose points may still move is marked live, and the card says why (#577)", async () => {
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [{ ...AT_W, provisional: true }] }] });
    const { season } = await seasonOf();
    expect(cellsOf(season).at(-1)).toBe(`11${liveWords}`);
    // "Live" after the points, in the log and the breakdown alike, says why on hover.
    expect(screen.getAllByText(liveWords).map((live) => live.title)).toEqual([provisionalWords, provisionalWords]);
  });

  it("a final match has no live mark", async () => {
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [AT_W] }] });
    await seasonOf();
    expect(screen.queryByText(provisionalWords)).toBeNull();
    expect(screen.queryByText(liveWords)).toBeNull();
  });

  it("an overridden match shows no role line: the override is its whole score", async () => {
    const role = { name: "Inside forward", points: 2, sides: [] };
    const overridden = { ...AT_W, role, override: { points: 9, reason: "A goal the feed gave someone else" } };
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [overridden] }] });
    const { season } = await seasonOf();
    expect(screen.queryByLabelText(roleLineLabel("Inside forward"))).toBeNull();
    expect(cellsOf(season).at(-1)).toBe(`${overriddenWasWords(11)}9`);
  });

  it("a player with no matches this season says so", async () => {
    openCard(RICE);
    const { season } = await seasonOf();
    expect(season.getByText(noMatchesWords)).toBeTruthy();
  });
});

describe("the game log (#1027)", () => {
  it("names each match from his club's side, at home or away, and one from before he moved by both clubs", async () => {
    const away = { ...PRICED, fixtureCode: 5, gameweek: 4, home: CHELSEA, away: ARSENAL };
    const elsewhere = { ...PRICED, fixtureCode: 6, gameweek: 1, home: CHELSEA, away: COVENTRY };
    openCard(SAKA, { cards: [{ ...SAKA, matches: [away, PRICED, elsewhere] }] });
    const { season } = await seasonOf();

    expect(season.getAllByRole("rowheader").map((head) => head.textContent)).toEqual([`${CHELSEA.shortName} (A)`, PRICED_OPPONENT, `${CHELSEA.shortName} v ${COVENTRY.shortName}`]);
  });

  it("Scoring shows the categories that score at his position; All stats every stat his records hold", async () => {
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [AT_W] }] });
    const { panel, season } = await seasonOf();
    const views = within(season.getByRole("radiogroup", { name: logViewLabel }));
    expect((views.getByRole("radio", { name: logViews.scoring }) as HTMLInputElement).checked).toBe(true);
    // Clean sheets score at neither of his positions, so a winger never sees CS.
    expect(season.queryByRole("columnheader", { name: /Clean sheets/ })).toBeNull();

    await userEvent.click(views.getByRole("radio", { name: logViews.all }));
    expectColumnHeads(panel, [
      columns.gameweek,
      columns.opponent,
      columns.score,
      columns.minutes,
      { short: "AS", long: "Assists" },
      { short: "GSC", long: "Goals scored" },
      { short: "TOU", long: "Touches" },
      columns.points,
    ]);
    expect(cellsOf(season)).toEqual(["2", "2–1", "90", "1", "1", "54", "11"]);
  });

  it("a postponed match keeps its row by its gameweek, saying so", async () => {
    const postponed = { fixtureCode: 70, gameweek: 3, kickoff: null, home: CHELSEA, away: ARSENAL };
    const later = { ...PRICED, fixtureCode: 8, gameweek: 4 };
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [later, AT_W], postponed: [postponed] }] });
    const { season } = await seasonOf();

    const rows = season.getAllByRole("rowheader").map((head) => head.closest("tr")!.textContent);
    expect(rows[1]).toBe(`3${CHELSEA.shortName} (A)${postponedWords}`);
    expect(rows).toHaveLength(3);
  });

  it("the newest match is selected as the card opens, and selecting another shows its breakdown instead", async () => {
    const newest = { ...PRICED, fixtureCode: 8, gameweek: 3, home: CHELSEA, away: ARSENAL };
    openCard(AT_ONE, { cards: [{ ...AT_ONE, matches: [newest, AT_W] }] });
    const newestButton = await screen.findByRole("button", { name: `${CHELSEA.shortName} (A)` });
    expect(newestButton.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: `GW3, ${CHELSEA.shortName} (A) 2–1` })).toBeTruthy();

    await selectMatch();
    expect(screen.getByRole("button", { name: PRICED_OPPONENT }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: `GW2, ${PRICED_OPPONENT} 2–1` })).toBeTruthy();
    expect(screen.queryByLabelText(breakdownLabel(3))).toBeNull();
  });
});
