import { expect, test } from "vitest";

// ARCHITECTURE.md "Where code lives", rule 7, beside featureImports.test.ts (#1814). A builder
// starts a test by copying a neighbour, so setup two test files share ends up in both instead of
// in tests/support/. This fails on either: a test file defining a top-level name tests/support/
// exports, or the same run of TWIN_RUN lines in two test files. The twins the 11 Nov passes found
// sit in STILL_TWINNED, which only shrinks. Rows a test inserts (`db.insert`) are left for later.

const TESTS = import.meta.glob(["../**/*.test.{ts,tsx}", "!../support/**"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const SUPPORT = import.meta.glob("../support/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
/** A glob key from the repo's root: the globs key this folder's files "./…", the rest "../…". */
const repoPath = (key: string) =>
  key.startsWith("./")
    ? `tests/convex/${key.slice(2)}`
    : `tests/${key.slice(3)}`;

/** The fewest lines two test files may share in a row before they count as one copied. */
const TWIN_RUN = 12;

/** Each entry goes when its setup moves to tests/support/ (#1814): "a <-> b" for a shared run,
 *  "file defines name" for a name tests/support/ already exports. */
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
  "tests/convex/featureImports.test.ts defines nameOf",
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
  "tests/convex/mail/letterWords.test.ts defines ANN",
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
  "tests/convex/squads/squadLimits.test.ts defines CENTRE_BACK, KEEPER",
  "tests/convex/squads/squadNumbers.test.ts defines RICE",
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
  "tests/src/gameweeks/gameweeks.test.tsx defines rowOf",
  "tests/src/home/news.test.tsx defines rows",
  "tests/src/joining/joinPage.test.tsx defines TOKEN, openLink",
  "tests/src/leagues/leagues.test.tsx defines rowOf",
  "tests/src/leagues/liveLeagues.test.tsx defines undo",
  "tests/src/leagueSettings/leagueSettings.scoringStart.test.tsx defines season",
  "tests/src/mail/mail.test.tsx defines commissioner",
  "tests/src/matchup/breakdown.test.tsx defines ALL",
  "tests/src/matchup/matchup.test.tsx defines KICKOFF",
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
  "tests/src/scouting/scouts/scoutsPanel.test.tsx defines PALMER, SAKA, openScouting",
  "tests/src/scouting/shortlist/shortlist.test.tsx defines RICE, SAKA, openCard, openScouting",
  "tests/src/scouting/statRace.test.tsx defines rowOf, team",
  "tests/src/squads/squadsAutoTeam.test.tsx defines team",
  "tests/src/trades/counter.test.tsx defines box",
  "tests/src/trades/minuteTurn.test.tsx defines turnTheMinute",
  "tests/src/trades/offerSides.test.ts defines DEADLINE",
  "tests/src/ui/columnHeads.test.tsx defines table",
  "tests/src/ui/tickBox.test.tsx defines box",
];

/** A top-level name. A `let` is left out: it's state each file sets in its own beforeEach. */
const DEFINED =
  /^(?:export\s+)?(?:declare\s+)?(?:async\s+)?(?:function\*?|const|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm;
const EXPORT_LIST = /^export\s+(?:type\s+)?\{([^}]*)\}/gm;

/** Every name a file exports, by the file that exports it. */
function supportExports(support: Record<string, string>): Map<string, string> {
  const owners = new Map<string, string>();
  for (const [key, source] of Object.entries(support)) {
    const names = [...source.matchAll(DEFINED)]
      .filter(([line]) => line.startsWith("export"))
      .map(([, name]) => name);
    for (const [, list] of source.matchAll(EXPORT_LIST))
      for (const item of list.split(",")) {
        const name = item
          .trim()
          .split(/\s+as\s+/)
          .pop()
          ?.replace(/^type\s+/, "");
        if (name) names.push(name);
      }
    for (const name of names)
      if (!owners.has(name)) owners.set(name, repoPath(key));
  }
  return owners;
}

type Twin = { entry: string; message: string };

/** The harnesses by the feature a test file sits under, else where a new one would go. */
function harnessFor(testPath: string, support: Record<string, string>): string {
  const [, root, feature] = testPath.split("/");
  const folder = `tests/support/${root}/`;
  const feature0 = feature.replace(/\.test\.tsx?$/, "");
  const found = Object.keys(support)
    .map(repoPath)
    .filter(
      (path) =>
        path.startsWith(folder) &&
        path.slice(folder.length).startsWith(feature0),
    );
  return found.length > 0
    ? found.join(" or ")
    : `a new ${folder}${feature0}.harness.ts`;
}

/** Test files defining at the top level a name tests/support/ exports. */
function redefined(
  tests: Record<string, string>,
  support: Record<string, string>,
): Twin[] {
  const owners = supportExports(support);
  const found: Twin[] = [];
  for (const [key, source] of Object.entries(tests)) {
    const path = repoPath(key);
    const names = [
      ...new Set([...source.matchAll(DEFINED)].map(([, name]) => name)),
    ]
      .filter((name) => owners.has(name))
      .sort();
    if (names.length === 0) continue;
    found.push({
      entry: `${path} defines ${names.join(", ")}`,
      message: names
        .map(
          (name) =>
            `${path} defines ${name}, which ${owners.get(name)} exports: import it from there.`,
        )
        .join("\n"),
    });
  }
  return found;
}

type Line = { text: string; at: number };

/** A file's lines to compare: trimmed, without blank lines or imports. */
function comparedLines(source: string): Line[] {
  const lines: Line[] = [];
  let inImport = false;
  source.split("\n").forEach((raw, index) => {
    const text = raw.trim();
    if (inImport) {
      if (/\bfrom\s*["'][^"']+["'];?$/.test(text)) inImport = false;
      return;
    }
    if (/^import[\s{]/.test(text)) {
      inImport = !/["'];?$/.test(text);
      return;
    }
    if (text !== "") lines.push({ text, at: index + 1 });
  });
  return lines;
}

const expectOnly = (run: Line[]) =>
  run.every(({ text }) => text.startsWith("expect"));

/** Pairs of test files sharing a run of TWIN_RUN or more lines, once per pair. */
function sharedRuns(
  tests: Record<string, string>,
  support: Record<string, string>,
): Twin[] {
  const firstSeen = new Map<string, { path: string; at: number }>();
  const pairs = new Map<string, Twin>();
  for (const key of Object.keys(tests).sort()) {
    const path = repoPath(key);
    const lines = comparedLines(tests[key]);
    for (let start = 0; start + TWIN_RUN <= lines.length; start++) {
      const run = lines.slice(start, start + TWIN_RUN);
      if (expectOnly(run)) continue;
      const window = run.map(({ text }) => text).join("\n");
      const seen = firstSeen.get(window);
      if (!seen) {
        firstSeen.set(window, { path, at: run[0].at });
        continue;
      }
      if (seen.path === path) continue;
      const entry = `${seen.path} <-> ${path}`;
      if (pairs.has(entry)) continue;
      pairs.set(entry, {
        entry,
        message:
          `${seen.path}:${seen.at} and ${path}:${run[0].at} share ${TWIN_RUN} or more lines: ` +
          `move them to ${harnessFor(path, support)} and import them in both.`,
      });
    }
  }
  return [...pairs.values()];
}

const twins = (
  tests: Record<string, string> = TESTS,
  support: Record<string, string> = SUPPORT,
) =>
  [...redefined(tests, support), ...sharedRuns(tests, support)].sort((a, b) =>
    a.entry.localeCompare(b.entry),
  );

test("no test file copies setup tests/support/ has, or another test file's, but those still to move", () => {
  const found = twins();
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
  expect(Object.keys(TESTS).some((key) => key.startsWith("../support/"))).toBe(
    false,
  );
  const setup = Array.from(
    { length: TWIN_RUN },
    (_, n) => `  const row${n} = make(${n});`,
  );
  const expects = Array.from(
    { length: TWIN_RUN + 3 },
    (_, n) => `  expect(row).toBe(${n});`,
  );
  const support = {
    "../support/convex/draft.harness.ts": [
      "export async function seedDraft() {}",
      "export const PICKS = 3;",
      "export { pickOrder as order, type Pick };",
    ].join("\n"),
  };
  const tests = {
    "../convex/draft/clock.test.ts": [
      'import { seedDraft } from "../../support/convex/draft.harness";',
      "async function seedDraft() {}",
      "const order = [];",
      'test("one", () => {',
      ...setup,
      "});",
      ...expects,
    ].join("\n"),
    "../convex/draft/undo.test.ts": [
      "import {",
      "  PICKS,",
      '} from "../../support/convex/draft.harness";',
      'test("two", () => {',
      "",
      ...setup,
      "});",
      ...expects,
    ].join("\n"),
    "../src/home/home.test.tsx": [
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
      { "../src/home/home.test.tsx": tests["../src/home/home.test.tsx"] },
      support,
    ),
  ).toEqual([]);
});
