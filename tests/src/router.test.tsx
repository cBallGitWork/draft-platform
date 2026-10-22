// The router's guards on a league's own pages: they open only for whoever runs the league, and a
// league being deleted is frozen and hidden (spec/13, Deleting), so its squads, gameweeks and
// invites send even its commissioner back to Your leagues.

import { cleanup, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Session } from "../../src/auth";
import { gameweeksPath } from "../../src/gameweeks/paths";
import { invitesPath } from "../../src/joining/paths";
import { LEAGUES_PATH, LEAGUES_TITLE } from "../../src/leagues/paths";
import { squadsPath } from "../../src/squads/paths";
import { adminSeeing, beingDeleted, commissioned, deleterOf, league, manager, openApp } from "../support/src/shell.harness";

const deleting = beingDeleted(commissioned);

const pagesOf = (leagueId: string) => [squadsPath(leagueId), gameweeksPath(leagueId), invitesPath(leagueId)];

/** Opens each page in turn and expects to land on Your leagues, its gameweeks never asked for. */
async function expectEachSentToLeagues(pages: string[], session: Session) {
  for (const page of pages) {
    const app = openApp(page, session);
    expect(await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE })).toBeTruthy();
    expect(app.path()).toBe(LEAGUES_PATH);
    expect(app.gameweeks.useLeagueGameweeks).not.toHaveBeenCalled();
    cleanup();
  }
}

describe("a league being deleted", () => {
  it.each([
    ["its commissioner", deleterOf(deleting)],
    ["the admin", adminSeeing({ ...deleting, roles: [], teamName: null })],
  ])("sends %s opening its squads, gameweeks or invites back to Your leagues", async (_, session) => {
    await expectEachSentToLeagues(pagesOf(deleting.leagueId), session);
  });
});

describe("a league someone only manages in", () => {
  it("sends them opening its squads, gameweeks or invites back to Your leagues", async () => {
    await expectEachSentToLeagues(pagesOf(league.leagueId), manager);
  });
});
