// The match page's player panel (#2493; spec/10 S10.9: "a player's panel opens on the right when
// he's clicked (this match's breakdown, then his card)"; the approved picture's Saka panel).

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { matchPath } from "../../../src/premierLeague/paths";
import { lineupViewLabel, lineupViewWords, manPanelLabel, manPanelWords, matchPitchLabel, matchStatColumns, noFigureWords, provWords, sheetLabel } from "../../../src/premierLeague/words";
import { FIXTURE, man, matchOf, MEN, openMatch } from "../../support/src/matchPage.harness";
import { ARSENAL, CHELSEA } from "../../support/src/premierLeague.harness";
import { THEIR_TEAM_NAME } from "../../support/src/teams.harness";

const NONE = { minutes: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, shotsBlocked: 0, hitWoodwork: 0, bigChancesMissed: 0, keyPasses: 0, tackles: 0, cleanSheets: 0, goalsConceded: 0, saves: 0, yellowCards: 0, redCards: 0 };

/** Saka, as the approved picture has him: 67 minutes, a goal and an assist. */
const PICKED = man(2, "Saka", "home", {
  ownerTeamName: THEIR_TEAM_NAME,
  points: 10,
  marks: { goals: 1, assists: 1, yellowCards: 0, redCards: 0 },
  statLine: { ...NONE, minutes: 67, goals: 1, assists: 1, shots: 3 },
  statPoints: { ...NONE, minutes: 2, goals: 5, assists: 3 },
  formationPlace: { formation: "4-3-3", line: 3, place: 0 },
});
const PICKED_MATCH = matchOf({ men: MEN.map((each) => (each.playerCode === PICKED.playerCode ? PICKED : each)) });

const panelOf = () => screen.queryByRole("table", { name: manPanelLabel(PICKED.name) });

test("S10.9: clicking a man's name on a sheet opens his panel, his stats' points and his total, with His card to his card", async () => {
  openMatch({ match: PICKED_MATCH });
  const arsenal = await screen.findByRole("table", { name: sheetLabel(ARSENAL.name) });
  expect(panelOf()).toBeNull();
  await userEvent.click(within(arsenal).getByRole("button", { name: "Saka" }));

  const rows = within(panelOf()!).getAllByRole("row").map((row) => within(row).queryAllByRole("rowheader").concat(within(row).queryAllByRole("cell")).map((cell) => cell.textContent));
  // Shots earned him nothing but he had three, so it shows; every stat he had none of is left out.
  expect(rows.slice(1)).toEqual([
    [matchStatColumns.minutes.long, "67", "+2"],
    [matchStatColumns.goals.long, "1", "+5"],
    [matchStatColumns.assists.long, "1", "+3"],
    [matchStatColumns.shots.long, "3", noFigureWords],
    [manPanelWords.total, `${provWords}10`],
  ]);
  expect(panelOf()!.closest("section")!.textContent).toContain(THEIR_TEAM_NAME);
  expect(screen.getByRole("link", { name: manPanelWords.hisCard }).getAttribute("href")).toMatch(new RegExp(`/players/${PICKED.playerCode}$`));
});

test("S10.9: the picked man's row has the cyan bar, and the address keeps him, so a reload opens his panel again", async () => {
  openMatch({ match: PICKED_MATCH }, `${matchPath(FIXTURE)}?player=${PICKED.playerCode}`);
  const arsenal = await screen.findByRole("table", { name: sheetLabel(ARSENAL.name) });
  expect(panelOf()).toBeTruthy();
  expect(within(arsenal).getByRole("button", { name: "Saka" }).getAttribute("aria-expanded")).toBe("true");
  expect(within(arsenal).getByRole("button", { name: "Saka" }).closest("tr")!.className).toContain("aria-current:shadow-current-edge");
  expect(within(arsenal).getByRole("button", { name: "Saka" }).closest("tr")!.getAttribute("aria-current")).toBe("true");
  expect(within(arsenal).getByRole("button", { name: "Raya" }).closest("tr")!.getAttribute("aria-current")).toBeNull();

  // Another man's name swaps the panel to him.
  await userEvent.click(within(screen.getByRole("table", { name: sheetLabel(CHELSEA.name) })).getByRole("button", { name: "Palmer" }));
  expect(await screen.findByRole("table", { name: manPanelLabel("Palmer") })).toBeTruthy();
  expect(panelOf()).toBeNull();
});

test("S10.9: a man's name on the pitch opens his panel too", async () => {
  openMatch({ match: PICKED_MATCH });
  const views = await screen.findByRole("radiogroup", { name: lineupViewLabel });
  await userEvent.click(within(views).getByRole("radio", { name: lineupViewWords.pitch }));
  const pitch = screen.getByRole("list", { name: matchPitchLabel(ARSENAL.name, CHELSEA.name) });
  await userEvent.click(within(pitch).getByText("Saka"));
  expect(panelOf()).toBeTruthy();
});
