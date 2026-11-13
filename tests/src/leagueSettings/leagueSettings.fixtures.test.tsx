// League settings' Fixtures tab (#1034, docs/design/approved/settings/1440.png): the format, double
// gameweeks, the deadline and the table's tie-breaks, saved with the rest of the settings. The
// odd team out and games a gameweek are leagueSettings.test.tsx's; the scoring start,
// leagueSettings.scoringStart.test.tsx's.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { LeagueSettings } from "../../../convex/rules/leagueSettingsPart";
import {
  blankDeadlineWords,
  deadlineHint,
  deadlineLabel,
  doubleGameweekWords,
  formatHint,
  formatWords,
  moveDownLabel,
  moveUpLabel,
  tieBreaksLabel,
  tieBreakWords,
} from "../../../src/leagueSettings/words";
import { descriptionOf, refusalBeside } from "../../support/src/describedBy";
import { REVISION } from "../../support/src/leagueSettings.harness";
import { box, fill, FIRST_SETTINGS, openedSettings, save, savedSettings } from "../../support/src/leagueSettingsScreen.harness";
import { CHANGES_FROM } from "../../support/src/scoring.harness";

const radio = (name: string) => screen.getByRole("radio", { name }) as HTMLInputElement;
const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;
const withSettings = (part: Partial<LeagueSettings>) => ({ view: { part: { ...FIRST_SETTINGS, ...part }, revision: REVISION, changesFrom: CHANGES_FROM } });
/** The tie-breaks' names as listed, top first. */
const shownOrder = () =>
  within(screen.getByRole("list", { name: tieBreaksLabel }))
    .getAllByRole("listitem")
    .map((item) => Object.values(tieBreakWords).find((words) => item.textContent?.includes(words)));
/** Every tie-break, in the order the league holds them. */
const THREE = { tieBreaks: ["pointsFor", "headToHead", "pointsAgainst"] } as const satisfies Partial<LeagueSettings>;

describe("the format and double gameweeks", () => {
  it("open on a new league's, head-to-head with both matches counting, saying when the format locks", async () => {
    await openedSettings();

    expect(radio(formatWords.headToHead).checked).toBe(true);
    expect(radio(doubleGameweekWords.bothMatches).checked).toBe(true);
    expect(screen.getByText(formatHint)).toBeTruthy();
  });

  it("save total points and best match with the rest of the settings", async () => {
    const app = await openedSettings();
    await userEvent.click(radio(formatWords.totalPoints));
    await userEvent.click(radio(doubleGameweekWords.bestMatch));
    await save();

    expect(savedSettings(app)).toEqual({ ...FIRST_SETTINGS, format: "totalPoints", doubleGameweek: "bestMatch" });
  });
});

describe("the deadline", () => {
  it("shows the league's minutes, its box described by its hint, and saves a change", async () => {
    const app = await openedSettings();
    expect(box(deadlineLabel).value).toBe(String(FIRST_SETTINGS.deadline.minutesBeforeFirstKickoff));
    expect(descriptionOf(box(deadlineLabel))).toBe(deadlineHint);
    await fill(deadlineLabel, "90");
    await save();

    expect(savedSettings(app).deadline).toEqual({ minutesBeforeFirstKickoff: 90 });
  });

  it("left empty, isn't sent, and says so beside its box", async () => {
    const app = await openedSettings();
    await fill(deadlineLabel, "");
    await save();

    expect(app.leagueSettings.save).not.toHaveBeenCalled();
    expect(refusalBeside(box(deadlineLabel))).toBe(blankDeadlineWords);
  });
});

describe("the tie-breaks", () => {
  it("list the league's in order, the first's Up and the last's Down off", async () => {
    await openedSettings(withSettings(THREE));

    expect(shownOrder()).toEqual(THREE.tieBreaks.map((tieBreak) => tieBreakWords[tieBreak]));
    expect(button(moveUpLabel(tieBreakWords.pointsFor)).disabled).toBe(true);
    expect(button(moveDownLabel(tieBreakWords.pointsFor)).disabled).toBe(false);
    expect(button(moveDownLabel(tieBreakWords.pointsAgainst)).disabled).toBe(true);
  });

  it("save in the order the commissioner moves them to", async () => {
    const app = await openedSettings(withSettings(THREE));
    await userEvent.click(button(moveUpLabel(tieBreakWords.pointsAgainst)));
    await userEvent.click(button(moveDownLabel(tieBreakWords.pointsFor)));
    const moved = ["pointsAgainst", "pointsFor", "headToHead"] as const;
    expect(shownOrder()).toEqual(moved.map((tieBreak) => tieBreakWords[tieBreak]));
    await save();

    expect(savedSettings(app).tieBreaks).toEqual(moved);
  });
});
