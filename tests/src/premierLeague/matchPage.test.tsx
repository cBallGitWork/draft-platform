// The match page (#45; spec/10, The match page): one real match, live, opened from the Premier
// League's fixtures and from a player's status on the matchup: the score and clock, each club's
// team sheet with every owned man's team and points, and the commentary, newest first, saying
// when it is delayed.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HOUR_MS } from "../../../convex/shared/time";
import { MATCHUP_PATH, PREMIER_LEAGUE_PATH } from "../../../src/frame/menu";
import { statusLabels } from "../../../src/matchup/words";
import { matchPath } from "../../../src/premierLeague/paths";
import {
  commentaryDelayedWords,
  COMMENTARY_TITLE,
  fullTime,
  gameweekWords,
  halfTime,
  kickoffDayWords,
  loadingMatchWords,
  MATCH_TITLE,
  matchLinkLabel,
  noLinesWords,
  noMatchWords,
  scoreWords,
  versusWords,
} from "../../../src/premierLeague/words";
import { FIXTURE, matchOf, openMatch } from "../../support/src/matchPage.harness";
import { headToHead, slot, teamSide } from "../../support/src/matchup.harness";
import { ARSENAL, CHELSEA, plMatch } from "../../support/src/premierLeague.harness";
import { league, manager, openApp } from "../../support/src/shell.harness";

// The team sheets and team stats are matchSheets.test.tsx's.

describe("reaching it", () => {
  it("opens from a Premier League fixture's score, for the league the app is in", async () => {
    const begun = Date.now() - HOUR_MS;
    const app = openApp(PREMIER_LEAGUE_PATH, manager, {
      premierLeague: {
        firstKickoffs: [{ gameweek: 9, firstKickoff: begun }],
        matches: { 9: [plMatch(FIXTURE, ARSENAL, CHELSEA, begun, { state: "live", homeGoals: 2, awayGoals: 1, minutes: 67 })] },
        match: matchOf(),
      },
    });
    await userEvent.click(await screen.findByRole("link", { name: matchLinkLabel(ARSENAL.name, CHELSEA.name, scoreWords(2, 1)) }));

    expect(await screen.findByRole("heading", { level: 1, name: MATCH_TITLE })).toBeTruthy();
    expect(app.path()).toBe(matchPath(FIXTURE));
    expect(app.premierLeague.useMatch).toHaveBeenLastCalledWith(league.leagueId, FIXTURE);
    // Under the Premier League section, whose tab stays lit.
    expect(screen.getByRole("link", { name: "Premier League" }).getAttribute("data-status")).toBe("active");
  });

  it("opens from a player's status on the matchup, at his match", async () => {
    const app = openApp(MATCHUP_PATH, manager, {
      premierLeague: { match: matchOf() },
      matchup: {
        matchup: headToHead({
          kind: "scored",
          team: teamSide("Team 1", [slot("Saka", { status: { kind: "playing", fixtureCode: FIXTURE, minute: 67, clockLabel: "67'12" } })], []),
          opponent: teamSide("Team 2", [], []),
        }),
      },
    });
    await userEvent.click(await screen.findByRole("link", { name: `${statusLabels.playing} 67'` }));

    expect(await screen.findByRole("heading", { level: 1, name: MATCH_TITLE })).toBeTruthy();
    expect(app.path()).toBe(matchPath(FIXTURE));
    expect(app.premierLeague.useMatch).toHaveBeenLastCalledWith(league.leagueId, FIXTURE);
  });

  it("a man whose club has no match has no match to open", async () => {
    openApp(MATCHUP_PATH, manager, {
      matchup: { matchup: headToHead({ kind: "scored", team: teamSide("Team 1", [slot("Wood", { status: { kind: "noMatch" } })], []), opponent: teamSide("Team 2", [], []) }) },
    });
    expect(await screen.findByText(statusLabels.noMatch)).toBeTruthy();
    expect(screen.queryByRole("link", { name: new RegExp(statusLabels.noMatch) })).toBeNull();
  });

  it("a fixture before kickoff links from its v", async () => {
    const soon = Date.now() + HOUR_MS;
    openApp(PREMIER_LEAGUE_PATH, manager, {
      premierLeague: { firstKickoffs: [{ gameweek: 9, firstKickoff: soon }], matches: { 9: [plMatch(FIXTURE, ARSENAL, CHELSEA, soon)] } },
    });
    const link = await screen.findByRole("link", { name: matchLinkLabel(ARSENAL.name, CHELSEA.name, null) });
    expect(link.textContent).toBe(versusWords);
    expect(link.getAttribute("href")).toBe(matchPath(FIXTURE));
  });

  it("an address whose code isn't a number goes to the Premier League's fixtures", async () => {
    const app = openMatch({}, `${PREMIER_LEAGUE_PATH}/match/saka`);
    await screen.findByRole("heading", { level: 1, name: "Premier League" });
    expect(app.path()).toBe(PREMIER_LEAGUE_PATH);
  });

  it("says so while the match loads", async () => {
    openMatch({ loading: true });
    expect((await screen.findByRole("status")).textContent).toBe(loadingMatchWords);
  });

  it("says when no match with the code is held", async () => {
    openMatch({ match: null });
    expect(await screen.findByText(noMatchWords)).toBeTruthy();
  });
});

describe("the score and clock", () => {
  const scoreboard = async () => (await screen.findByRole("region", { name: "Score" })).textContent;

  it("live: the score and the clock's minute, and the gameweek", async () => {
    openMatch({ match: matchOf() });
    expect(await scoreboard()).toBe(`${ARSENAL.name}${scoreWords(2, 1)}${CHELSEA.name}67' (${gameweekWords(9)})`);
  });

  it("at half-time, says so", async () => {
    openMatch({ match: matchOf({ score: { state: "halfTime", homeGoals: 0, awayGoals: 0, minutes: 45, clockLabel: null } }) });
    expect(await scoreboard()).toContain(halfTime.long);
  });

  it("at full time, says so", async () => {
    openMatch({ match: matchOf({ score: { state: "fullTime", homeGoals: 1, awayGoals: 1, minutes: 90, clockLabel: null } }) });
    expect(await scoreboard()).toContain(`${scoreWords(1, 1)}${CHELSEA.name}${fullTime.long}`);
  });

  it("before kickoff: v and the day and time it kicks off", async () => {
    const kickoff = Date.now() + HOUR_MS;
    openMatch({ match: matchOf({ kickoff, score: null, men: [] }) });
    expect(await scoreboard()).toBe(`${ARSENAL.name}${versusWords}${CHELSEA.name}${kickoffDayWords(kickoff)} (${gameweekWords(9)})`);
  });
});

describe("the commentary", () => {
  it("every line, newest first, each with the points it moves", async () => {
    openMatch({ match: matchOf() });
    const list = await screen.findByRole("list", { name: COMMENTARY_TITLE });
    expect(within(list).getAllByRole("listitem").map((line) => line.textContent)).toEqual(["62' GOAL Saka, assist Ødegaard+5", "KO ARS v CHE"]);
    expect(screen.queryByText(commentaryDelayedWords)).toBeNull();
  });

  it("says Commentary delayed when the stream falls behind", async () => {
    openMatch({ match: matchOf({ commentary: { kind: "read", lines: [], delayed: true } }) });
    expect((await screen.findByText(commentaryDelayedWords)).getAttribute("role")).toBe("status");
    expect(screen.getByText(noLinesWords)).toBeTruthy();
  });
});
