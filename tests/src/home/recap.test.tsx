// League home's weekly recap (#387; spec/12, League home): its panel in the right-hand column, its
// opening lines and Read the recap, which opens the recap whole on its own page; and, once a score
// has changed since it was written, the line under it linking to that matchup (Craig, 6 Nov 2026).

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { HOME_PATH, MATCHUP_PATH } from "../../../src/frame/menu";
import { RECAP_PATH } from "../../../src/home/paths";
import {
  backHomeLink,
  changedMatchupLink,
  loadingRecapWords,
  noRecapWords,
  readRecapLink,
  recapTitle,
  recapToComeWords,
  scoreChangedWords,
  SQUAD_NEWS_TITLE,
} from "../../../src/home/words";
import { gameweekOneRecap, quietHome, type HomeData } from "../../support/src/home.harness";
import { league, manager, openApp } from "../../support/src/shell.harness";

const TITLE = recapTitle(gameweekOneRecap.gameweek);
const panel = (title: string) => screen.findByRole("region", { name: title });
const openHome = (home: HomeData) => openApp(HOME_PATH, manager, { home });
const openRecap = (gameweek: number, home: HomeData = {}) => openApp(`${RECAP_PATH}?gameweek=${gameweek}`, manager, { home });
const changed = { ...gameweekOneRecap, changedTeamId: "team-2" as Id<"teams"> };

describe("on League home", () => {
  it("shows its opening lines above Your squad news, and Read the recap opens it whole", async () => {
    const app = openHome({ leagueHome: { ...quietHome, recap: gameweekOneRecap }, recaps: [gameweekOneRecap] });
    const recap = await panel(TITLE);
    expect(within(recap).getByText(/Team 1 beat Team 2/)).toBeTruthy();
    expect(recap.compareDocumentPosition(await panel(SQUAD_NEWS_TITLE)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(recap).queryByText(scoreChangedWords)).toBeNull();

    await userEvent.click(within(recap).getByRole("link", { name: readRecapLink }));
    expect(app.path()).toBe(RECAP_PATH);
    expect(await screen.findByRole("heading", { level: 1, name: TITLE })).toBeTruthy();
    expect(app.home.useRecap).toHaveBeenLastCalledWith(league.leagueId, gameweekOneRecap.gameweek);
  });

  it("with none to show, its panel holds outlines, with no Read the recap", async () => {
    openHome({ leagueHome: quietHome });
    const recap = await panel(TITLE);
    expect(within(recap).getByText(recapToComeWords(gameweekOneRecap.gameweek))).toBeTruthy();
    expect(within(recap).queryByRole("link", { name: readRecapLink })).toBeNull();
  });

  it("once a score has changed since, a line under it says so and opens that team's matchup", async () => {
    const app = openHome({ leagueHome: { ...quietHome, recap: changed } });
    const recap = await panel(TITLE);
    expect(within(recap).getByText(scoreChangedWords)).toBeTruthy();

    await userEvent.click(within(recap).getByRole("link", { name: changedMatchupLink }));
    expect(app.path()).toBe(MATCHUP_PATH);
  });
});

describe("Read the recap's page", () => {
  it("shows the recap whole, and leads back to League home", async () => {
    const app = openRecap(1, { recaps: [gameweekOneRecap] });
    expect(await screen.findByText(/Saka scored 15\./)).toBeTruthy();
    expect(screen.queryByText(scoreChangedWords)).toBeNull();

    await userEvent.click(screen.getByRole("link", { name: backHomeLink }));
    expect(app.path()).toBe(HOME_PATH);
  });

  it("says when a score has changed since", async () => {
    openRecap(1, { recaps: [changed] });
    expect(await screen.findByText(scoreChangedWords)).toBeTruthy();
    expect(screen.getByRole("link", { name: changedMatchupLink })).toBeTruthy();
  });

  it("says so while it loads", async () => {
    openRecap(1, { loading: true });
    expect(await screen.findByText(loadingRecapWords)).toBeTruthy();
  });

  it("says so when the gameweek has none", async () => {
    openRecap(2, { recaps: [gameweekOneRecap] });
    expect(await screen.findByText(noRecapWords(2))).toBeTruthy();
  });

  it("with no gameweek named, goes to League home", async () => {
    const app = openApp(RECAP_PATH, manager);
    await screen.findByRole("heading", { level: 1, name: league.name });
    expect(app.path()).toBe(HOME_PATH);
  });
});
