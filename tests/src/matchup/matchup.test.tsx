// The matchup (#34; spec/10, The matchup, as a live match; spec/12): a tab away from My team, and
// opened from any fixture's score on the table and from league home's head-to-heads; the totals as
// the score at the top, provisional until final; both lineups with each man's points and his
// match's state, the auto-subs, the bench greyed under its own plate; a replayed gameweek playing
// out to its result; and why there is nothing to show, when there isn't.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { HOME_PATH, MATCHUP_PATH, MY_TEAM_PATH, TABLE_PATH } from "../../../src/frame/menu";
import type { Matchup } from "../../../src/matchup/seam";
import {
  AREA_CODES,
  autoSubWords,
  averageWords,
  BENCH_TITLE,
  byeWords,
  finalWords,
  gameweekWords,
  leagueAverageWords,
  lineupLabel,
  loadingWords,
  MATCHUP_TITLE,
  matchupLinkLabel,
  nextLabel,
  noGamesWords,
  noGameWords,
  noLineupWords,
  noRulesWords,
  notBegunWords,
  notCountingLabel,
  noTeamWords,
  previousLabel,
  provisionalWords,
  SCORE_LABEL,
  scoreWords,
  statusLabels,
  statusWords,
  totalPointsWords,
  unscoredWords,
} from "../../../src/matchup/words";
import { leagueTableOf } from "../../../src/table/drawnTable";
import { homeFixture, quietHome } from "../../support/src/home.harness";
import { headToHead, liveMatchup, slot, teamSide, type MatchupData } from "../../support/src/matchup.harness";
import { league, manager, openApp } from "../../support/src/shell.harness";

const openMatchup = (matchup: MatchupData = {}, path = MATCHUP_PATH) => openApp(path, manager, { matchup });
const lineupRows = (teamName: string) =>
  within(screen.getByRole("table", { name: lineupLabel(teamName) }))
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.textContent);

const KICKOFF = Date.parse("2026-10-27T15:00:00Z");

/** Ann's Hull and Bob's Everton, a man and a keeper each and a bench keeper, at four stages of a replay. */
const stages = {
  beforeKickoff: headToHead({
    kind: "scored",
    team: teamSide("Team 1", [slot("Phillips", { area: "goalkeeper", status: { kind: "yetToPlay", kickoff: KICKOFF } }), slot("Coyle", { status: { kind: "yetToPlay", kickoff: KICKOFF } })], [slot("Pandur", { area: "goalkeeper", counts: false })]),
    opponent: teamSide("Team 2", [slot("Pickford", { area: "goalkeeper" })], []),
  }),
  live: headToHead({
    kind: "scored",
    team: teamSide("Team 1", [slot("Phillips", { area: "goalkeeper", points: 0, status: { kind: "playing", minute: 60 } }), slot("Coyle", { points: 2, status: { kind: "playing", minute: 60 } })], [slot("Pandur", { area: "goalkeeper", points: 3, counts: false, status: { kind: "playing", minute: 60 } })], 2),
    opponent: teamSide("Team 2", [slot("Pickford", { area: "goalkeeper", points: 5, status: { kind: "playing", minute: 60 } })], [], 5),
  }),
  fullTime: headToHead({
    kind: "scored",
    team: teamSide(
      "Team 1",
      [slot("Phillips", { area: "goalkeeper", points: 0, counts: false, status: { kind: "finished" }, autoSub: { kind: "off", playerName: "Pandur" } }), slot("Coyle", { points: 6, status: { kind: "finished" } })],
      [slot("Pandur", { area: "goalkeeper", points: 3, status: { kind: "finished" }, autoSub: { kind: "on", playerName: "Phillips" } })],
      9,
    ),
    opponent: teamSide("Team 2", [slot("Pickford", { area: "goalkeeper", points: 7, status: { kind: "finished" } })], [], 7),
  }),
};
const final: Matchup = (() => {
  const { game, ...rest } = stages.fullTime;
  if (game.kind !== "scored") throw new Error("full time is scored");
  return { ...rest, game: { ...game, team: { ...game.team, provisional: false }, opponent: { ...game.opponent, provisional: false } } };
})();

describe("reaching it", () => {
  it("a manager lands on My team and opens it from the menu's Matchup: their own team, the latest gameweek begun", async () => {
    const app = openApp(MY_TEAM_PATH, manager);
    await userEvent.click(await screen.findByRole("link", { name: MATCHUP_TITLE }));

    expect(await screen.findByRole("heading", { level: 1, name: MATCHUP_TITLE })).toBeTruthy();
    expect(app.path()).toBe(MATCHUP_PATH);
    expect(app.matchup.useMatchup).toHaveBeenCalledWith(league.leagueId, expect.any(Number), { teamId: undefined, gameweek: undefined });
  });

  it("opens from a fixture's score on the table, for that fixture's team and gameweek", async () => {
    const leagueTable = leagueTableOf(["Ann's", "Bob's"]);
    const [{ gameweek, fixtures }] = leagueTable.gameweeks;
    const app = openApp(TABLE_PATH, manager, { table: { leagueTable } });
    const [{ teamId, team, opponent }] = fixtures;
    await userEvent.click(await screen.findByRole("link", { name: matchupLinkLabel(team, opponent, gameweek) }));

    expect(await screen.findByRole("heading", { level: 1, name: MATCHUP_TITLE })).toBeTruthy();
    expect(app.matchup.useMatchup).toHaveBeenLastCalledWith(league.leagueId, expect.any(Number), { teamId, gameweek });
  });

  it("opens from a head-to-head on league home", async () => {
    const app = openApp(HOME_PATH, manager, { home: { leagueHome: { ...quietHome, thisGameweek: { gameweek: 4, fixtures: [homeFixture("Cat's", null)], byes: [] } } } });
    await userEvent.click(await screen.findByRole("link", { name: matchupLinkLabel("Cat's", null, 4) }));

    expect(await screen.findByRole("heading", { level: 1, name: MATCHUP_TITLE })).toBeTruthy();
    expect(app.matchup.useMatchup).toHaveBeenLastCalledWith(league.leagueId, expect.any(Number), { teamId: "team-Cat's" as Id<"teams">, gameweek: 4 });
  });

  it("drops a gameweek in the address that isn't a whole number", async () => {
    const app = openMatchup({}, `${MATCHUP_PATH}?gameweek=6.5`);
    await screen.findByRole("heading", { level: 1, name: MATCHUP_TITLE });
    expect(app.matchup.useMatchup).toHaveBeenCalledWith(league.leagueId, expect.any(Number), { teamId: undefined, gameweek: undefined });
  });
});

describe("a replayed gameweek plays out on screen", () => {
  it("yet to play, then each man's minute and points, then the auto-sub at full time, then the final result", async () => {
    const live = liveMatchup(stages.beforeKickoff);
    openMatchup({ live });
    const top = await screen.findByRole("region", { name: SCORE_LABEL });
    expect(top.textContent).toContain(scoreWords(0, 0));
    expect(within(top).getByText(provisionalWords)).toBeTruthy();
    expect(lineupRows("Team 1")).toEqual([
      `${AREA_CODES.goalkeeper}Phillips${statusLabels.yetToPlay} ${statusWords.yetToPlay(KICKOFF)}—`,
      `${AREA_CODES.midfield}Coyle${statusLabels.yetToPlay} ${statusWords.yetToPlay(KICKOFF)}—`,
      BENCH_TITLE,
      `${AREA_CODES.goalkeeper}Pandur${statusLabels.yetToPlay} To play— ${notCountingLabel}`,
    ]);

    live.play(stages.live);
    expect(await screen.findByText(scoreWords(2, 5))).toBeTruthy();
    // The bench keeper's points show, greyed: they don't count while Phillips stands.
    expect(lineupRows("Team 1")).toEqual([
      `${AREA_CODES.goalkeeper}Phillips${statusLabels.playing} 60'0`,
      `${AREA_CODES.midfield}Coyle${statusLabels.playing} 60'2`,
      BENCH_TITLE,
      `${AREA_CODES.goalkeeper}Pandur${statusLabels.playing} 60'3 ${notCountingLabel}`,
    ]);

    live.play(stages.fullTime);
    expect(await screen.findByText(scoreWords(9, 7))).toBeTruthy();
    expect(lineupRows("Team 1")).toEqual([
      `${AREA_CODES.goalkeeper}Phillips${autoSubWords.off("Pandur")}${statusLabels.finished} FT0 ${notCountingLabel}`,
      `${AREA_CODES.midfield}Coyle${statusLabels.finished} FT6`,
      BENCH_TITLE,
      `${AREA_CODES.goalkeeper}Pandur${autoSubWords.on("Phillips")}${statusLabels.finished} FT3`,
    ]);
    expect(screen.getByText(provisionalWords)).toBeTruthy();

    live.play(final);
    expect(await screen.findByText(finalWords)).toBeTruthy();
    expect(screen.getByRole("region", { name: SCORE_LABEL }).textContent).toContain(`Team 1${scoreWords(9, 7)}Team 2`);
    expect(screen.queryByText(provisionalWords)).toBeNull();
  });
});

describe("while the next minute loads", () => {
  it("keeps the matchup on screen rather than blanking it", async () => {
    const live = liveMatchup(stages.live);
    openMatchup({ live });
    expect(await screen.findByText(scoreWords(2, 5))).toBeTruthy();
    live.play(undefined);
    expect(screen.getByText(scoreWords(2, 5))).toBeTruthy();
    expect(screen.queryByText(loadingWords)).toBeNull();
  });
});

describe("the gameweek stepper", () => {
  it("links to the team's matchup in the gameweeks either side", async () => {
    const app = openMatchup({ matchup: stages.live });
    const stepper = await screen.findByRole("navigation", { name: gameweekWords(6) });
    await userEvent.click(within(stepper).getByRole("link", { name: nextLabel }));
    expect(app.matchup.useMatchup).toHaveBeenLastCalledWith(league.leagueId, expect.any(Number), { teamId: "team-Team 1", gameweek: 7 });
    expect(within(stepper).getByRole("link", { name: previousLabel })).toBeTruthy();
  });

  it("has no way on past the team's first or last gameweek", async () => {
    openMatchup({ matchup: headToHead({ kind: "bye" }, { gameweek: 5, gameweeks: [5] }) });
    const stepper = await screen.findByRole("navigation", { name: gameweekWords(5) });
    expect(within(stepper).queryAllByRole("link")).toEqual([]);
  });
});

describe("each side", () => {
  it("a side that never saved a lineup says so, and the league's average says what it is", async () => {
    openMatchup({ matchup: headToHead({ kind: "scored", team: { ...teamSide("Team 1", [], []), lineup: null }, opponent: { kind: "leagueAverage", points: 21.3, provisional: false } }) });
    expect(await screen.findByText(noLineupWords("Team 1"))).toBeTruthy();
    expect(screen.getByText(averageWords)).toBeTruthy();
    expect(screen.getByRole("region", { name: SCORE_LABEL }).textContent).toContain(`Team 1${scoreWords(0, 21.3)}${leagueAverageWords}`);
  });

  it("a starter whom no one could replace says so", async () => {
    openMatchup({ matchup: headToHead({ kind: "scored", team: teamSide("Team 1", [slot("Raya", { counts: true, status: { kind: "finished" }, autoSub: { kind: "unreplaced" } })], []), opponent: teamSide("Team 2", [], []) }) });
    expect(await screen.findByText(autoSubWords.unreplaced)).toBeTruthy();
  });

  it("a man whose club has no match says so", async () => {
    openMatchup({ matchup: headToHead({ kind: "scored", team: teamSide("Team 1", [slot("Wood", { status: { kind: "noMatch" } })], []), opponent: teamSide("Team 2", [], []) }) });
    expect(await screen.findByText(statusLabels.noMatch)).toBeTruthy();
  });
});

describe("when there's nothing to score", () => {
  it.each<[string, MatchupData, string]>([
    ["while it loads", { loading: true }, loadingWords],
    ["for a league with no rules", { matchup: null }, noRulesWords],
    ["for a league in total points", { matchup: { kind: "totalPoints" } }, totalPointsWords],
    ["for someone running no team", { matchup: { kind: "noTeam" } }, noTeamWords],
    ["for a team with no head-to-heads", { matchup: { ...headToHead({ kind: "none" }), gameweek: null, gameweeks: [] } }, noGamesWords("Team 1")],
    ["in a gameweek the team plays nobody", { matchup: headToHead({ kind: "none" }) }, noGameWords("Team 1", 6)],
    ["on a bye", { matchup: headToHead({ kind: "bye" }) }, byeWords("Team 1")],
    ["for a gameweek that can't be scored", { matchup: headToHead({ kind: "unscored", opponent: { kind: "team", teamName: "Team 2" }, reason: "a rule is broken" }) }, unscoredWords("a rule is broken")],
  ])("says so %s", async (_, matchup, words) => {
    openMatchup(matchup);
    expect(await screen.findByText(words)).toBeTruthy();
  });

  it("before the deadline shows who meets whom and when the lineups show, and no lineup", async () => {
    const deadline = Date.parse("2026-11-01T11:00:00Z");
    openMatchup({ matchup: headToHead({ kind: "notBegun", opponent: { kind: "team", teamName: "Team 2" } }, { deadline }) });
    expect(await screen.findByText(notBegunWords(deadline))).toBeTruthy();
    expect(screen.getByText("Team 2")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
