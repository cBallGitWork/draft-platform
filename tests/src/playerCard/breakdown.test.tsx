// A match's breakdown on the player card says why each category scored what it did (spec/14, On
// screen; #797): the stat, the rule's value for his area or position, a points limit or minutes
// rule that cut it, and the version of the site's scoring it was scored under. The words come
// from the scoring rows the server sends, never written apart from them.

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { playerCardPath } from "../../../src/playerCard/paths";
import type { PlayedMatch, PlayerCard } from "../../../src/playerCard/seam";
import { SEASON_TITLE, scoredUnderWords } from "../../../src/playerCard/words";
import { AT_ONE, AT_W, breakdownLines, category, perAction, type Why } from "../../support/src/playerCard.harness";
import { league, manager, openApp } from "../../support/src/shell.harness";

/** The card priced at one position, holding one match with these categories and version. */
function cardWith(categories: ReturnType<typeof category>[], version: string | null = "26_27.1"): PlayerCard {
  const match: PlayedMatch = { ...AT_W, version, points: [{ position: "CB", total: 0, categories }] };
  return { ...AT_ONE, matches: [match] };
}

async function linesOf(card: PlayerCard) {
  openApp(playerCardPath(league.leagueId, card.code), manager, { playerCard: { cards: [card] } });
  return breakdownLines(within(await screen.findByRole("region", { name: SEASON_TITLE })), AT_W.gameweek!);
}

const inDefence = (why: Why): Why => ({ ...why, pricedBy: { by: "area", area: "defence" } });

describe("each line says why", () => {
  it("a per-action rule priced by area: how many, at how much each, and for which area", async () => {
    expect(await linesOf(cardWith([category("goals_scored", "Goals scored", 12, inDefence(perAction(2, 6)))]))).toContain("Goals scored 12 (2 at 6 each for Defence)");
  });

  it("a per-count rule: how many, and the points for each whole number of them", async () => {
    const saves: Why = { actions: 7, value: { shape: "perCount", every: 3, points: 1 }, pricedBy: { by: "all" }, cut: null };
    expect(await linesOf(cardWith([category("saves", "Saves", 2, saves)]))).toContain("Saves 2 (7, 1 for every 3)");
  });

  it("stacked bands: each band he reached", async () => {
    const bands: Why = { actions: 14, value: { shape: "bands", earned: [{ atLeast: 10, points: 2 }, { atLeast: 12, points: 1 }] }, pricedBy: { by: "all" }, cut: null };
    expect(await linesOf(cardWith([category("defensive_contribution", "Defensive contribution", 3, bands)]))).toContain("Defensive contribution 3 (14, 2 for 10+ and 1 for 12+)");
  });

  it("a points limit that held his points says so", async () => {
    const held: Why = { actions: 14, value: { shape: "bands", earned: [{ atLeast: 10, points: 2 }, { atLeast: 12, points: 2 }] }, pricedBy: { by: "all" }, cut: { by: "max", limit: 2 } };
    expect(await linesOf(cardWith([category("defensive_contribution", "Defensive contribution", 2, held)]))).toContain(
      "Defensive contribution 2 (14, 2 for 10+ and 2 for 12+, held to at most 2)",
    );
  });

  it("a least limit says so, with the true minus", async () => {
    const floor: Why = { ...perAction(3, -2), cut: { by: "min", limit: -4 } };
    expect(await linesOf(cardWith([category("own_goals", "Own goals", -4, floor)]))).toContain("Own goals −4 (3 at −2 each, held to at least −4)");
  });

  it("a minutes rule that took his points away shows its line at 0, though it earned nothing", async () => {
    const short: Why = { ...inDefence(perAction(1, 4)), cut: { by: "minutes", atLeast: 60 } };
    expect(await linesOf(cardWith([category("clean_sheets", "Clean sheets", 0, short)]))).toContain("Clean sheets 0 (1 at 4 each for Defence, but none under 60 minutes)");
  });

  it("a rule priced by position names the position", async () => {
    const atCb: Why = { ...perAction(1, 3), pricedBy: { by: "position", position: "CB" } };
    expect(await linesOf(cardWith([category("assists", "Assists", 3, atCb)]))).toContain("Assists 3 (1 at 3 each for CB)");
  });
});

describe("the version it was scored under", () => {
  it("names the site's version", async () => {
    expect((await linesOf(cardWith([category("goals_scored", "Goals scored", 5)], "26_27.3"))).at(-1)).toBe(scoredUnderWords("26_27.3"));
    expect(scoredUnderWords("26_27.3")).toBe("Scored under version 26_27.3");
  });

  it("names the first scoring set before any version", async () => {
    expect((await linesOf(cardWith([category("goals_scored", "Goals scored", 5)], null))).at(-1)).toBe("Scored under the first scoring set");
  });
});
