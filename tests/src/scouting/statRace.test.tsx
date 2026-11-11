// Scouting's Stat race tab (#800, spec/19 The stat race; docs/design/approved/scouting/
// 1440-stat-race.png): every team's season totals as raw counts, ranked by the category picked,
// the selected team's every category with its rank on the right, and where a mid-season league's
// totals start.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { categoryName, categoryShortCode } from "../../../convex/scoring/categories";
import { countsWhatCountedWords, rankByLabel, rankWords, raceLoadingWords, scoutingTabWords, sinceWords, STAT_RACE_TITLE } from "../../../src/scouting/words";
import { sortLabelOf } from "../../support/src/columnHeads";
import type { ScoutingData } from "../../support/src/scouting.harness";
import { HELD, openScouting } from "../../support/src/scoutingScreen.harness";
import { league } from "../../support/src/shell.harness";

const team = (name: string, stats: Record<string, number>) => ({ teamId: `team-${name}` as Id<"teams">, name, stats });
// The manager's own team is league.teamName ("Team 1").
const RACE: NonNullable<ScoutingData["race"]> = {
  categories: ["goals_scored", "clean_sheets", "red_cards"],
  since: null,
  teams: [team(league.teamName!, { goals_scored: 3, clean_sheets: 7 }), team("Kroos Control", { goals_scored: 5, clean_sheets: 2 }), team("Rovers XI", { goals_scored: 3 })],
};

async function openRace(race: ScoutingData["race"] = RACE) {
  const app = openScouting({ ...HELD, race });
  await userEvent.click(await screen.findByRole("button", { name: scoutingTabWords.statRace }));
  return app;
}

const racePanel = () => screen.getByRole("region", { name: STAT_RACE_TITLE });
const teamsShown = () =>
  within(within(racePanel()).getByRole("table"))
    .getAllByRole("rowheader")
    .map((cell) => cell.textContent);
const rowOf = (name: string) => within(racePanel()).getByRole("rowheader", { name }).closest("tr")!;
const cellsOf = (name: string) => within(rowOf(name)).getAllByRole("cell").map((cell) => cell.textContent);

it("the Stat race tab ranks every team by goals at first, raw counts in every category, a level team sharing a rank", async () => {
  const app = await openRace();

  expect(teamsShown()).toEqual(["Kroos Control", "Rovers XI", league.teamName]);
  expect(cellsOf("Kroos Control")).toEqual(["1", "5", "2", "0"]);
  expect(cellsOf("Rovers XI")).toEqual(["2", "3", "0", "0"]);
  expect(cellsOf(league.teamName!)).toEqual(["2", "3", "7", "0"]);
  expect(within(racePanel()).getByText(countsWhatCountedWords)).toBeTruthy();
  expect(app.scouting.useStatRace.mock.lastCall!.slice(0, 2)).toEqual([league.leagueId, "goals_scored"]);
});

it("Rank by, or a category's head, ranks the teams by that category", async () => {
  await openRace();

  await userEvent.selectOptions(within(racePanel()).getByLabelText(rankByLabel), categoryName("clean_sheets"));
  expect(teamsShown()).toEqual([league.teamName, "Kroos Control", "Rovers XI"]);

  const goals = { short: categoryShortCode("goals_scored"), long: categoryName("goals_scored") };
  await userEvent.click(within(racePanel()).getByRole("button", { name: sortLabelOf(goals) }));
  expect(teamsShown()).toEqual(["Kroos Control", "Rovers XI", league.teamName]);
});

it("the right column opens on the manager's own team, every category with its rank, and a team clicked takes its place", async () => {
  await openRace();

  const mine = screen.getByRole("region", { name: league.teamName! });
  expect(within(mine).getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual([
    `${categoryName("goals_scored")}3${rankWords(2, 3)}`,
    `${categoryName("clean_sheets")}7${rankWords(1, 3)}`,
    `${categoryName("red_cards")}0${rankWords(1, 3)}`,
  ]);

  await userEvent.click(within(racePanel()).getByRole("button", { name: "Kroos Control" }));
  const theirs = screen.getByRole("region", { name: "Kroos Control" });
  expect(within(theirs).getAllByRole("row")[1].textContent).toBe(`${categoryName("goals_scored")}5${rankWords(1, 3)}`);
  expect(screen.queryByRole("region", { name: league.teamName! })).toBeNull();
});

it("a stat where fewer is better ranks the team with fewest 1st, in the table and the team's panel (#1608)", async () => {
  await openRace({ ...RACE, teams: [...RACE.teams, team("Red Army", { red_cards: 3 })] });

  await userEvent.selectOptions(within(racePanel()).getByLabelText(rankByLabel), categoryName("red_cards"));
  expect(teamsShown()).toEqual(["Kroos Control", "Rovers XI", league.teamName, "Red Army"]);
  expect(cellsOf(league.teamName!)[0]).toBe("1");
  expect(cellsOf("Red Army")[0]).toBe("4");

  await userEvent.click(within(racePanel()).getByRole("button", { name: "Red Army" }));
  const theirs = screen.getByRole("region", { name: "Red Army" });
  expect(within(theirs).getAllByRole("row")[3].textContent).toBe(`${categoryName("red_cards")}3${rankWords(4, 4)}`);
});

it("a league that began after gameweek 1 says where its totals start", async () => {
  await openRace({ ...RACE, since: 10 });
  expect(within(racePanel()).getByText(sinceWords(10))).toBeTruthy();
});

it("says nothing of a start for a league that began at gameweek 1", async () => {
  await openRace();
  expect(within(racePanel()).queryByText(/^Since GW/)).toBeNull();
});

it("says it is loading until the race comes", async () => {
  openScouting(HELD);
  await userEvent.click(await screen.findByRole("button", { name: scoutingTabWords.statRace }));
  expect(within(racePanel()).getByText(raceLoadingWords)).toBeTruthy();
});
