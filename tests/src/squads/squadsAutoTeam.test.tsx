// Squads' auto team switches (spec/09, The auto team; the approved auto-team picture): each team's
// manager and its auto team, Off or On, switched by the commissioner with no end gameweek; a team
// with no manager locked On until handed on; a manager's own switch saying whose it is and until when.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { commissioner, league, openApp } from "../../support/src/shell.harness";
import { squadsPath } from "../../../src/squads/paths";
import { squadWithWarnings } from "../../support/src/squads.harness";
import { autoTeamLabel, autoTeamStateWords, managersSwitchWords, noManagerWords, untilHandedOnWords } from "../../../src/squads/words";

const team = (teamName: string, changes: Partial<ReturnType<typeof squadWithWarnings>> = {}) => ({ ...squadWithWarnings(`id-${teamName}`, teamName), ...changes });
const open = (squads: ReturnType<typeof team>[]) => openApp(squadsPath(league.leagueId), commissioner, { squads: { squads } });
const switchIn = async (teamName: string) => within(within(await screen.findByRole("region", { name: teamName })).getByRole("radiogroup", { name: autoTeamLabel }));

describe("Squads' auto team", () => {
  it("names each team's manager, and the commissioner switches a team's on, naming no gameweek", async () => {
    const app = open([team("Team 1")]);
    const keys = await switchIn("Team 1");
    expect(within(screen.getByRole("region", { name: "Team 1" })).getByText("team1@example.com")).toBeTruthy();
    expect((keys.getByRole("radio", { name: autoTeamStateWords.off }) as HTMLInputElement).checked).toBe(true);

    await userEvent.click(keys.getByRole("radio", { name: autoTeamStateWords.on }));
    expect(app.squads.switchAutoTeam).toHaveBeenCalledExactlyOnceWith(league.leagueId, "id-Team 1" as Id<"teams">, true);
  });

  it("switches off a manager's own, which says whose it is and until when", async () => {
    const app = open([team("Team 1", { autoTeam: { on: true, endsAfter: 12, byManager: true } })]);
    const keys = await switchIn("Team 1");
    expect(within(screen.getByRole("region", { name: "Team 1" })).getByText(managersSwitchWords(12))).toBeTruthy();
    expect(managersSwitchWords(12)).toBe("Its manager's, until GW12");

    await userEvent.click(keys.getByRole("radio", { name: autoTeamStateWords.off }));
    expect(app.squads.switchAutoTeam).toHaveBeenCalledExactlyOnceWith(league.leagueId, "id-Team 1" as Id<"teams">, false);
  });

  it("locks a team with no manager On, until it is handed on", async () => {
    open([team("Team 1", { managerEmail: null, autoTeam: { on: true, endsAfter: null, byManager: false } })]);
    const keys = await switchIn("Team 1");
    const region = within(screen.getByRole("region", { name: "Team 1" }));
    expect(region.getByText(noManagerWords)).toBeTruthy();
    expect(region.getByText(untilHandedOnWords)).toBeTruthy();
    const on = keys.getByRole("radio", { name: autoTeamStateWords.on }) as HTMLInputElement;
    expect(on.checked).toBe(true);
    expect(on.disabled).toBe(true);
    expect((keys.getByRole("radio", { name: autoTeamStateWords.off }) as HTMLInputElement).disabled).toBe(true);
  });
});
