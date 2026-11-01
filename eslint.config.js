// The lint step (#154): React's two hook rules, so a hand-written dependency list is checked, and
// one rule that keeps design values in src/styles.css; no style rule sets. Why ESLint: ARCHITECTURE.md, Libraries ("Lint").
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

// Where React runs; why convex/ and its tests are left out: ARCHITECTURE.md, Libraries ("Lint").
const REACT_FILES = ["src/**/*.{ts,tsx}", "tests/src/**/*.{ts,tsx}", "tests/support/src/**/*.{ts,tsx}"];

// A Tailwind class with an arbitrary colour (`bg-[#123456]`) or pixel size (`w-[13px]`) puts a
// design value in a component instead of a token in src/styles.css (docs/design/plate.md; the
// tokens are its one source). Any string in the app's code is checked, a className's or a
// constant's that becomes one.
const ARBITRARY_VALUE = "/\\[#|-\\[[0-9]+px\\]/";
const ARBITRARY_VALUE_MESSAGE =
  "An arbitrary Tailwind colour or px value ([#…] or -[Npx]): add a token to src/styles.css and use it (docs/design/plate.md).";

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
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=${ARBITRARY_VALUE}]`, message: ARBITRARY_VALUE_MESSAGE },
        { selector: `TemplateElement[value.raw=${ARBITRARY_VALUE}]`, message: ARBITRARY_VALUE_MESSAGE },
      ],
    },
  },
];
