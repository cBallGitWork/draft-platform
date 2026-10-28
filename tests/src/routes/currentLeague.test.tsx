// The frame's league pages (src/routes/frame.tsx): each is for the league the app is in, and a
// switch to another league starts it afresh rather than keeping the last league's state; and a
// placeholder stands only at a menu page with no screen built yet.

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HOME_PATH, MAIL_PATH, MATCHUP_PATH, MY_TEAM_PATH, pages, SCOUTING_PATH, TABLE_PATH, TRADES_PATH } from "../../../src/frame/menu";
import { notBuiltWords } from "../../../src/frame/words";
import { matchPath } from "../../../src/premierLeague/paths";
import { createShellRouter, type ShellContext } from "../../../src/router";
import { frameChildren } from "../../../src/routes/frame";
import { leagueTableOf } from "../../../src/table/drawnTable";
import { gameweekWords, TABLE_PAGE_TITLE } from "../../../src/table/words";
import { nextGameweekLabel } from "../../../src/words";
import { league, managerIn, miniBeta, openApp } from "../../support/src/shell.harness";

const inTwo = managerIn(league, miniBeta);
const inMiniBeta = { ...inTwo, currentLeagueId: miniBeta.leagueId };
const A_FIXTURE_CODE = 2_561_895;

describe("a switch to another league", () => {
  it.each([HOME_PATH, TABLE_PATH, SCOUTING_PATH, MATCHUP_PATH, MY_TEAM_PATH, matchPath(A_FIXTURE_CODE)])(
    "starts %s afresh, a new page rather than the last league's",
    async (path) => {
      const app = openApp(path, inTwo);
      const before = await screen.findByRole("heading", { level: 1 });
      app.becomes(inMiniBeta);
      await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).not.toBe(before));
    },
  );

  it("opens the table's fixtures on their opening gameweek again, not the one stepped to", async () => {
    const app = openApp(TABLE_PATH, inTwo, { table: { leagueTable: leagueTableOf(["Ann's", "Bob's"], { gameweeks: [1, 2] }) } });
    await screen.findByRole("heading", { level: 3, name: gameweekWords(1) });
    await userEvent.click(screen.getByRole("button", { name: nextGameweekLabel }));
    expect(screen.getByRole("heading", { level: 3, name: gameweekWords(2) })).toBeTruthy();

    app.becomes(inMiniBeta);
    expect(await screen.findByRole("heading", { level: 3, name: gameweekWords(1) })).toBeTruthy();
  });
});

describe("the placeholders for pages not built", () => {
  createShellRouter({} as ShellContext); // which fills in each route's path
  const paths: readonly string[] = frameChildren.map((route) => route.fullPath);

  it("give no address two routes", () => {
    expect(paths.filter((path, index) => paths.indexOf(path) !== index)).toEqual([]);
  });

  it("give every menu page a route here but Mail, whose route is with the league pages", () => {
    expect(pages.map((page) => page.path).filter((path) => !paths.includes(path))).toEqual([MAIL_PATH]);
  });

  it("stand at Trades, not built yet, saying so", async () => {
    openApp(TRADES_PATH, inTwo);
    expect(await screen.findByText(notBuiltWords)).toBeTruthy();
  });

  it("don't stand at a built page", async () => {
    openApp(TABLE_PATH, inTwo);
    await screen.findByRole("heading", { level: 1, name: TABLE_PAGE_TITLE });
    expect(screen.queryByText(notBuiltWords)).toBeNull();
  });
});
