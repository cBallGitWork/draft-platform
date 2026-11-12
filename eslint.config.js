// The lint step (#154): React's two hook rules, so a hand-written dependency list is checked, and
// `no-restricted-syntax` for a design value outside src/styles.css and for a named helper written
// out by hand (#1806); no style rule sets. Why ESLint: ARCHITECTURE.md, Libraries ("Lint").
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

// Where React runs; why convex/'s tests are left out: ARCHITECTURE.md, Libraries ("Lint").
const REACT_FILES = ["src/**/*.{ts,tsx}", "tests/src/**/*.{ts,tsx}", "tests/support/src/**/*.{ts,tsx}"];
const SRC_FILES = ["src/**/*.{ts,tsx}"];
const CONVEX_FILES = ["convex/**/*.ts"];

// A Tailwind class with an arbitrary colour (`bg-[#123456]`) or pixel size (`w-[13px]`) puts a
// design value in a component instead of a token in src/styles.css (docs/design/plate.md; the
// tokens are its one source). Any string in the app's code is checked, a className's or a
// constant's that becomes one.
const ARBITRARY_VALUE = "/\\[#|-\\[[0-9]+px\\]/";
const ARBITRARY_VALUE_MESSAGE =
  "An arbitrary Tailwind colour or px value ([#…] or -[Npx]): add a token to src/styles.css and use it (docs/design/plate.md).";
const ARBITRARY_VALUE_BANS = [
  { selector: `Literal[value=${ARBITRARY_VALUE}]`, message: ARBITRARY_VALUE_MESSAGE },
  { selector: `TemplateElement[value.raw=${ARBITRARY_VALUE}]`, message: ARBITRARY_VALUE_MESSAGE },
];

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

/** The helper entries checked in `files`, less any whose home is `except`. */
const helperBans = (forSrc, except) =>
  HELPERS.filter(({ src, home }) => (forSrc || !src) && home !== except).flatMap(({ helper, home, does, selectors }) =>
    selectors.map((selector) => ({ selector, message: `Written by hand: ${does}. Use ${helper} from ${home}.` })),
  );

/** `no-restricted-syntax` for `files`, with a block for each helper's home there that drops only
 *  its own entry. Flat config replaces a rule's options per block, so each file gets one whole list. */
function restricted(files, forSrc, otherBans) {
  const prefix = forSrc ? "src/" : "convex/";
  const rule = (except) => ({ "no-restricted-syntax": ["error", ...otherBans, ...helperBans(forSrc, except)] });
  const homes = HELPERS.map(({ home }) => home).filter((home) => home.startsWith(prefix));
  return [{ files, rules: rule(null) }, ...homes.map((home) => ({ files: [home], rules: rule(home) }))];
}

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
  ...restricted(SRC_FILES, true, ARBITRARY_VALUE_BANS),
  {
    files: CONVEX_FILES,
    languageOptions: { parser: tsParser },
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },
  ...restricted(CONVEX_FILES, false, []),
];
