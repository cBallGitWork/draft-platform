// The team override on the matchup (#903; spec/14 S14.3 to S14.6): whoever runs the league sets a
// team's total for the gameweek, with a reason, from "Override total" under its name, and "Remove
// override" puts the scored total back. The server's own rules and refusals are tested in
// tests/convex/table/teamOverrides.test.ts.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MATCHUP_PATH } from "../../../src/frame/menu";
import type { MatchupSide } from "../../../convex/matchup/matchupShape";
import type { Matchup } from "../../../src/matchup/seam";
import {
  cancelOverrideWords,
  overriddenDoneWords,
  overrideHint,
  overrideTotalLabel,
  overrideTotalLabels,
  overrideWords,
  removeTotalOverrideLabel,
  SCORE_LABEL,
  totalOverrideRemovedWords,
} from "../../../src/matchup/words";
import { descriptionOf } from "../../support/src/describedBy";
import { headToHead, teamSide, type MatchupData } from "../../support/src/matchup.harness";
import { coCommissioned, commissioned, league, manager, managerIn, openApp } from "../../support/src/shell.harness";
import type { Session } from "../../../src/signIn/seam";
import { LEAGUE_AVERAGE } from "../../../convex/table/roundRobin";

const GAMEWEEK = 6;
const TEAM_1 = teamSide("Team 1", [], [], 54, false);
const TEAM_2 = teamSide("Team 2", [], [], 57, false);
const matchupOf = (team: MatchupSide = TEAM_1, opponent: MatchupSide = TEAM_2): Matchup =>
  headToHead({ kind: "scored", team, opponent }, { gameweek: GAMEWEEK });

const openMatchup = (session: Session, data: MatchupData = { matchup: matchupOf() }) => openApp(MATCHUP_PATH, session, { matchup: data });
const score = () => within(screen.getByRole("region", { name: SCORE_LABEL }));
const overrideButton = (teamName: string) => score().getByRole("button", { name: overrideTotalLabel(teamName) });

describe("Override total", () => {
  it("isn't offered to a manager who doesn't run the league", async () => {
    openMatchup(manager);
    await screen.findByRole("region", { name: SCORE_LABEL });
    expect(screen.queryByRole("button", { name: overrideTotalLabel("Team 1") })).toBeNull();
    expect(screen.queryByRole("button", { name: overrideTotalLabel("Team 2") })).toBeNull();
  });

  // The admin runs every league as the commissioner does (runs(), src/leagues/access.ts).
  it.each([
    ["the commissioner", managerIn(commissioned)],
    ["the co-commissioner", managerIn(coCommissioned)],
  ])("is offered to %s under each team's name", async (_who, session) => {
    openMatchup(session);
    await screen.findByRole("button", { name: overrideTotalLabel("Team 1") });
    overrideButton("Team 2");
  });

  it("isn't offered for the league's average", async () => {
    openMatchup(managerIn(commissioned), { matchup: matchupOf(TEAM_1, { kind: LEAGUE_AVERAGE, points: 50, provisional: false }) });
    await screen.findByRole("button", { name: overrideTotalLabel("Team 1") });
    expect(score().getAllByRole("button")).toHaveLength(1);
  });

  it("opens a form for the team picked, which waits for the total and why, describes the box by the hint, and Cancel shuts it", async () => {
    const user = userEvent.setup();
    openMatchup(managerIn(commissioned));
    await user.click(await screen.findByRole("button", { name: overrideTotalLabel("Team 2") }));
    const form = screen.getByRole("form", { name: overrideTotalLabel("Team 2") });
    expect((within(form).getByRole("button", { name: overrideWords }) as HTMLButtonElement).disabled).toBe(true);
    expect(descriptionOf(within(form).getByLabelText(overrideTotalLabels.points))).toBe(overrideHint);

    await user.type(within(form).getByLabelText(overrideTotalLabels.points), "60");
    await user.click(within(form).getByRole("button", { name: cancelOverrideWords }));
    expect(screen.queryByRole("form")).toBeNull();
    await user.click(overrideButton("Team 2"));
    expect((screen.getByLabelText(overrideTotalLabels.points) as HTMLInputElement).value).toBe("");
  });

  it("sends the gameweek, the team, its total and why, then says it is done and shuts the form", async () => {
    const user = userEvent.setup();
    const app = openMatchup(managerIn(commissioned));
    await user.click(await screen.findByRole("button", { name: overrideTotalLabel("Team 1") }));
    await user.type(screen.getByLabelText(overrideTotalLabels.points), "60.5");
    await user.type(screen.getByLabelText(overrideTotalLabels.reason), "Two subs the auto-subs missed");
    await user.click(screen.getByRole("button", { name: overrideWords }));

    expect(app.matchup.overrideTeam).toHaveBeenCalledWith(league.leagueId, { gameweek: GAMEWEEK, teamId: TEAM_1.teamId, points: 60.5, reason: "Two subs the auto-subs missed" });
    await screen.findByText(overriddenDoneWords);
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("says why the server refused, and keeps what was typed", async () => {
    const user = userEvent.setup();
    const refusal = "A team's override is from minus 1000 to 1000 points.";
    openMatchup(managerIn(commissioned), { matchup: matchupOf(), overrideRefusal: refusal });
    await user.click(await screen.findByRole("button", { name: overrideTotalLabel("Team 1") }));
    await user.type(screen.getByLabelText(overrideTotalLabels.points), "999");
    await user.type(screen.getByLabelText(overrideTotalLabels.reason), "Typo");
    await user.click(screen.getByRole("button", { name: overrideWords }));

    await screen.findByText(refusal);
    expect((screen.getByLabelText(overrideTotalLabels.points) as HTMLInputElement).value).toBe("999");
    expect(screen.queryByText(overriddenDoneWords)).toBeNull();
  });
});

describe("Remove override", () => {
  const overridden = matchupOf({ ...TEAM_1, overridden: true });

  it("takes Override total's place under an overridden team, and removes that team's override, then says so", async () => {
    const user = userEvent.setup();
    const app = openMatchup(managerIn(commissioned), { matchup: overridden });
    await user.click(await screen.findByRole("button", { name: removeTotalOverrideLabel("Team 1") }));

    expect(screen.queryByRole("button", { name: overrideTotalLabel("Team 1") })).toBeNull();
    overrideButton("Team 2");
    expect(app.matchup.removeTeamOverride).toHaveBeenCalledWith(league.leagueId, { gameweek: GAMEWEEK, teamId: TEAM_1.teamId });
    await screen.findByText(totalOverrideRemovedWords);
  });

  it("says why the server refused", async () => {
    const user = userEvent.setup();
    const refusal = "Team 1's total in gameweek 6 isn't overridden.";
    openMatchup(managerIn(commissioned), { matchup: overridden, overrideRefusal: refusal });
    await user.click(await screen.findByRole("button", { name: removeTotalOverrideLabel("Team 1") }));
    await screen.findByText(refusal);
    expect(screen.queryByText(totalOverrideRemovedWords)).toBeNull();
  });

  it("isn't shown to a manager who doesn't run the league", async () => {
    openMatchup(manager, { matchup: overridden });
    await screen.findByRole("region", { name: SCORE_LABEL });
    expect(screen.queryByRole("button", { name: removeTotalOverrideLabel("Team 1") })).toBeNull();
  });
});
