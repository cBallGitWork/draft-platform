// The router's guards on a league's own pages (spec/13, Deleting): a league being deleted is
// frozen and hidden, so its squads and gameweeks send whoever runs it back to Your leagues.

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { LeagueSummary } from "../convex/myLeagues";
import type { Session } from "./auth";
import { gameweeksPath } from "./gameweeks/paths";
import { LEAGUES_PATH } from "./leagues/paths";
import { adminSeeing, league, managerIn, openApp } from "./shell.harness";
import { squadsPath } from "./squads/paths";

afterEach(cleanup);

const beingDeleted: LeagueSummary = {
  ...league,
  roles: ["commissioner", "manager"],
  deletion: { deletesAt: Date.parse("2026-10-22T09:00:00Z"), unemailed: [] },
};

/** Its commissioner, as account:signedInAs has them: it's theirs to see, and they're in no league. */
const deleter: Session = { ...managerIn(beingDeleted), inLeague: false, currentLeagueId: null };

const pages = [squadsPath(beingDeleted.leagueId), gameweeksPath(beingDeleted.leagueId)];

describe("a league being deleted", () => {
  it.each([
    ["its commissioner", deleter],
    ["the admin", adminSeeing({ ...beingDeleted, roles: [], teamName: null })],
  ])("sends %s opening its squads or gameweeks back to Your leagues", async (_, session) => {
    for (const page of pages) {
      const app = openApp(page, session);
      expect(await screen.findByRole("heading", { level: 1, name: "Your leagues" })).toBeTruthy();
      expect(app.path()).toBe(LEAGUES_PATH);
      expect(app.gameweeks.useLeagueGameweeks).not.toHaveBeenCalled();
      cleanup();
    }
  });
});
