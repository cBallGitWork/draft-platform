// The frame's league pages (src/routes/frame.tsx): each is for the league the app is in, and a
// switch to another league starts it afresh rather than keeping the last league's state. That every
// menu page has a route is menuRoutes.test.ts's.

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HOME_PATH, MATCHUP_PATH, MY_TEAM_PATH, SCOUTING_PATH, TABLE_PATH } from "../../../src/frame/menu";
import { matchPath } from "../../../src/premierLeague/paths";
import { leagueTableOf } from "../../../src/table/drawnTable";
import { gameweekWords } from "../../../src/table/words";
import { nextGameweekLabel } from "../../../src/shared/words";
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
