// The Premier League section's fixtures and results (#49; spec/18, Fixtures and results): its own
// section of the menu; one gameweek at a time under the ◄ GW ► stepper, opening on the current
// gameweek; live scores; no fixture difficulty and no count of owned players.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { GAMEWEEKS } from "../../../convex/gameweeks/usedGameweeks";
import { DAY_MS, HOUR_MS, WEEK_MS } from "../../../convex/shared/time";
import { MY_TEAM_PATH, PREMIER_LEAGUE_PATH } from "../../../src/frame/menu";
import { menuWords } from "../../../src/frame/words";
import type { GameweekMatch } from "../../../src/premierLeague/seam";
import {
  dayWords,
  FIXTURES_TITLE,
  fullTime,
  gameweekWords,
  halfTime,
  kickoffWords,
  liveWords,
  loadingGameweekWords,
  loadingWords,
  matchesListLabel,
  noDateWords,
  noMatchesWords,
  PREMIER_LEAGUE_TITLE,
  scoreWords,
  versusWords,
} from "../../../src/premierLeague/words";
import { nextGameweekLabel, previousGameweekLabel } from "../../../src/shared/words";
import { ARSENAL, CHELSEA, FOREST, plMatch, SPURS, type PremierLeagueData } from "../../support/src/premierLeague.harness";
import { manager, openApp } from "../../support/src/shell.harness";

const openSection = (premierLeague: PremierLeagueData = {}) => openApp(PREMIER_LEAGUE_PATH, manager, { premierLeague });

/** Gameweeks 8 and 9 kicked off (9 an hour ago); 10 kicks off in a week. */
const begun = Date.now() - HOUR_MS;
const kickoffsTo10 = [
  { gameweek: 8, firstKickoff: begun - WEEK_MS },
  { gameweek: 9, firstKickoff: begun },
  { gameweek: 10, firstKickoff: begun + WEEK_MS },
];

const stepperHeading = () => screen.findByRole("heading", { level: 3 });
const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

/** Each match row of the gameweek shown as its four cells: where it stands, the home club, the
 *  score or "v", and the away club (each club by its full name, the desk's). */
async function matchLines(gameweek: number) {
  const group = await screen.findByRole("group", { name: matchesListLabel(gameweek) });
  return within(group)
    .getAllByRole("listitem")
    .map((row) => [...row.children].map((cell, index) => (index === 1 || index === 3 ? cell.firstElementChild!.textContent : cell.textContent)));
}

describe("reaching it", () => {
  it("is its own section of the menu, opened by anyone in a league", async () => {
    const app = openApp(MY_TEAM_PATH, manager, { premierLeague: { firstKickoffs: kickoffsTo10 } });
    await userEvent.click(await screen.findByRole("link", { name: menuWords.premierLeague }));

    expect(await screen.findByRole("heading", { level: 1, name: PREMIER_LEAGUE_TITLE })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: FIXTURES_TITLE })).toBeTruthy();
    expect(app.path()).toBe(PREMIER_LEAGUE_PATH);
  });

  it("says so while the gameweeks load", async () => {
    openSection({ loading: true });
    expect(within(await screen.findByRole("region", { name: FIXTURES_TITLE })).getByRole("status").textContent).toBe(loadingWords);
  });

  it("says so while a gameweek's matches load", async () => {
    const app = openSection({ firstKickoffs: kickoffsTo10 });
    app.premierLeague.send(9, undefined);
    expect(within(await screen.findByRole("region", { name: FIXTURES_TITLE })).getByRole("status").textContent).toBe(loadingGameweekWords(9));
  });
});

describe("which gameweek it opens on", () => {
  it("opens on the current gameweek: the latest kicked off", async () => {
    const app = openSection({ firstKickoffs: kickoffsTo10 });
    expect((await stepperHeading()).textContent).toBe(gameweekWords(9));
    expect(app.premierLeague.useGameweekMatches).toHaveBeenLastCalledWith(9);
  });

  it("before any gameweek has kicked off, opens on the first to come", async () => {
    openSection({ firstKickoffs: [{ gameweek: 1, firstKickoff: Date.now() + DAY_MS }, { gameweek: 2, firstKickoff: Date.now() + WEEK_MS }] });
    expect((await stepperHeading()).textContent).toBe(gameweekWords(1));
  });

  it("with no kickoff times held, opens on the season's first", async () => {
    openSection();
    expect((await stepperHeading()).textContent).toBe(gameweekWords(1));
  });

  it("once the last gameweek has kicked off, stays on it", async () => {
    openSection({ firstKickoffs: [{ gameweek: GAMEWEEKS, firstKickoff: begun }] });
    expect((await stepperHeading()).textContent).toBe(gameweekWords(GAMEWEEKS));
  });
});

describe("the stepper", () => {
  it("steps a gameweek at a time, showing each one's matches", async () => {
    const saturday = begun + WEEK_MS;
    openSection({
      firstKickoffs: kickoffsTo10,
      matches: {
        9: [plMatch(901, ARSENAL, CHELSEA, begun, { state: "fullTime", homeGoals: 1, awayGoals: 0, minutes: 90 })],
        10: [plMatch(1001, SPURS, FOREST, saturday)],
      },
    });
    expect(await matchLines(9)).toEqual([[fullTime.short, "Arsenal", scoreWords(1, 0), "Chelsea"]]);

    await userEvent.click(button(nextGameweekLabel));
    expect((await stepperHeading()).textContent).toBe(gameweekWords(10));
    expect(await matchLines(10)).toEqual([[kickoffWords(saturday), "Spurs", versusWords, "Nottingham Forest"]]);

    await userEvent.click(button(previousGameweekLabel));
    await userEvent.click(button(previousGameweekLabel));
    expect((await stepperHeading()).textContent).toBe(gameweekWords(8));
    expect(screen.getByText(noMatchesWords(8))).toBeTruthy();
  });

  it("goes no further back than gameweek 1, nor on past the season's last", async () => {
    openSection({ firstKickoffs: [{ gameweek: 1, firstKickoff: begun }] });
    await stepperHeading();
    expect(button(previousGameweekLabel).disabled).toBe(true);

    for (let gameweek = 1; gameweek < GAMEWEEKS; gameweek += 1) await userEvent.click(button(nextGameweekLabel));
    expect((await stepperHeading()).textContent).toBe(gameweekWords(GAMEWEEKS));
    expect(button(nextGameweekLabel).disabled).toBe(true);
    expect(button(previousGameweekLabel).disabled).toBe(false);
  });
});

describe("a gameweek's matches", () => {
  // Noon the day after, so a match an hour later falls on the same day whenever the tests run (#598).
  const saturday = new Date(begun + DAY_MS).setHours(12, 0, 0, 0);

  it("are grouped by the day they kick off, matches with no kickoff time last, under 'Date to be confirmed'", async () => {
    openSection({
      firstKickoffs: kickoffsTo10,
      matches: {
        9: [
          plMatch(1, ARSENAL, CHELSEA, begun),
          plMatch(2, SPURS, FOREST, saturday),
          plMatch(3, CHELSEA, SPURS, saturday + HOUR_MS),
          plMatch(4, FOREST, ARSENAL, null),
        ],
      },
    });
    const group = await screen.findByRole("group", { name: matchesListLabel(9) });
    const days = within(group).getAllByRole("region");
    expect(days.map((day) => [within(day).getByRole("heading", { level: 4 }).textContent, within(day).getAllByRole("listitem").length])).toEqual([
      [dayWords(begun), 1],
      [dayWords(saturday), 2],
      [noDateWords, 1],
    ]);
  });

  it("show each match where it stands: its kickoff before, the clock and score while live, half-time, and full time", async () => {
    openSection({
      firstKickoffs: kickoffsTo10,
      matches: {
        9: [
          plMatch(1, ARSENAL, CHELSEA, begun - 2 * HOUR_MS, { state: "fullTime", homeGoals: 3, awayGoals: 1, minutes: 90 }),
          plMatch(2, SPURS, FOREST, begun, { state: "live", homeGoals: 0, awayGoals: 2, minutes: 48, clockLabel: "45+3'10" }),
          plMatch(3, CHELSEA, SPURS, begun, { state: "live", homeGoals: 1, awayGoals: 1, minutes: 72 }),
          plMatch(4, FOREST, ARSENAL, begun, { state: "halfTime", homeGoals: 0, awayGoals: 0, minutes: 45, clockLabel: "45+2'00" }),
          plMatch(5, ARSENAL, SPURS, begun, { state: "live", homeGoals: 0, awayGoals: 0 }),
          plMatch(6, CHELSEA, FOREST, saturday, { state: "upcoming" }),
          plMatch(7, SPURS, ARSENAL, saturday),
        ],
      },
    });
    expect(await matchLines(9)).toEqual([
      [fullTime.short, "Arsenal", scoreWords(3, 1), "Chelsea"],
      ["45+3'", "Spurs", scoreWords(0, 2), "Nottingham Forest"],
      ["72'", "Chelsea", scoreWords(1, 1), "Spurs"],
      [halfTime.short, "Nottingham Forest", scoreWords(0, 0), "Arsenal"],
      [liveWords, "Arsenal", scoreWords(0, 0), "Spurs"],
      [kickoffWords(saturday), "Chelsea", versusWords, "Nottingham Forest"],
      [kickoffWords(saturday), "Spurs", versusWords, "Arsenal"],
    ]);
    expect(screen.getByTitle(fullTime.long).textContent).toBe(fullTime.short);
    expect(screen.getByTitle(halfTime.long).textContent).toBe(halfTime.short);
  });

  it("name each club in full on the desk and by its three letters on a phone", async () => {
    openSection({ firstKickoffs: kickoffsTo10, matches: { 9: [plMatch(1, FOREST, SPURS, saturday)] } });
    const [row] = within(await screen.findByRole("group", { name: matchesListLabel(9) })).getAllByRole("listitem");
    const home = row.children[1];
    expect(home.firstElementChild!.className).toContain("hidden sm:inline");
    expect(home.lastElementChild!.className).toContain("sm:hidden");
    expect(home.lastElementChild!.textContent).toBe("NFO");
    expect(home.lastElementChild!.getAttribute("title")).toBe("Nottingham Forest");
  });

  it("carry no fixture difficulty and no count of owned players: a row holds only its state, its clubs and its score", async () => {
    openSection({ firstKickoffs: kickoffsTo10, matches: { 9: [plMatch(1, ARSENAL, CHELSEA, saturday)] } });
    const [row] = within(await screen.findByRole("group", { name: matchesListLabel(9) })).getAllByRole("listitem");
    expect(row.children).toHaveLength(4);
    expect(row.textContent).toBe(`${kickoffWords(saturday)}ArsenalARS${versusWords}ChelseaCHE`);
    // The score's link to the match page (#45) is labelled with the match, and nothing else is.
    expect(row.querySelector("[aria-label]:not([href]), [title*='difficulty' i]")).toBeNull();
  });
});

describe("live scores", () => {
  it("a replayed match moves from kickoff to full time as its reads arrive", async () => {
    const replay: { score: Partial<NonNullable<GameweekMatch["score"]>> | null; line: string[] }[] = [
      { score: null, line: [kickoffWords(begun), "Arsenal", versusWords, "Chelsea"] },
      { score: { state: "live", homeGoals: 0, awayGoals: 0, minutes: 1, clockLabel: "00'40" }, line: ["00'", "Arsenal", scoreWords(0, 0), "Chelsea"] },
      { score: { state: "live", homeGoals: 1, awayGoals: 0, minutes: 23, clockLabel: "23'05" }, line: ["23'", "Arsenal", scoreWords(1, 0), "Chelsea"] },
      { score: { state: "halfTime", homeGoals: 1, awayGoals: 0, minutes: 45, clockLabel: "45+1'30" }, line: [halfTime.short, "Arsenal", scoreWords(1, 0), "Chelsea"] },
      { score: { state: "live", homeGoals: 1, awayGoals: 1, minutes: 77, clockLabel: "77'00" }, line: ["77'", "Arsenal", scoreWords(1, 1), "Chelsea"] },
      { score: { state: "fullTime", homeGoals: 2, awayGoals: 1, minutes: 90, clockLabel: "90+4'00" }, line: [fullTime.short, "Arsenal", scoreWords(2, 1), "Chelsea"] },
    ];
    const app = openSection({ firstKickoffs: kickoffsTo10 });
    for (const { score, line } of replay) {
      app.premierLeague.send(9, [plMatch(1, ARSENAL, CHELSEA, begun, score)]);
      expect(await matchLines(9)).toEqual([line]);
    }
  });
});
