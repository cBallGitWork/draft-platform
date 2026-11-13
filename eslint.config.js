// The lint step (#154): React's two hook rules, so a hand-written dependency list is checked, and
// a few bans that keep a value with one owner from being typed again (design values in
// src/styles.css, those #1810 names, a team's starting name in Convex tests, and a named helper written out by hand, #1806); no style rule
// sets. Why ESLint: ARCHITECTURE.md, Libraries ("Lint").
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

// Where React runs; why convex/ and its tests are left out of the hook rules: ARCHITECTURE.md, Libraries ("Lint").
const REACT_FILES = ["src/**/*.{ts,tsx}", "tests/src/**/*.{ts,tsx}", "tests/support/src/**/*.{ts,tsx}"];
const SRC_FILES = ["src/**/*.{ts,tsx}"];
const CONVEX_FILES = ["convex/**/*.ts"];
const CONVEX_TEST_FILES = ["tests/convex/**/*.ts", "tests/support/convex/**/*.ts"];

/** A ban on a string: as a plain literal or as a piece of a template literal. */
const stringBan = (pattern, message) => [
  { selector: `Literal[value=${pattern}]`, message },
  { selector: `TemplateElement[value.raw=${pattern}]`, message },
];

// A Tailwind class with an arbitrary colour (`bg-[#123456]`) or pixel size (`w-[13px]`) puts a
// design value in a component instead of a token in src/styles.css (docs/design/plate.md; the
// tokens are its one source). Any string in the app's code is checked, a className's or a
// constant's that becomes one.
const ARBITRARY_VALUE_BAN = stringBan(
  "/\\[#|-\\[[0-9]+px\\]/",
  "An arbitrary Tailwind colour or px value ([#…] or -[Npx]): add a token to src/styles.css and use it (docs/design/plate.md).",
);

// A patch version's heading id, which the patch link jumps to: src/patches/paths.ts owns it.
const VERSION_ANCHOR_BAN = stringBan("/(^|#)version-/", "A patch version's heading id typed by hand: use versionAnchor from src/patches/paths.ts.");

// A literal locale handed to toLocale*: convex/shared/moments.ts owns it.
const LOCALE_BAN = [
  {
    selector: "CallExpression[callee.property.name=/^toLocale/] > Literal.arguments",
    message: "A locale typed by hand: pass LOCALE from convex/shared/moments.ts.",
  },
];

// A League settings box ticked on opens blank: src/rules/blank.ts names that value.
const BLANK_NUMBER_BAN = [
  { selector: "Identifier[name='NaN']", message: "NaN typed by hand: use BLANK_NUMBER or blankOrOff from src/rules/blank.ts." },
];

/** A stringBan in tests, where a test's or a describe's own title may name the string. */
const TEST_TITLE = "CallExpression[callee.name=/^(test|it|describe)$/] > ";
const testStringBan = (pattern, message) => [
  { selector: `Literal[value=${pattern}]:not(${TEST_TITLE}Literal)`, message },
  { selector: `TemplateElement[value.raw=${pattern}]:not(${TEST_TITLE}TemplateLiteral > TemplateElement)`, message },
];

// A smoke test's preview session in its address.
const PREVIEW_BAN = testStringBan("/preview=/", "?preview= typed by hand: use previewUrl(path, session) from tests/support/smoke/previewUrl.ts.");

// A new team's starting name ("Team 3", or `Team ${n}`) in a Convex test: convex/leagues/teams.ts
// owns it. tests/src is left out (#1810).
const TEAM_NUMBERED_BAN = testStringBan(
  "/Team [0-9]|Team $/",
  "A team's starting name typed by hand: use teamNumbered(n), or TEAM_1 to TEAM_4 from tests/support/convex/leagues.harness.ts.",
);

// A rule with a named helper, written out by hand (#1806): each entry matches the hand-written
// form, and its message names the helper and its home, so the fix is one import. `src` says the
// helper is the screens' own, so convex/ isn't checked for it. A new helper lands with its entry.
const HELPERS = [
  {
    helper: "seasonStartAt(at)",
    home: "convex/shared/time.ts",
    does: "when the season `at` falls in began",
    selectors: [
      "CallExpression[callee.name='seasonStartOf'] > CallExpression.arguments[callee.name='seasonStartYear']",
      "CallExpression[callee.object.name='Date'][callee.property.name='UTC'] > CallExpression.arguments[callee.name='seasonStartYear']",
    ],
  },
  {
    helper: "draftIsOver(ctx, leagueId)",
    home: "convex/draft/draftRow.ts",
    does: "whether a league's draft has started and is no longer live",
    selectors: [
      ":not(LogicalExpression) > LogicalExpression:has(CallExpression[callee.name='draftIsLive']):has(CallExpression[callee.name='draftHasStarted'], MemberExpression[property.name='started'])",
    ],
  },
  {
    helper: "byKickoff(matches) or byKickoffOrder",
    home: "convex/shared/fixtures.ts",
    does: "matches earliest kickoff first, those with no kickoff time last",
    selectors: ["LogicalExpression[operator='??'][left.property.name='kickoff'][right.name='Infinity']"],
  },
  {
    helper: "firstKickoffs(matches)",
    home: "convex/gameweeks/gameweekStarts.ts",
    does: "each gameweek's first kickoff",
    selectors: [
      "CallExpression[callee.object.name='Math'][callee.property.name='min'] > LogicalExpression.arguments[operator='??'][left.callee.property.name='get']",
    ],
  },
  {
    helper: "nextDeadline(deadlines, from)",
    home: "convex/gameweeks/deadline.ts",
    does: "a league's soonest deadline after a moment",
    selectors: ["ForOfStatement[right.name=/[dD]eadlines$/] CallExpression[callee.object.name='Math'][callee.property.name='min']"],
  },
  {
    helper: "inBatches(rows)",
    home: "convex/shared/syncRuns.ts",
    does: "rows in slices of BATCH_SIZE",
    selectors: ["AssignmentExpression[operator='+='][right.name='BATCH_SIZE']", "BinaryExpression[operator='+'][right.name='BATCH_SIZE']"],
  },
  {
    helper: "idOf<Table>(value)",
    home: "src/shared/search.ts",
    does: "a row's id read from a search, any non-empty string, else dropped",
    src: true,
    selectors: ["ConditionalExpression[test.left.left.operator='typeof'][consequent.typeAnnotation.typeName.name='Id']"],
  },
  {
    helper: "useChange()",
    home: "src/shared/useChange.ts",
    does: "a change's busy and refused state, never left busy when it throws (#253)",
    src: true,
    selectors: ["VariableDeclarator > ArrayPattern.id > Identifier[name='setBusy']"],
  },
];

/** The helper entries checked in src/ (`forSrc`) or convex/, less any whose home is `except`. */
const helperBans = (forSrc, except = null) =>
  HELPERS.filter(({ src, home }) => (forSrc || !src) && home !== except).flatMap(({ helper, home, does, selectors }) =>
    selectors.map((selector) => ({ selector, message: `Written by hand: ${does}. Use ${helper} from ${home}.` })),
  );

// Flat config never merges no-restricted-syntax: a later block matching a file replaces the list,
// so each block below holds its files' whole list.
const bans = (...lists) => ({ "no-restricted-syntax": ["error", ...lists.flat()] });

/** A block for each helper's home in src/ (`forSrc`) or convex/, its area's `lists` and every
 *  helper entry but its own. */
const homeBlocks = (forSrc, ...lists) =>
  HELPERS.filter(({ home }) => home.startsWith(forSrc ? "src/" : "convex/")).map(({ home }) => ({
    files: [home],
    rules: bans(...lists, helperBans(forSrc, home)),
  }));

export default [
  // ESLint also lints every .js, .mjs and .cjs file by default; none of ours holds React.
  { ignores: ["**/*.{js,mjs,cjs}", "convex/_generated/**"] },
  {
    files: REACT_FILES,
    languageOptions: { parser: tsParser },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  { files: SRC_FILES, rules: bans(ARBITRARY_VALUE_BAN, VERSION_ANCHOR_BAN, LOCALE_BAN, helperBans(true)) },
  { files: ["src/patches/paths.ts"], rules: bans(ARBITRARY_VALUE_BAN, LOCALE_BAN, helperBans(true)) },
  {
    files: ["src/leagueSettings/**/*.{ts,tsx}"],
    rules: bans(ARBITRARY_VALUE_BAN, VERSION_ANCHOR_BAN, LOCALE_BAN, BLANK_NUMBER_BAN, helperBans(true)),
  },
  ...homeBlocks(true, ARBITRARY_VALUE_BAN, VERSION_ANCHOR_BAN, LOCALE_BAN),
  // convex/ has no React, so only the parser and its bans.
  {
    files: CONVEX_FILES,
    languageOptions: { parser: tsParser },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: bans(LOCALE_BAN, helperBans(false)),
  },
  { files: ["convex/shared/moments.ts"], rules: bans(helperBans(false)) },
  ...homeBlocks(false, LOCALE_BAN),
  { files: ["tests/smoke/**/*.ts"], languageOptions: { parser: tsParser }, rules: bans(PREVIEW_BAN) },
  { files: CONVEX_TEST_FILES, languageOptions: { parser: tsParser }, rules: bans(TEAM_NUMBERED_BAN) },
];
