// The match page's List | Pitch switch on Overview (#2492; spec/10 S10.9; the approved picture
// `1440-pitch.png`): both starting elevens on one pitch at their places in their formations, each
// side's substitutes on its sheet beside it. The sheets themselves are matchSheets.test.tsx's.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import {
  lineupViewLabel,
  lineupViewWords,
  markLabels,
  matchPitchLabel,
  sheetLabel,
  sideFormationWords,
  SUBSTITUTES_TITLE,
} from "../../../src/premierLeague/words";
import { man, matchOf, openMatch } from "../../support/src/matchPage.harness";
import { ARSENAL, CHELSEA } from "../../support/src/premierLeague.harness";
import { MY_TEAM_NAME } from "../../support/src/teams.harness";

const placedAt = (line: number, place: number) => ({ formationPlace: { formation: "4-3-3", line, place } });

/** Arsenal placed by a 4-3-3 sheet, Raya in goal and two along the back from the right; Chelsea's
 *  sheet drew no formation. */
const PLACED_MEN = [
  man(1, "Raya", "home", { ...placedAt(0, 0), position: "GK", ownerTeamName: MY_TEAM_NAME, points: 2 }),
  man(2, "Timber", "home", { ...placedAt(1, 0), points: 3 }),
  man(3, "Calafiori", "home", { ...placedAt(1, 1), marks: { goals: 1, assists: 0, yellowCards: 1, redCards: 0 }, points: 6 }),
  man(4, "Eze", "home", { started: false, played: true, points: 1 }),
  man(5, "Palmer", "away", { points: 7 }),
];

/** The match page opened on Overview with Pitch chosen. */
async function openPitch() {
  openMatch({ match: matchOf({ men: PLACED_MEN }) });
  const views = await screen.findByRole("radiogroup", { name: lineupViewLabel });
  expect(within(views).getByRole("radio", { name: lineupViewWords.list, checked: true })).toBeTruthy();
  await userEvent.click(within(views).getByRole("radio", { name: lineupViewWords.pitch }));
  return screen.getByRole("list", { name: matchPitchLabel(ARSENAL.name, CHELSEA.name) });
}

const pitchMan = (pitch: HTMLElement, name: string) => within(pitch).getByText(name).closest("li")!;

test("S10.9: Pitch stands each starter the sheets placed on one pitch, with his marks and points, and lists his side's substitutes beside it", async () => {
  const pitch = await openPitch();
  expect(within(pitch).getAllByRole("listitem").map((each) => each.textContent)).toEqual(["Raya2", "Timber3", "Calafiori6"]);
  expect(within(pitchMan(pitch, "Calafiori")).getAllByRole("img").map((mark) => mark.getAttribute("aria-label"))).toEqual([markLabels.goals, markLabels.yellowCards]);

  const arsenal = screen.getByRole("table", { name: sheetLabel(ARSENAL.name) });
  expect(within(arsenal).queryByRole("rowheader", { name: "Raya" })).toBeNull();
  expect(within(arsenal).getByText(SUBSTITUTES_TITLE)).toBeTruthy();
  expect(within(arsenal).getByRole("rowheader", { name: /^Eze/ })).toBeTruthy();
  // No sheet drew Chelsea's formation, so Palmer stays on its list.
  expect(within(screen.getByRole("table", { name: sheetLabel(CHELSEA.name) })).getByRole("rowheader", { name: "Palmer" })).toBeTruthy();
});

test("S10.9: home stands at the bottom, its keeper on its goal line and its places from its right; the head names each side's formation", async () => {
  const pitch = await openPitch();
  expect(pitchMan(pitch, "Raya").style.top).toBe("95%");
  expect(pitchMan(pitch, "Timber").style.left).toBe("75%");
  expect(pitchMan(pitch, "Calafiori").style.left).toBe("25%");
  expect(screen.getByText(sideFormationWords(ARSENAL.name, "4-3-3"))).toBeTruthy();
  // Chelsea's sheet drew no formation, so the pitch's head names it alone, as its sheet's plate does.
  expect(screen.getAllByRole("heading", { name: sideFormationWords(CHELSEA.name, null) })).toHaveLength(2);
});

// "your own players highlighted" (Craig, 10 Nov 2026, on #1032): on the pitch, a cyan underline.
test("S10.9: the viewer's own men have the cyan underline on the pitch, and only theirs", async () => {
  const pitch = await openPitch();
  expect(within(pitchMan(pitch, "Raya")).getByText("Raya").className).toContain("shadow-subtab-active");
  expect(within(pitchMan(pitch, "Timber")).getByText("Timber").className).not.toContain("shadow-subtab-active");
});
