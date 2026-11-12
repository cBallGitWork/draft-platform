// A real club's page under Football (#1936; spec/18, Club pages): its name links to it wherever it
// shows, its mark doesn't (`S18.6`); its header has its table place, last five results and next
// match as an opponent card (`S18.7`); its Fixtures tab lists its season's matches, each opening its
// match page, with no difficulty colours (`S18.9`).

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DAY_MS, HOUR_MS } from "../../../convex/shared/time";
import { PREMIER_LEAGUE_PATH } from "../../../src/frame/menu";
import { formLabel } from "../../../src/shared/words";
import { clubPath, matchPath } from "../../../src/premierLeague/paths";
import type { ClubPageData, ClubPageFixture } from "../../../src/premierLeague/seam";
import {
  clubTabWords,
  daysAwayWords,
  kickoffDayWords,
  MATCH_TITLE,
  NEXT_MATCH_TITLE,
  noClubWords,
  noNextMatchWords,
  scoreWords,
  TABLE_TITLE,
} from "../../../src/premierLeague/words";
import { ARSENAL, CHELSEA, FOREST, plMatch, SPURS, standingsRow, type PremierLeagueData } from "../../support/src/premierLeague.harness";
import { manager, openApp } from "../../support/src/shell.harness";

const fullTimeScore = (homeGoals: number, awayGoals: number) => ({ state: "fullTime" as const, homeGoals, awayGoals, minutes: 90, clockLabel: null });

/** A match of Arsenal's from their side. */
const arsenalMatch = (fixtureCode: number, gameweek: number, atHome: boolean, opponent: ClubPageFixture["opponent"], kickoff: number, score: ClubPageFixture["score"] = null): ClubPageFixture => ({
  fixtureCode,
  gameweek,
  kickoff,
  atHome,
  opponent,
  score,
});

const lastWeek = Date.now() - 7 * DAY_MS;
// Noon three days on, so it is three calendar days away whenever the tests run.
const inThreeDays = new Date(Date.now() + 3 * DAY_MS).setHours(12, 0, 0, 0);

const arsenal: ClubPageData = {
  club: ARSENAL,
  position: 1,
  form: ["won", "drawn"],
  next: { ...arsenalMatch(30, 3, false, SPURS, inThreeDays), kickoff: inThreeDays, opponentPosition: 4, opponentForm: ["lost"] },
  fixtures: [
    arsenalMatch(10, 1, true, CHELSEA, lastWeek, fullTimeScore(2, 1)),
    arsenalMatch(20, 2, false, FOREST, lastWeek + HOUR_MS, fullTimeScore(1, 1)),
    arsenalMatch(30, 3, false, SPURS, inThreeDays),
  ],
};

const openClub = (premierLeague: PremierLeagueData) => openApp(clubPath(ARSENAL.code), manager, { premierLeague });

describe("reaching it", () => {
  it("opens from a club's name on the Football table, and its fixture opens the match page", async () => {
    const app = openApp(PREMIER_LEAGUE_PATH, manager, {
      premierLeague: { standings: { rows: [standingsRow(1, ARSENAL)], provisional: false }, club: arsenal, match: null },
    });
    const table = await screen.findByRole("region", { name: TABLE_TITLE });
    const row = within(table).getAllByRole("row")[1];
    // The name is the link; the mark beside it isn't in it.
    const link = within(row).getByRole("link");
    expect(link.querySelector("[data-club-mark]")).toBeNull();
    expect(row.querySelector("[data-club-mark]")!.closest("a")).toBeNull();
    await userEvent.click(link);

    expect(app.path()).toBe(clubPath(ARSENAL.code));
    expect(await screen.findByRole("heading", { level: 1, name: ARSENAL.name })).toBeTruthy();
    expect(app.premierLeague.useClub).toHaveBeenLastCalledWith(expect.anything(), ARSENAL.code);

    const fixtures = screen.getByRole("region", { name: clubTabWords.fixtures });
    await userEvent.click(within(fixtures).getAllByRole("row")[1].querySelector(`a[href="${matchPath(10)}"]`)!);
    expect(await screen.findByRole("heading", { level: 1, name: MATCH_TITLE })).toBeTruthy();
    expect(app.path()).toBe(matchPath(10));
  });

  it("opens from a club's name in a gameweek's fixtures", async () => {
    const app = openApp(PREMIER_LEAGUE_PATH, manager, {
      premierLeague: { firstKickoffs: [{ gameweek: 1, firstKickoff: lastWeek }], matches: { 1: [plMatch(10, ARSENAL, CHELSEA, lastWeek)] }, club: arsenal },
    });
    const names = await screen.findAllByRole("link", { name: new RegExp(`^${ARSENAL.name}`) });
    await userEvent.click(names[0]);
    expect(app.path()).toBe(clubPath(ARSENAL.code));
  });

  it("says when no club with the code is held", async () => {
    openClub({ club: null });
    expect(await screen.findByText(noClubWords)).toBeTruthy();
  });
});

describe("the header", () => {
  it("has the club's table place and form, and its next match as an opponent card", async () => {
    openClub({ club: arsenal });
    expect(await screen.findByText("1st")).toBeTruthy();
    expect(screen.getAllByRole("img", { name: formLabel(["won", "drawn"]) })).toHaveLength(1);

    const card = screen.getByRole("region", { name: NEXT_MATCH_TITLE });
    expect(within(card).getByRole("link", { name: new RegExp(SPURS.name) }).getAttribute("href")).toBe(clubPath(SPURS.code));
    expect(within(card).getByText("4th")).toBeTruthy();
    expect(within(card).getByRole("img", { name: formLabel(["lost"]) })).toBeTruthy();
    expect(within(card).getByRole("link", { name: kickoffDayWords(inThreeDays) }).getAttribute("href")).toBe(matchPath(30));
    expect(within(card).getByText(daysAwayWords(inThreeDays, Date.now()))).toBeTruthy();
    expect(daysAwayWords(inThreeDays, Date.now())).toBe("In 3 days");
  });

  it("says so when the club has no match to come", async () => {
    openClub({ club: { ...arsenal, next: null } });
    expect(within(await screen.findByRole("region", { name: NEXT_MATCH_TITLE })).getByText(noNextMatchWords)).toBeTruthy();
  });
});

describe("the Fixtures tab", () => {
  it("lists each match with its gameweek, the opponent home or away, and its result from the club's side or its kick-off", async () => {
    openClub({ club: arsenal });
    const fixtures = await screen.findByRole("region", { name: clubTabWords.fixtures });
    const lines = within(fixtures)
      .getAllByRole("row")
      .slice(1)
      .map((row) => [...row.children].map((cell) => cell.textContent));
    expect(lines).toEqual([
      ["GW1", `${CHELSEA.name}${CHELSEA.shortName} (H)`, `W${scoreWords(2, 1)}`],
      ["GW2", `${FOREST.name}${FOREST.shortName} (A)`, `D${scoreWords(1, 1)}`],
      ["GW3", `${SPURS.name}${SPURS.shortName} (A)`, kickoffDayWords(inThreeDays)],
    ]);
  });

  it("gives an away win the club's goals first, and its link names the match home side first", async () => {
    openClub({ club: { ...arsenal, fixtures: [arsenalMatch(40, 4, false, CHELSEA, lastWeek, fullTimeScore(0, 3))] } });
    const fixtures = await screen.findByRole("region", { name: clubTabWords.fixtures });
    const link = within(fixtures).getByRole("link", { name: `${CHELSEA.name} ${scoreWords(0, 3)} ${ARSENAL.name}: the match` });
    expect(link.textContent).toBe(`W${scoreWords(3, 0)}`);
  });
});
