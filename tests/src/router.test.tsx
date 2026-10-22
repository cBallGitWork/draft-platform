// The router's guards on a league's own pages: they open only for whoever runs the league, and a
// league being deleted is frozen and hidden (spec/13, Deleting), so its squads, gameweeks and
// invites send even its commissioner back to Your leagues.

import { cleanup, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import type { Session } from "../../src/auth";
import { gameweeksPath } from "../../src/gameweeks/paths";
import { LEAGUES_PATH, LEAGUES_TITLE } from "../../src/leagues/paths";
import { adminSeeing, league, manager, managerIn, openApp } from "../support/src/shell.harness";
import { invitesPath } from "../../src/joining/paths";
import { squadsPath } from "../../src/squads/paths";

const beingDeleted: LeagueSummary = {
  ...league,
  roles: ["commissioner", "manager"],
  deletion: { deletesAt: Date.parse("2026-10-22T09:00:00Z"), unemailed: [] },
};

/** Its commissioner, as signIn/account:signedInAs has them: it's theirs to see, and they're in no league. */
const deleter: Session = { ...managerIn(beingDeleted), inLeague: false, currentLeagueId: null };

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
    ["its commissioner", deleter],
    ["the admin", adminSeeing({ ...beingDeleted, roles: [], teamName: null })],
  ])("sends %s opening its squads, gameweeks or invites back to Your leagues", async (_, session) => {
    await expectEachSentToLeagues(pagesOf(beingDeleted.leagueId), session);
  });
});

describe("a league someone only manages in", () => {
  it("sends them opening its squads, gameweeks or invites back to Your leagues", async () => {
    await expectEachSentToLeagues(pagesOf(league.leagueId), manager);
  });
});
