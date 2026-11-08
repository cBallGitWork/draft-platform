// The matchup's head and each side's panel head, as the approved picture draws them (#1026): under
// each team's name how many of its men have played, are live and are still to play; over each
// pitch its formation, "Custom" once edited off every preset (#878), and the auto team's tag on a
// team nobody runs (#1207).

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MATCHUP_PATH } from "../../../src/frame/menu";
import { autoTeamWords, customFormationWords, SCORE_LABEL, standingWords } from "../../../src/matchup/words";
import { headToHead, playing, slot, SLOT_MATCH, teamSide } from "../../support/src/matchup.harness";
import { manager, openApp } from "../../support/src/shell.harness";

describe("the matchup's heads", () => {
  it("says under each team's name how many of its men have played, are live and are still to play", async () => {
    const team = teamSide("Team 1", [slot("Raya", { area: "goalkeeper", status: { kind: "finished", fixtureCode: SLOT_MATCH } }), slot("Coyle", { status: playing(60) }), slot("Delap", { area: "attack" })], []);
    openApp(MATCHUP_PATH, manager, { matchup: { matchup: headToHead({ kind: "scored", team, opponent: teamSide("Team 2", [], []) }) } });
    const head = await screen.findByRole("region", { name: SCORE_LABEL });
    expect(head.textContent).toContain(`${standingWords.played(1)}, ${standingWords.live(1)}, ${standingWords.toPlay(1)}`);
    expect(head.textContent).toContain(`${standingWords.played(0)}, ${standingWords.live(0)}, ${standingWords.toPlay(0)}`);
  });

  it("heads each side's lineup with its formation, \"Custom\" once edited off every preset, and a team nobody runs with the auto team's tag", async () => {
    const team = { ...teamSide("Team 1", [], []), formation: "4-4-2" };
    const opponent = { ...teamSide("Team 2", [], []), autoTeam: true };
    openApp(MATCHUP_PATH, manager, { matchup: { matchup: headToHead({ kind: "scored", team, opponent }) } });
    const mine = await screen.findByRole("region", { name: "Team 1" });
    expect(within(mine).getByText("4-4-2")).toBeTruthy();
    expect(within(mine).queryByText(autoTeamWords)).toBeNull();
    // The tag is in the panel's title, so it is read out with the team's name.
    const theirs = screen.getByRole("region", { name: `Team 2 ${autoTeamWords}` });
    expect(within(theirs).getByText(customFormationWords)).toBeTruthy();
    expect(within(theirs).getByText(autoTeamWords)).toBeTruthy();
  });
});
