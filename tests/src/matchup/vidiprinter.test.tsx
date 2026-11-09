// The matchup's vidiprinter (spec/10; the approved picture, #1026): every line of every match
// either lineup's men play in, newest first, each in each team's own column with what it moves that
// team's score by under a head row ("Commentary", "Saka P", "Kroos C"), the tapped man's lines
// marked with the cyan edge, delayed when it says so; and why there is nothing to show, when there
// isn't. Moved from matchup.test.tsx, which grew past its ceiling.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { TeamsCommentary } from "../../../convex/matchup/matchupShape";
import { MATCHUP_PATH } from "../../../src/frame/menu";
import {
  closeBreakdownLabel,
  commentaryColumnWords,
  commentaryDelayedWords,
  markedLineLabel,
  noCommentaryWords,
  openBreakdownLabel,
  SCORE_LABEL,
  scoreWords,
  unreadCommentaryWords,
  VIDIPRINTER_TITLE,
} from "../../../src/matchup/words";
import { commentaryLine, headToHead, liveMatchup, slot, teamSide, type MatchupData } from "../../support/src/matchup.harness";
import { manager, openApp } from "../../support/src/shell.harness";

const openMatchup = (matchup: MatchupData = {}) => openApp(MATCHUP_PATH, manager, { matchup });

describe("the vidiprinter", () => {
  const COYLE = slot("Coyle", { area: "attack" });
  const scored = (commentary: TeamsCommentary) =>
    headToHead({ kind: "scored", team: teamSide("Team 1", [COYLE], []), opponent: teamSide("Kroos Control", [], []), commentary });
  const vidiprinterLines = () =>
    within(screen.getByRole("list", { name: VIDIPRINTER_TITLE }))
      .getAllByRole("listitem")
      .map((item) => item.textContent);
  /** The head row over the lines: "Commentary", then each team's short name. */
  const headRow = () => screen.getByText(commentaryColumnWords).parentElement?.textContent;
  const kickoffLine = commentaryLine("1", "KO HUL v EVE");

  it("plays out with the gameweek, newest first, each line with what it's worth to either team's men", async () => {
    const live = liveMatchup(scored({ kind: "read", lines: [kickoffLine], delayed: false }));
    openMatchup({ live });
    await screen.findByRole("list", { name: VIDIPRINTER_TITLE });
    expect(vidiprinterLines()).toEqual(["KO HUL v EVE"]);

    live.play(
      scored({
        kind: "read",
        lines: [
          commentaryLine("4", "~65' Hall: 2 conceded", { points: "-1", columns: [null, "-1"] }),
          commentaryLine("3", "~61' Coyle: 60 minutes", { points: "+1", about: [COYLE.playerCode], columns: ["+1", null] }),
          commentaryLine("2", "52' GOAL Coyle, assist Phillips", { points: "Coyle +5, Phillips +3", about: [COYLE.playerCode], columns: ["+8", null] }),
          kickoffLine,
        ],
        delayed: false,
      }),
    );
    // Each figure sits in its team's column, read out with the team's name; the head row shows
    // the names short.
    expect(await screen.findByText("52' GOAL Coyle, assist Phillips")).toBeTruthy();
    expect(vidiprinterLines()).toEqual(["~65' Hall: 2 concededKroos Control -1", "~61' Coyle: 60 minutesTeam 1 +1", "52' GOAL Coyle, assist PhillipsTeam 1 +8", "KO HUL v EVE"]);
    expect(headRow()).toBe(`${commentaryColumnWords}Team 1Kroos C`);
    expect(screen.queryByText("Coyle +5, Phillips +3")).toBeNull();
    expect(screen.queryByText(commentaryDelayedWords)).toBeNull();
  });

  it("marks the tapped man's lines with the cyan edge until his breakdown closes", async () => {
    const lines = [
      commentaryLine("2", "~61' Coyle: 60 minutes", { about: [COYLE.playerCode], columns: ["+1", null] }),
      commentaryLine("1", "~52' Hall: 3 key passes", { columns: [null, "+1"] }),
    ];
    openMatchup({ matchup: scored({ kind: "read", lines, delayed: false }) });
    const list = await screen.findByRole("list", { name: VIDIPRINTER_TITLE });
    const marked = () =>
      within(list)
        .getAllByRole("listitem")
        .filter((item) => item.className.includes("shadow-current-edge"))
        .map((item) => item.textContent);
    expect(marked()).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: openBreakdownLabel("Coyle") }));
    expect(marked()).toEqual([`~61' Coyle: 60 minutes ${markedLineLabel("Coyle")}Team 1 +1`]);
    await userEvent.click(screen.getByRole("button", { name: closeBreakdownLabel }));
    expect(marked()).toEqual([]);
  });

  it("against the league's average, has its one team's column", async () => {
    const average = headToHead({
      kind: "scored",
      team: teamSide("Team 1", [COYLE], []),
      opponent: { kind: "leagueAverage", points: 40, provisional: true },
      commentary: { kind: "read", lines: [commentaryLine("1", "~61' Coyle: 60 minutes", { columns: ["+1"] })], delayed: false },
    });
    openMatchup({ matchup: average });
    await screen.findByRole("list", { name: VIDIPRINTER_TITLE });
    expect(headRow()).toBe(`${commentaryColumnWords}Team 1`);
    expect(vidiprinterLines()).toEqual(["~61' Coyle: 60 minutesTeam 1 +1"]);
  });

  it("says when the commentary is delayed, keeping the lines it has", async () => {
    openMatchup({ matchup: scored({ kind: "read", lines: [kickoffLine], delayed: true }) });
    expect((await screen.findByRole("status")).textContent).toBe(commentaryDelayedWords);
    expect(vidiprinterLines()).toEqual(["KO HUL v EVE"]);
  });

  it("says when there are no lines yet", async () => {
    openMatchup({ matchup: scored({ kind: "read", lines: [], delayed: false }) });
    expect(await screen.findByText(noCommentaryWords)).toBeTruthy();
  });

  it("says why the commentary can't be shown, while the score still does", async () => {
    openMatchup({ matchup: scored({ kind: "unread", reason: "the store is down" }) });
    expect(await screen.findByText(unreadCommentaryWords("the store is down"))).toBeTruthy();
    expect(screen.getByRole("region", { name: SCORE_LABEL }).textContent).toContain(scoreWords(0, 0));
  });
});
