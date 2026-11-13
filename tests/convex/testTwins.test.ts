import { expect, test } from "vitest";
import { twins, TWIN_RUN } from "../support/convex/testTwins.harness";

// ARCHITECTURE.md "Where code lives", rule 7, beside importCycles.test.ts (#1814). A builder
// starts a test by copying a neighbour, so setup two test files share ends up in both instead of
// in tests/support/. This fails on either: a test file defining a top-level name tests/support/
// exports, or the same run of TWIN_RUN lines in two test files (the reading is in
// testTwins.harness.ts). The twins the 11 Nov passes found sit in STILL_TWINNED, which only
// shrinks. Rows a test inserts (`db.insert`) are left for later.

/** A glob key from the repo's root: the globs key this folder's files "./…", the rest "../…". */
const byRepoPath = (glob: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(glob).map(([key, source]) => [
      key.startsWith("./")
        ? `tests/convex/${key.slice(2)}`
        : `tests/${key.slice(3)}`,
      source,
    ]),
  );
const TESTS = byRepoPath(
  import.meta.glob(["../**/*.test.{ts,tsx}", "!../support/**"], {
    query: "?raw",
    import: "default",
    eager: true,
  }),
);
const SUPPORT = byRepoPath(
  import.meta.glob("../support/**/*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
);

/** Each entry goes when its setup moves to tests/support/ (#1814): "a <-> b" for a shared run,
 *  "file defines names" for names tests/support/ already exports. */
const STILL_TWINNED: string[] = [
  // The same run of lines in two test files.
  "tests/convex/gameweeks/scoringStart.test.ts <-> tests/convex/table/playedFixtures.test.ts",
  "tests/convex/lineup/lineups.squadAtDeadline.test.ts <-> tests/convex/lineup/lineups.storedFirstLineup.test.ts",
  "tests/convex/lineup/lineups.squadAtDeadline.test.ts <-> tests/convex/lineup/lineups.test.ts",
  "tests/convex/lineup/lineups.storedFirstLineup.test.ts <-> tests/convex/lineup/lineups.test.ts",
  // A name tests/support/ exports, defined again.
  "tests/convex/availability/availability.test.ts defines synced",
  "tests/convex/draft/autoPickOrder.test.ts defines PALMER, SAKA",
  "tests/convex/draft/draftBoard.test.ts defines PALMER, SAKA",
  "tests/convex/draft/draftCommissioner.test.ts defines undo",
  "tests/convex/draft/draftLists.test.ts defines as, namesOn",
  "tests/convex/draft/draftRanking.test.ts defines ODEGAARD, RICE, held",
  "tests/convex/draft/draftStart.test.ts defines as",
  "tests/convex/draft/legalPlayers.test.ts defines ARSENAL, CENTRE_BACK, CHELSEA, KEEPER, STRIKER",
  "tests/convex/draft/pickWindow.test.ts defines squadOf, undo",
  "tests/convex/draft/shortlistQueue.test.ts defines as, namesOn",
  "tests/convex/feedback/feedback.test.ts defines list",
  "tests/convex/football/feeds.test.ts defines fakeFeeds",
  "tests/convex/football/footballSync.test.ts defines SAKA",
  "tests/convex/football/matchCommentary.test.ts defines IPSWICH_FOREST",
  "tests/convex/football/matchScores.test.ts defines COVENTRY, SPURS",
  "tests/convex/football/plStandings.test.ts defines COVENTRY, table",
  "tests/convex/football/plTable.test.ts defines rowOf",
  "tests/convex/football/scoreReads.test.ts defines LIVE_MATCH, UPCOMING_MATCH",
  "tests/convex/football/sportmonks/sportmonksPositionsSync.test.ts defines KICKOFF, LAST_SEASON, TOKEN, fakeSportmonks, rowOf",
  "tests/convex/gameweeks/deadline.test.ts defines season",
  "tests/convex/gameweeks/gameweekStarts.test.ts defines MATCHES, record, rows",
  "tests/convex/gameweeks/leagueGameweeks.test.ts defines NEXT, holdGameweeks, kickoffOf",
  "tests/convex/gameweeks/postponedGameweek.test.ts defines NEXT",
  "tests/convex/gameweeks/roundStarts.test.ts defines sync",
  "tests/convex/gameweeks/scoringStart.test.ts defines KICKS_OFF_IN, table",
  "tests/convex/gameweekScorer/scoredMatches.test.ts defines LEFT_CENTRE_MIDFIELDER",
  "tests/convex/gameweekScorer/teamGameweek.test.ts defines held, slot",
  "tests/convex/home/leagueHome.test.ts defines RICE, SAKA",
  "tests/convex/home/leagueNews.test.ts defines RICE, SAKA",
  "tests/convex/home/matchday.test.ts defines at",
  "tests/convex/leagues/myLeagues.test.ts defines accountOf",
  "tests/convex/lineup/classics.test.ts defines roleOf",
  "tests/convex/lineup/firstLineupBackfill.test.ts defines lineupOf",
  "tests/convex/lineup/instructions.test.ts defines ALL",
  "tests/convex/lineup/lineup.test.ts defines KEEPER, LEFT_BACK, LEFT_MIDFIELDER, OTHER_STRIKER, RIGHT_BACK, STRIKER",
  "tests/convex/lineup/lineups.classic.test.ts defines save",
  "tests/convex/lineup/lineups.lostPosition.test.ts defines OTHER_STRIKER, STRIKER, save",
  "tests/convex/lineup/lineups.squadAtDeadline.test.ts defines as",
  "tests/convex/lineup/lineups.storedFirstLineup.test.ts defines as, lineupRows",
  "tests/convex/lineup/lineups.test.ts defines as, lineupRows",
  "tests/convex/lineup/lineupWords.test.ts defines nameOf",
  "tests/convex/lineup/presets.test.ts defines drawn",
  "tests/convex/lineup/roleCard.test.ts defines CENTRE_BACK, MATCHES",
  "tests/convex/lineup/roleEligibility.test.ts defines LEFT_WINGER, STRIKER",
  "tests/convex/lineup/roles.test.ts defines names",
  "tests/convex/lineup/savedPlans.test.ts defines as",
  "tests/convex/match/sheetOrder.test.ts defines man",
  "tests/convex/matchup/instructionLines.test.ts defines KICKOFF, MATCH, MIDFIELD, RICE, team",
  "tests/convex/matchup/matchup.test.ts defines ARSENAL",
  "tests/convex/matchup/vidiprinter.test.ts defines ATTACK, IPSWICH_FOREST, KICKOFF, MATCH, MIDFIELD, played",
  "tests/convex/pastSeasons/pastSeasonPoints.test.ts defines NEWCOMER, PALMER",
  "tests/convex/playerCard/playerCard.test.ts defines LAST_SEASON, SAKA, fixture",
  "tests/convex/playerCard/positionRank.test.ts defines LAST_SEASON, NEWCOMER",
  "tests/convex/positions/positions.test.ts defines held",
  "tests/convex/positions/positionWarnings.test.ts defines lettersTo",
  "tests/convex/rules/formatLock.test.ts defines KICKS_OFF_IN",
  "tests/convex/rules/gameMode.test.ts defines STRIKER",
  "tests/convex/scoring/ownStats.test.ts defines fplLines, plLines",
  "tests/convex/scoring/patchAnnouncements.test.ts defines lettersTo",
  "tests/convex/scoring/patchKickoffs.test.ts defines GAMEWEEK",
  "tests/convex/scoring/redrawnRolesVersion.test.ts defines NEXT",
  "tests/convex/scoring/scoringOptions.test.ts defines LEFT_WINGER",
  "tests/convex/scoring/siteScoringFrozenStart.test.ts defines GAMEWEEK",
  "tests/convex/scouting/compare.test.ts defines PALMER",
  "tests/convex/scouting/per90.test.ts defines ODEGAARD, PALMER, RAYA, RICE",
  "tests/convex/scouting/period.test.ts defines KICKOFF, PALMER, rowOf",
  "tests/convex/scouting/playersList.test.ts defines PALMER, RICE",
  "tests/convex/scouting/playersListFigures.test.ts defines PALMER, RICE",
  "tests/convex/scouting/playersListKept.test.ts defines PALMER, RICE",
  "tests/convex/scouting/playersListOwnStats.test.ts defines PALMER, RICE",
  "tests/convex/scouting/scoutingPlayers.test.ts defines KICKOFF, rowOf, sent",
  "tests/convex/scouting/scouts.test.ts defines as",
  "tests/convex/scouting/shortlist.test.ts defines PALMER, SAKA, as, namesOn",
  "tests/convex/scouting/shownSeasonPoints.test.ts defines LAST_SEASON",
  "tests/convex/shared/fixtures.test.ts defines holdMatch",
  "tests/convex/shared/publicGates.test.ts defines Caller",
  "tests/convex/shared/scoringCaps.test.ts defines recordOf",
  "tests/convex/signIn/account.test.ts defines refresh",
  "tests/convex/signIn/signInLinks.test.ts defines REFUSED",
  "tests/convex/squads/areaMinimums.test.ts defines CENTRE_BACK",
  "tests/convex/squads/squadNumbers.test.ts defines RICE",
  "tests/convex/squads/squadRulesView.test.ts defines CENTRE_BACK, KEEPER",
  "tests/convex/squads/squads.test.ts defines as",
  "tests/convex/squads/teamSquad.test.ts defines GW1, GW2, PALMER, RAYA, SAKA, SAKA_GW1, SAKA_GW2, fixture, rowOf",
  "tests/convex/squads/teamTransactions.test.ts defines RICE",
  "tests/convex/squads/unheldPlayer.test.ts defines PALMER, squadRows",
  "tests/convex/stars/bestRole.test.ts defines CENTRE_BACK, NUMBER_TEN",
  "tests/convex/stars/deadlineStars.test.ts defines NEXT",
  "tests/convex/stats/matchRecordReads.test.ts defines FIXTURE",
  "tests/convex/stats/matchRecords.test.ts defines recordOf",
  "tests/convex/stats/matchRecordsCap.test.ts defines FIXTURE, MADE_UP_CODES, held",
  "tests/convex/stats/seasonRebuilds.test.ts defines sync",
  "tests/convex/stats/teamCountedStats.test.ts defines slot",
  "tests/convex/stats/thresholdSteps.test.ts defines at",
  "tests/convex/table/fixtureEdits.test.ts defines EDITED, KICKS_OFF_IN, swaps",
  "tests/convex/table/playedFixtures.test.ts defines KICKS_OFF_IN, played, recordPassed, setUsedIn",
  "tests/convex/table/standings.test.ts defines rowOf",
  "tests/convex/table/teamFixtures.test.ts defines readTable",
  "tests/convex/trades/reviewPause.test.ts defines undo",
  "tests/convex/trades/tradeReview.test.ts defines squadOf",
  "tests/convex/trades/tradeReviewEnd.test.ts defines squadOf",
  "tests/convex/waivers/beforeTheDraft.test.ts defines pickUp",
  "tests/convex/waivers/freeAgents.test.ts defines pickUp",
  "tests/convex/waivers/waivers.test.ts defines FREE_AGENT",
  "tests/src/admin/admin.test.tsx defines ARSENAL, NEWCASTLE",
  "tests/src/admin/availability.test.tsx defines SAKA",
  "tests/src/admin/clubColours.test.tsx defines ARSENAL",
  "tests/src/draft/draft.test.tsx defines pickOf",
  "tests/src/draft/draftPicking.test.tsx defines ODEGAARD, PALMER, RICE, SAKA, list",
  "tests/src/draft/undoMyPick.test.tsx defines SAKA",
  "tests/src/feedback/feedback.test.tsx defines box",
  "tests/src/flow.test.ts defines Row",
  "tests/src/gameweeks/gameweeks.test.tsx defines REFUSAL, rowOf",
  "tests/src/gameweeks/liveGameweeks.test.tsx defines REFUSAL",
  "tests/src/home/news.test.tsx defines rows",
  "tests/src/joining/joinPage.test.tsx defines TOKEN, openLink",
  "tests/src/leagues/leagues.test.tsx defines rowOf",
  "tests/src/leagues/liveLeagues.test.tsx defines undo",
  "tests/src/leagueSettings/leagueSettings.scoringStart.test.tsx defines season",
  "tests/src/matchup/breakdown.test.tsx defines ALL",
  "tests/src/matchup/matchup.test.tsx defines KICKOFF",
  "tests/src/matchup/paths.test.ts defines team",
  "tests/src/matchup/teamOverride.test.tsx defines GAMEWEEK, matchupOf",
  "tests/src/myTeam/fixtures.test.tsx defines cells",
  "tests/src/myTeam/header/autoTeamSwitch.test.tsx defines openPanel",
  "tests/src/myTeam/otherTeam.test.tsx defines table",
  "tests/src/myTeam/squad/squadWidgets.test.tsx defines openPanel",
  "tests/src/myTeam/tactics/classicLineup.test.ts defines NUMBER_TEN",
  "tests/src/myTeam/tactics/lineupEdits.test.ts defines KEEPER",
  "tests/src/myTeam/tactics/lineupMoves.test.ts defines KEEPER",
  "tests/src/myTeam/tactics/liveTactics.test.tsx defines LINEUP",
  "tests/src/myTeam/tactics/pitch/rowLayout.test.tsx defines rows",
  "tests/src/myTeam/tactics/pitch/slotLabels.test.tsx defines STRIKER",
  "tests/src/myTeam/tactics/pitch/sweeper.test.tsx defines CENTRE_BACK",
  "tests/src/myTeam/tactics/positionMarks.test.tsx defines LEFT_CENTRE_BACK",
  "tests/src/myTeam/tactics/quickPick.test.ts defines KEEPER, lineupOf",
  "tests/src/myTeam/tactics/roleCard/roleCard.test.tsx defines CAMEO, MATCHES",
  "tests/src/myTeam/tactics/savedPlans.test.ts defines IN_A_442",
  "tests/src/myTeam/tactics/tactics.swapping.test.tsx defines nameOf",
  "tests/src/myTeam/transactions.test.tsx defines SAKA, cells, rows",
  "tests/src/playerCard/livePlayerCard.test.tsx defines PLAYER_CODE",
  "tests/src/playerCard/overridePoints.test.tsx defines MATCH, SAKA, openCard",
  "tests/src/playerCard/waiverAction.test.tsx defines SQUAD",
  "tests/src/rules/rulesEdits.test.ts defines CHANGES_FROM, SAVED",
  "tests/src/scoring/scoringControls.test.tsx defines saveButton",
  "tests/src/scoring/staleSave.test.tsx defines REFUSAL",
  "tests/src/scouting/scouts/scoutsPanel.test.tsx defines PALMER, SAKA, openScouting",
  "tests/src/scouting/shortlist/shortlist.test.tsx defines REFUSAL, RICE, SAKA, openCard, openScouting",
  "tests/src/scouting/statRace.test.tsx defines rowOf, team",
  "tests/src/squads/squadsAutoTeam.test.tsx defines team",
  "tests/src/trades/counter.test.tsx defines box",
  "tests/src/trades/minuteTurn.test.tsx defines turnTheMinute",
  "tests/src/trades/offerSides.test.ts defines DEADLINE",
  "tests/src/ui/columnHeads.test.tsx defines table",
  "tests/src/ui/tickBox.test.tsx defines box",
];

test("no test file copies setup tests/support/ has, or another test file's, but those still to move", () => {
  const found = twins(TESTS, SUPPORT);
  const still = new Set(STILL_TWINNED);
  const fresh = found.filter(({ entry }) => !still.has(entry));
  expect(fresh.map(({ message }) => message)).toEqual([]);
  const entries = new Set(found.map(({ entry }) => entry));
  const gone = STILL_TWINNED.filter((entry) => !entries.has(entry));
  // A twin that's gone comes off STILL_TWINNED, so it can't come back.
  expect(gone).toEqual([]);
});

test("finds a planted twin and passes a clean file", () => {
  expect(Object.keys(TESTS).length).toBeGreaterThan(100);
  expect(Object.keys(SUPPORT).length).toBeGreaterThan(20);
  // Vite leaves this file out of its own glob, so two neighbours stand for the folders.
  expect(Object.keys(TESTS)).toContain("tests/convex/importCycles.test.ts");
  expect(Object.keys(TESTS)).toContain("tests/src/designTokens.test.ts");
  expect(
    Object.keys(TESTS).some((path) => path.startsWith("tests/support/")),
  ).toBe(false);
  const setup = Array.from(
    { length: TWIN_RUN },
    (_, n) => `  const row${n} = make(${n});`,
  );
  const expects = Array.from(
    { length: TWIN_RUN + 3 },
    (_, n) => `  expect(row).toBe(${n});`,
  );
  const support = {
    "tests/support/convex/draft.harness.ts": [
      "export async function seedDraft() {}",
      "export const PICKS = 3;",
      "export { pickOrder as order, type Pick };",
    ].join("\n"),
  };
  const tests = {
    "tests/convex/draft/clock.test.ts": [
      'import { seedDraft } from "../../support/convex/draft.harness";',
      "async function seedDraft() {}",
      "const order = [];",
      'test("one", () => {',
      ...setup,
      "});",
      ...expects,
    ].join("\n"),
    "tests/convex/draft/undo.test.ts": [
      "import {",
      "  PICKS,",
      '} from "../../support/convex/draft.harness";',
      'test("two", () => {',
      "",
      ...setup,
      "});",
      ...expects,
    ].join("\n"),
    "tests/src/home/home.test.tsx": [
      'test("clean", () => {',
      ...setup.slice(0, TWIN_RUN - 1),
      "  const different = 1;",
      ...expects,
      "});",
    ].join("\n"),
  };
  expect(twins(tests, support)).toEqual([
    {
      entry:
        "tests/convex/draft/clock.test.ts <-> tests/convex/draft/undo.test.ts",
      message:
        "tests/convex/draft/clock.test.ts:5 and tests/convex/draft/undo.test.ts:6 share 12 or " +
        "more lines: move them to tests/support/convex/draft.harness.ts and import them in both.",
    },
    {
      entry: "tests/convex/draft/clock.test.ts defines order, seedDraft",
      message:
        "tests/convex/draft/clock.test.ts defines order, which " +
        "tests/support/convex/draft.harness.ts exports: import it from there.\n" +
        "tests/convex/draft/clock.test.ts defines seedDraft, which " +
        "tests/support/convex/draft.harness.ts exports: import it from there.",
    },
  ]);
  expect(
    twins(
      { "tests/src/home/home.test.tsx": tests["tests/src/home/home.test.tsx"] },
      support,
    ),
  ).toEqual([]);
});
