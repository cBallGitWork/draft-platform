import { expect, test } from "vitest";
import generatedApi from "../../convex/_generated/api.d.ts?raw";

// convex/_generated/api.d.ts, the types behind `api` and `internal`, kept equal to the modules
// Convex deploys. Convex's CLI rewrites it (`npx convex dev`, `npx convex codegen`), so a module
// added, moved or deleted without a run leaves it stale, and nothing else notices: the release
// never reads it (api.js is `anyApi`), and a module it leaves out only drops out of the types.
// #516 fixed the same drift once.

/** Every file in convex/ with an extension Convex's bundler takes, keyed by its path from here. */
const convexSources = import.meta.glob<string>("../../convex/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}", {
  query: "?raw",
  import: "default",
  eager: true,
});
const FROM_HERE = "../../convex/";

const GENERATED = "_generated/";
/** A TypeScript file is an entry point only with a line that starts with one of these. */
const HAS_IMPORT_OR_EXPORT = /^\s{0,100}(import|export)/m;
const TYPESCRIPT = /\.tsx?$/;

const HOW_TO_FIX =
  "convex/_generated/api.d.ts is stale. Run `npx convex codegen` with a deployment selected " +
  "(CONVEX_DEPLOYMENT), or edit its `import type` lines and its fullApi entries by hand, " +
  "both in the order Convex deploys the modules.";

/** Whether Convex's bundler makes this file an entry point: the rules of `entryPoints` in
 *  node_modules/convex/dist/esm/bundler/index.js. It also skips a folder holding convex.config.ts
 *  (a component); convex/ has none. */
function isEntryPoint(path: string, source: string): boolean {
  const base = path.split("/").at(-1) ?? "";
  return (
    !path.startsWith(GENERATED) &&
    !base.startsWith(".") &&
    !base.startsWith("#") &&
    base !== "schema.ts" &&
    base !== "schema.js" &&
    (base.match(/\./g) ?? []).length === 1 &&
    !path.includes(" ") &&
    (!TYPESCRIPT.test(path) || HAS_IMPORT_OR_EXPORT.test(source))
  );
}

/** The modules Convex deploys from these files (keyed by their path in convex/), in codegen's
 *  order: compareModulePaths in codegen_templates/common.js sorts the paths with their extension,
 *  by character code, so `a-b.ts` comes before `a.ts` and `table.ts` before `table/x.ts`. */
function deployedModules(sources: Record<string, string>): string[] {
  return Object.entries(sources)
    .filter(([path, source]) => isEntryPoint(path, source))
    .map(([path]) => path)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((path) => path.replace(/\.[^/.]+$/, ""));
}

/** The name api.d.ts gives a module: moduleIdentifier in codegen_templates/api.js. It also adds
 *  `_` to a reserved word such as `api` or `default`; no module here is one. */
const identifierOf = (module: string) => module.replace(/[/-]/g, "_");

type Listed = { module: string; identifier: string };

/** api.d.ts's `import type * as <identifier> from "../<module>.js";` lines, in order. */
function importedModules(apiTypes: string): Listed[] {
  return [...apiTypes.matchAll(/^import type \* as (\w+) from "\.\.\/(.+)\.js";$/gm)].map(
    ([, identifier = "", module = ""]) => ({ module, identifier }),
  );
}

/** fullApi's `"<module>": typeof <identifier>;` entries, in order; a plain name such as `auth`
 *  has no quotes. */
function fullApiModules(apiTypes: string): Listed[] {
  const entries = apiTypes.split("declare const fullApi: ApiFromModules<{")[1]?.split("}>;")[0] ?? "";
  return [...entries.matchAll(/^\s*"?([^":\s]+)"?: typeof (\w+)[;,]$/gm)].map(([, module = "", identifier = ""]) => ({
    module,
    identifier,
  }));
}

/** What's wrong between the modules Convex deploys and one of api.d.ts's lists, one line each. */
function listProblems(list: string, deployed: readonly string[], listed: readonly Listed[]): string[] {
  const modules = listed.map((entry) => entry.module);
  const missing = deployed.filter((module) => !modules.includes(module));
  const extra = modules.filter((module) => !deployed.includes(module));
  const twice = modules.filter((module, at) => modules.indexOf(module) !== at);
  const firstOutOfOrder = deployed.findIndex((module, at) => modules[at] !== module);
  return [
    ...missing.map((module) => `${list} leaves out ${module}, which Convex deploys`),
    ...extra.map((module) => `${list} has ${module}, which Convex doesn't deploy`),
    ...twice.map((module) => `${list} has ${module} twice`),
    ...listed
      .filter(({ module, identifier }) => identifier !== identifierOf(module))
      .map(({ module, identifier }) => `${list} calls ${module} ${identifier}, not ${identifierOf(module)}`),
    ...(missing.length === 0 && extra.length === 0 && twice.length === 0 && firstOutOfOrder !== -1
      ? [`${list} has ${modules[firstOutOfOrder]} where ${deployed[firstOutOfOrder]} goes`]
      : []),
  ];
}

test("api.d.ts lists every module Convex deploys and nothing else, in codegen's order", () => {
  const sources = Object.fromEntries(
    Object.entries(convexSources).map(([path, source]) => [path.slice(FROM_HERE.length), source]),
  );
  const deployed = deployedModules(sources);
  const problems = [
    ...listProblems("api.d.ts's imports", deployed, importedModules(generatedApi)),
    ...listProblems("api.d.ts's fullApi", deployed, fullApiModules(generatedApi)),
  ];
  expect(problems, HOW_TO_FIX).toEqual([]);
});

test("the check skips the files Convex skips and orders the rest as codegen does", () => {
  const module = "export const value = 1;";
  expect(
    deployedModules({
      "a.ts": module,
      "a-b.ts": module,
      "table.ts": module,
      "table/sent.ts": module,
      "helper.js": "",
      "schema.ts": module,
      "nested/schema.ts": module,
      "auth.config.ts": module,
      "process.d.ts": module,
      "_generated/api.ts": module,
      ".hidden.ts": module,
      "#draft.ts": module,
      "with space.ts": module,
      "commentOnly.ts": "// nothing to import or export",
    }),
  ).toEqual(["a-b", "a", "helper", "table", "table/sent"]);
});

test("the check names each module a list leaves out, has extra or twice, misnames or puts out of order", () => {
  const deployed = ["auth", "outbound/resend", "table/sent"];
  expect(
    listProblems("the list", deployed, [
      { module: "auth", identifier: "auth" },
      { module: "table/sent", identifier: "table_sent" },
      { module: "old/gone", identifier: "old_gone" },
      { module: "outbound/resend", identifier: "resend" },
    ]),
  ).toEqual([
    "the list has old/gone, which Convex doesn't deploy",
    "the list calls outbound/resend resend, not outbound_resend",
  ]);
  expect(
    listProblems("the list", deployed, [
      { module: "auth", identifier: "auth" },
      { module: "table/sent", identifier: "table_sent" },
    ]),
  ).toEqual(["the list leaves out outbound/resend, which Convex deploys"]);
  expect(
    listProblems("the list", deployed, [
      { module: "auth", identifier: "auth" },
      { module: "outbound/resend", identifier: "outbound_resend" },
      { module: "table/sent", identifier: "table_sent" },
      { module: "table/sent", identifier: "table_sent" },
    ]),
  ).toEqual(["the list has table/sent twice"]);
  expect(
    listProblems("the list", deployed, [
      { module: "table/sent", identifier: "table_sent" },
      { module: "auth", identifier: "auth" },
      { module: "outbound/resend", identifier: "outbound_resend" },
    ]),
  ).toEqual(["the list has table/sent where auth goes"]);
});
