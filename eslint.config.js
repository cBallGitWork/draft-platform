// The lint step (#154): only React's two hook rules, so a hand-written dependency list is
// checked; no style rule sets. Why ESLint: ARCHITECTURE.md, Libraries ("Lint").
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

// Where React runs; why convex/ and its tests are left out: ARCHITECTURE.md, Libraries ("Lint").
const REACT_FILES = ["src/**/*.{ts,tsx}", "tests/src/**/*.{ts,tsx}", "tests/support/src/**/*.{ts,tsx}"];

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
];
