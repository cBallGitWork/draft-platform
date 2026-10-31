// My team's Tactics tab (#14; spec/05, The pitch; spec/12, My team): where a manager lands; the
// lineup held for the next gameweek on a pitch of six areas by five lanes, the squad beside it with
// the bench in order; a player picked up (a click, a tap, Enter) or dragged, then put in a free cell
// he plays or on the bench; the save, with the server's refusal in its words; and the countdown to
// the league's deadline.

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Cell } from "../../../../convex/lineup/pitch";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../../../../convex/shared/time";
import { MY_TEAM_PATH } from "../../../../src/frame/menu";
import {
  BENCH_TITLE,
  emptyBenchWords,
  joinedBenchWords,
  locksWords,
  noDeadlineWords,
  pitchLabel,
  seasonOverWords,
  squadTableLabel,
  startingWords,
  tacticsLoadingWords,
  tacticsNoRulesWords,
} from "../../../../src/myTeam/tactics/words";
import { noTeamWords } from "../../../../src/myTeam/words";
import { unheldNoticeWords, unheldPlayerWords } from "../../../../src/shared/words";
import { commissioner, league, manager, openApp } from "../../../support/src/shell.harness";
import { TACTICS_GAMEWEEK, openTactics } from "../../../support/src/tactics.harness";
import {
  ARRIZABALAGA,
  RAYA,
  SALIBA,
  SAVED,
  SQUAD,
  STARTERS,
  WHITE,
  blockOf,
  openTacticsTab,
  openedPitch,
  squadRows,
  type Member,
} from "../../../support/src/tacticsScreen.harness";

describe("reaching it", () => {
  it("is where a manager lands, titled by his team, reading his lineup for the league the app is in", async () => {
    const app = openApp("/", manager, { myTeam: { tactics: SAVED } });
    expect(await screen.findByRole("heading", { level: 1, name: league.teamName! })).toBeTruthy();
    expect(app.path()).toBe(MY_TEAM_PATH);
    expect(app.myTeam.useTactics).toHaveBeenCalledWith(league.leagueId, expect.any(Number));
  });

  it("says so while it loads", async () => {
    openTacticsTab({ loading: true });
    expect((await screen.findByRole("status")).textContent).toBe(tacticsLoadingWords);
  });

  it.each([
    ["a league made before rules", { kind: "noRules" } as const, tacticsNoRulesWords],
    ["a season whose every gameweek has begun", { kind: "seasonOver" } as const, seasonOverWords],
  ])("says why there's no lineup to set, for %s", async (_, tactics, words) => {
    openTacticsTab({ tactics });
    expect(await screen.findByText(words)).toBeTruthy();
    expect(screen.queryByRole("group", { name: pitchLabel })).toBeNull();
  });

  it("tells someone running no team in the league there's nothing to show, and reads nothing", async () => {
    const app = openTacticsTab({}, commissioner);
    expect(await screen.findByText(noTeamWords)).toBeTruthy();
    expect(app.myTeam.useTactics).not.toHaveBeenCalled();
  });
});

describe("the deadline", () => {
  it("says when the gameweek locks and counts down to it", async () => {
    const minute = Date.now() - (Date.now() % MINUTE_MS);
    const deadline = minute + DAY_MS + 17 * HOUR_MS;
    openTacticsTab({ tactics: { ...SAVED, deadline } });
    expect(await screen.findByText(locksWords(TACTICS_GAMEWEEK, deadline), { exact: false })).toBeTruthy();
    expect(screen.getByText("in 1d 17h")).toBeTruthy();
  });

  it("says a gameweek with no kickoff time held has no deadline yet", async () => {
    openTacticsTab({ tactics: { ...SAVED, deadline: null } });
    expect(await screen.findByText(noDeadlineWords(TACTICS_GAMEWEEK))).toBeTruthy();
  });
});

describe("the lineup held", () => {
  it("stands on the pitch, each starter in his cell with his positions", async () => {
    openTacticsTab();
    await screen.findByRole("group", { name: pitchLabel });
    for (const { playerCode, area, lane } of STARTERS) expect(blockOf(SQUAD.find((each) => each.playerCode === playerCode)!, { area, lane })).toBeTruthy();
    expect(screen.getByText(startingWords(STARTERS.length))).toBeTruthy();
  });

  it("each starter wears the squad number his manager gave him, and a blank shirt until then (#13)", async () => {
    const numbered = { ...RAYA, number: 22 };
    const squad = SQUAD.map((each) => (each.playerCode === RAYA.playerCode ? numbered : each));
    await openedPitch({ tactics: { ...SAVED, squad } });
    const shirtNumber = (player: Member, cell: Cell) => blockOf(player, cell).querySelector("svg text")?.textContent ?? null;
    expect(shirtNumber(numbered, { area: "goalkeeper", lane: "centre" })).toBe("22");
    expect(shirtNumber(SALIBA, { area: "defence", lane: "leftCentre" })).toBeNull();
  });

  it("is listed beside it: the eleven back to front, then the bench in order", async () => {
    openTacticsTab();
    await screen.findByRole("table", { name: squadTableLabel });
    expect(squadRows()).toEqual([
      "GKRaya ARSShot-stopperSweeper keeperMove",
      "CBSaliba ARSStopperBall-playing defenderMove",
      "CDM, CMRice ARSBox-to-boxPlaymakerBall-winnerMove",
      "STHavertz ARSPoacherTarget manPressing forwardShadow strikerFalse 9Move",
      BENCH_TITLE, "GKArrizabalaga ARSMove Up Down", "FB, WBWhite ARSMove Up Down"]);
  });

  it("says who joined the squad since and sits at the end of the bench", async () => {
    const lineup = { fromGameweek: TACTICS_GAMEWEEK, noLineup: false, starters: STARTERS, bench: [ARRIZABALAGA.playerCode, WHITE.playerCode], leftSquad: [], joinedBench: [WHITE.playerCode], vacated: [] };
    openTacticsTab({ tactics: openTactics({ squad: SQUAD, lineup }) });
    expect(await screen.findByText(joinedBenchWords([WHITE.name]))).toBeTruthy();
  });

  it("keeps a bench player the football sync doesn't hold, under a notice: the server words his row (#323)", async () => {
    const unheld: Member = { ...WHITE, name: unheldPlayerWords(WHITE.playerCode), clubShortName: null, unheld: true };
    openTacticsTab({ tactics: { ...SAVED, squad: SQUAD.map((each) => (each === WHITE ? unheld : each)) } });
    expect(await screen.findByText(unheldNoticeWords)).toBeTruthy();
    expect(squadRows().at(-1)).toContain(unheld.name);
  });

  it("shows no notice of missing football data while every player is held", async () => {
    await openedPitch();
    expect(screen.queryByText(unheldNoticeWords)).toBeNull();
  });

  it("says when the bench is empty", async () => {
    openTacticsTab({ tactics: openTactics({ squad: [RAYA], lineup: { fromGameweek: 1, noLineup: false, starters: [STARTERS[0]], bench: [], leftSquad: [], joinedBench: [], vacated: [] } }) });
    expect(await screen.findByText(emptyBenchWords)).toBeTruthy();
  });
});
