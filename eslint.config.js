// The lint step (#154): React's two hook rules, so a hand-written dependency list is checked, and
// a few bans that keep a value with one owner from being typed again (design values in
// src/styles.css, and those #1810 names); no style rule sets. Why ESLint: ARCHITECTURE.md, Libraries ("Lint").
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

// Where React runs; why convex/ and its tests are left out of the hook rules: ARCHITECTURE.md, Libraries ("Lint").
const REACT_FILES = ["src/**/*.{ts,tsx}", "tests/src/**/*.{ts,tsx}", "tests/support/src/**/*.{ts,tsx}"];

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

// A smoke test's preview session in its address; a test's own title may name it.
const PREVIEW_MESSAGE = "?preview= typed by hand: use previewUrl(path, session) from tests/support/smoke/previewUrl.ts.";
const TEST_TITLE = "CallExpression[callee.name='test'] > ";
const PREVIEW_BAN = [
  { selector: `Literal[value=/preview=/]:not(${TEST_TITLE}Literal)`, message: PREVIEW_MESSAGE },
  { selector: `TemplateElement[value.raw=/preview=/]:not(${TEST_TITLE}TemplateLiteral > TemplateElement)`, message: PREVIEW_MESSAGE },
];

// Flat config never merges no-restricted-syntax: a later block matching a file replaces the list,
// so each block below holds its files' whole list.
const bans = (...lists) => ({ "no-restricted-syntax": ["error", ...lists.flat()] });

export default [
  // ESLint also lints every .js, .mjs and .cjs file by default; none of ours holds React.
  { ignores: ["**/*.{js,mjs,cjs}"] },
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
  { files: ["src/**/*.{ts,tsx}"], rules: bans(ARBITRARY_VALUE_BAN, VERSION_ANCHOR_BAN, LOCALE_BAN) },
  { files: ["src/patches/paths.ts"], rules: bans(ARBITRARY_VALUE_BAN, LOCALE_BAN) },
  { files: ["src/leagueSettings/**/*.{ts,tsx}"], rules: bans(ARBITRARY_VALUE_BAN, VERSION_ANCHOR_BAN, LOCALE_BAN, BLANK_NUMBER_BAN) },
  // convex/ has no React, so only the parser and its bans.
  { files: ["convex/**/*.ts"], ignores: ["convex/_generated/**", "convex/shared/moments.ts"], languageOptions: { parser: tsParser }, rules: bans(LOCALE_BAN) },
  { files: ["tests/smoke/**/*.ts"], languageOptions: { parser: tsParser }, rules: bans(PREVIEW_BAN) },
];
