// Removing a manager from the invites page (#134, spec/13 Leaving): the league's teams, each with
// its manager, and a Remove for each managed team, asked first; the server's refusal is shown as is.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { refusals } from "../../../convex/shared/leagueAccess";
import { invitesPath } from "../../../src/joining/paths";
import type { InvitesPageData } from "../../../src/joining/seam";
import { teamsWords } from "../../../src/joining/words";
import { commissioner, league, openApp } from "../../support/src/shell.harness";

const DAN = "dan@example.com";
const TEAM_1 = "team-1" as Id<"teams">;

const page: InvitesPageData = {
  leagueId: league.leagueId,
  leagueName: league.name,
  teams: [
    { teamId: TEAM_1, name: "Team 1", managerEmail: DAN },
    { teamId: "team-2" as Id<"teams">, name: "Saka Potatoes", managerEmail: null },
  ],
  hasRoom: true,
  linkToken: null,
  invites: [],
  requests: [],
};

const openPage = () => openApp(invitesPath(league.leagueId), commissioner, { joining: { invitesPage: page } });
const teamRow = (name: string) => within(screen.getByRole("list", { name: teamsWords.title })).getByText(name).closest("li")!;
const askToRemoveDan = async () => userEvent.click(await screen.findByRole("button", { name: teamsWords.removeLabel(DAN, "Team 1") }));

describe("the invites page's teams", () => {
  it("lists each team with its manager, and offers Remove only for a managed one", async () => {
    openPage();
    await screen.findByRole("list", { name: teamsWords.title });

    expect(within(teamRow("Team 1")).getByText(DAN)).toBeTruthy();
    expect(within(teamRow("Saka Potatoes")).getByText(teamsWords.noManager)).toBeTruthy();
    expect(within(teamRow("Saka Potatoes")).queryByRole("button")).toBeNull();
  });

  it("asks first, then removes the team's manager", async () => {
    const app = openPage();
    await askToRemoveDan();

    expect(within(teamRow("Team 1")).getByText(teamsWords.confirm(DAN, "Team 1"))).toBeTruthy();
    expect(app.joining.removeManager).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: teamsWords.yes }));

    expect(app.joining.removeManager).toHaveBeenCalledExactlyOnceWith(league.leagueId, TEAM_1);
  });

  it("keeping them asks the server nothing", async () => {
    const app = openPage();
    await askToRemoveDan();
    await userEvent.click(screen.getByRole("button", { name: teamsWords.no }));

    expect(app.joining.removeManager).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: teamsWords.removeLabel(DAN, "Team 1") })).toBeTruthy();
  });

  it.each([
    ["the team has no manager by then", refusals.noManager],
    ["the person no longer runs the league", refusals.notRunner],
  ])("is told why the server refused: %s", async (_, refusal) => {
    const app = openPage();
    app.joining.removeManager.mockResolvedValue(refusal);
    await askToRemoveDan();
    await userEvent.click(screen.getByRole("button", { name: teamsWords.yes }));

    expect((await within(teamRow("Team 1")).findByRole("alert")).textContent).toBe(refusal);
  });
});
