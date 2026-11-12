import { expect, test } from "vitest";

// ARCHITECTURE.md "Where code lives", rule 4, beside importCycles.test.ts, which catches only a
// loop (#1330, #1581). A feature imports another only through what that one offers others: its
// Link component, its seam's types, its paths.ts, its live<Feature>.ts (into a live file) and its
// preview.ts (into a preview). And a feature's words.ts never re-exports another feature's words;
// words two features say live in src/shared/words.ts. The breaches the 11 Nov review found sit in
// STILL_REACHING_IN, which only shrinks.

const SOURCES = import.meta.glob("../../src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const SOURCE_PREFIX = "../../";

/** `import … from "x"` and `export … from "x"`, the clause kept to tell type-only ones apart. */
const FROM_CLAUSE =
  /^\s*(import|export)\s+([^;=]*?)\s*from\s*["']([^"']+)["']/gm;

/** Folders that join every feature (the app's start and the routes), so they import any of them,
 *  as does src/'s top level (main.tsx). */
const JOINERS = new Set(["app", "routes"]);
/** Folders under src/ every feature may import: no feature owns them. src/rules/ is the editing
 *  kit the two rules screens share, by ARCHITECTURE.md's own line. */
const OPEN = new Set(["shared", "ui", "rules"]);
/** One feature's files ARCHITECTURE.md names as offered to others: the menu's section paths,
 *  which every feature's paths.ts builds on, and Mail's date block. */
const OFFERED_FILES = new Set(["src/frame/menu", "src/mail/DateBlock"]);

/** Cross-feature imports past the rule, as "importer -> target" without the extension. Each goes
 *  when its target moves to src/ui/ or src/shared/, or becomes something its owner offers. */
const STILL_REACHING_IN: string[] = [
  // The pitch's drawing and the form chips, each used by a third feature: for src/ui/ (#1581).
  "src/matchup/PlayerTile -> src/myTeam/tactics/pitch/Pitch",
  "src/matchup/SidePitch -> src/myTeam/tactics/pitch/Pitch",
  "src/matchup/SidePitch -> src/myTeam/tactics/pitch/PitchLines",
  "src/matchup/SidePitch -> src/myTeam/tactics/pitch/RoleRuns",
  "src/matchup/SidePitch -> src/myTeam/tactics/pitch/rowLayout",
  "src/playerCard/CardHead -> src/myTeam/tactics/pitch/Pitch",
  "src/home/HomePage -> src/myTeam/header/FormChips",
  "src/home/YourMatchup -> src/myTeam/header/FormChips",
  "src/table/TablePage -> src/myTeam/header/FormChips",
  // Other parts one feature draws and another shows.
  "src/draft/CommissionerPanel -> src/leagueSettings/pickClock",
  "src/draft/playersView -> src/scouting/findPlayers",
  "src/frame/AppFrame -> src/feedback/FeedbackPage",
  "src/frame/LeaguelessFrame -> src/feedback/FeedbackPage",
  "src/home/HomePage -> src/matchup/Vidiprinter",
  "src/premierLeague/MatchPage -> src/matchup/Vidiprinter",
  "src/home/HomePage -> src/myTeam/squad/MailWidget",
  "src/leagueSettings/SettingsPage -> src/myTeam/claims/EveryTeamTable",
  "src/leagueSettings/SettingsPage -> src/myTeam/claims/WaiverOrderPanel",
  "src/mail/MailPage -> src/leagues/access",
  "src/mail/preview -> src/frame/topBar/topBarState",
  "src/matchup/MatchupPage -> src/leagues/access",
  "src/matchup/PlayerBreakdown -> src/playerCard/Breakdown",
  "src/matchup/SidePanel -> src/myTeam/tactics/TacticsControls",
  "src/matchup/SidePitch -> src/myTeam/tactics/lineupEdits",
  "src/myTeam/FixturesSidePanels -> src/trades/OfferParts",
  "src/myTeam/preview -> src/table/drawnTable",
  "src/myTeam/tactics/roleCard/RoleMatches -> src/playerCard/Breakdown",
  "src/scoring/Patches -> src/patches/LabReport",
  "src/scoring/ScoringPage -> src/patches/PatchBanner",
  "src/scouting/ComparePanel -> src/playerCard/WaiverAction",
  "src/scouting/SelectedPlayer -> src/myTeam/claims/claimGroups",
  "src/scouting/SelectedPlayer -> src/playerCard/ShortlistAction",
  "src/scouting/SelectedPlayer -> src/playerCard/WaiverAction",
  "src/scouting/preview -> src/draft/previewLists",
  "src/scouting/scouts/ScoutsPanel -> src/playerCard/ScoutAction",
  "src/table/TablePage -> src/myTeam/header/teamStanding",
  // Another feature's words, read where src/shared/words.ts would serve.
  "src/admin/words -> src/feedback/words",
  "src/draft/DraftPlayers -> src/scouting/words",
  "src/draft/PickPanel -> src/scouting/words",
  "src/frame/LeaguelessFrame -> src/leagues/words",
  "src/frame/topBar/LeagueSwitcher -> src/leagues/words",
  "src/frame/topBar/MenuTab -> src/mail/words",
  "src/frame/topBar/topBarState -> src/mail/words",
  "src/home/HomePage -> src/table/words",
  "src/home/YourMatchup -> src/matchup/words",
  "src/home/words -> src/table/words",
  "src/joining/JoinPage -> src/leagues/words",
  "src/joining/liveJoining -> src/signIn/words",
  "src/joining/preview -> src/signIn/words",
  "src/joining/words -> src/leagues/words",
  "src/leagueSettings/SettingsPage -> src/myTeam/claims/words",
  "src/leagueSettings/WaiversPanel -> src/myTeam/claims/words",
  "src/leagues/LeaguesPage -> src/admin/words",
  "src/leagues/LeaguesPage -> src/gameweeks/words",
  "src/leagues/LeaguesPage -> src/joining/words",
  "src/leagues/LeaguesPage -> src/leagueSettings/words",
  "src/leagues/LeaguesPage -> src/scoring/words",
  "src/leagues/LeaguesPage -> src/squads/words",
  "src/leagues/NewLeaguePage -> src/admin/words",
  "src/myTeam/FixturesPage -> src/table/words",
  "src/myTeam/FixturesSidePanels -> src/table/words",
  "src/myTeam/squad/MailWidget -> src/mail/words",
  "src/playerCard/ScoutAction -> src/scouting/scouts/words",
  "src/playerCard/ScoutReport -> src/scouting/scouts/words",
  "src/playerCard/ShortlistAction -> src/scouting/shortlist/words",
  "src/playerCard/words -> src/myTeam/claims/words",
  "src/scoring/Patches -> src/patches/words",
  "src/scouting/liveScouting -> src/draft/words",
  "src/scouting/scouts/words -> src/draft/words",
  "src/scouting/words -> src/myTeam/claims/words",
];

/** The feature a path under src/ belongs to: its first folder. */
const featureOf = (path: string) => path.split("/")[1];
const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const withoutExtension = (path: string) => path.replace(/\.tsx?$/, "");

function resolve(from: string, specifier: string): string {
  const parts = from.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
}

/** True when the clause brings in only types. */
function typeOnly(clause: string): boolean {
  if (/^type\s/.test(clause)) return true;
  const braces = clause.match(/^\{([\s\S]*)\}$/);
  if (!braces) return false;
  const names = braces[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return names.length > 0 && names.every((name) => /^type\s/.test(name));
}

/** True when `target` is something its feature offers the importer, by rule 4. */
function offered(
  importer: string,
  target: string,
  clause: string,
  kind: string,
): boolean {
  if (OFFERED_FILES.has(target)) return true;
  const name = nameOf(target);
  const from = nameOf(withoutExtension(importer));
  if (name === "paths" || /Links?$/.test(name)) return true;
  if (name === "seam") return kind === "import" && typeOnly(clause);
  if (name === "preview") return from === "preview";
  if (/^live[A-Z]/.test(name)) return /^live[A-Z]/.test(from);
  return false;
}

type CrossImport = { line: string; wordsReexport: boolean };

/** Every import into another feature that isn't something it offers, and every words.ts
 *  re-export from another feature, offered or not, as "importer -> target". */
function crossImports(sources: Record<string, string>): CrossImport[] {
  const found = new Map<string, CrossImport>();
  for (const [key, source] of Object.entries(sources)) {
    const path = key.slice(SOURCE_PREFIX.length);
    if (JOINERS.has(featureOf(path)) || path.split("/").length === 2) continue;
    for (const [, kind, clause, specifier] of source.matchAll(FROM_CLAUSE)) {
      if (!specifier.startsWith(".") || /\.css$/.test(specifier)) continue;
      const target = withoutExtension(resolve(path, specifier));
      if (
        !target.startsWith("src/") ||
        featureOf(target) === featureOf(path) ||
        OPEN.has(featureOf(target))
      )
        continue;
      const wordsReexport = kind === "export" && nameOf(path) === "words.ts";
      const line = `${withoutExtension(path)} -> ${target}`;
      if (wordsReexport || !offered(path, target, clause, kind))
        found.set(line, {
          line,
          wordsReexport:
            wordsReexport || found.get(line)?.wordsReexport === true,
        });
    }
  }
  return [...found.keys()].sort().map((line) => found.get(line)!);
}

const reachingIn = (sources: Record<string, string> = SOURCES) =>
  crossImports(sources).map(({ line }) => line);
const crossFeatureReexports = (sources: Record<string, string> = SOURCES) =>
  crossImports(sources)
    .filter(({ wordsReexport }) => wordsReexport)
    .map(({ line }) => line);

test("no feature's words.ts re-exports another feature's words but those still to move", () => {
  // None is left to move (#1581), so none may come back, even of words a feature offers.
  expect(crossFeatureReexports()).toEqual([]);
});

test("no feature reaches into another's insides but those still to move", () => {
  expect(reachingIn()).toEqual([...STILL_REACHING_IN].sort());
});

test("finds the re-exports it is there to catch", () => {
  expect(Object.keys(SOURCES).length).toBeGreaterThan(100);
  expect(resolve("src/home/words.ts", "../table/words")).toBe(
    "src/table/words",
  );
  const sources = {
    "../../src/home/words.ts":
      'export { TABLE_TITLE } from "../table/words";\nimport { columns } from "../table/words";',
    "../../src/home/HomePage.tsx": [
      'import { FormChips } from "../myTeam/header/FormChips";',
      'import { MatchupLink } from "../matchup/MatchupLink";',
      'import { tablePath } from "../table/paths";',
      'import type { TableSeam } from "../table/seam";',
      'import { tableSeam } from "../table/seam";',
      'import { previewTable } from "../table/preview";',
      'import { Panel } from "../ui/Panel";',
      'import { HOME_PATH } from "../frame/menu";',
    ].join("\n"),
    "../../src/home/preview.ts":
      'import { previewTable } from "../table/preview";',
    "../../src/home/liveHome.ts":
      'import { liveTable } from "../table/liveTable";',
    "../../src/routes/router.tsx":
      'import { TablePage } from "../table/TablePage";',
    "../../src/main.tsx": 'import { liveApp } from "./app/liveApp";',
  };
  expect(reachingIn(sources)).toEqual([
    "src/home/HomePage -> src/myTeam/header/FormChips",
    "src/home/HomePage -> src/table/preview",
    "src/home/HomePage -> src/table/seam",
    "src/home/words -> src/table/words",
  ]);
  expect(crossFeatureReexports(sources)).toEqual([
    "src/home/words -> src/table/words",
  ]);
});
