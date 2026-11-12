// What tests/convex/testTwins.test.ts reads test files for (#1814): setup two test files share,
// kept in both instead of in tests/support/. Each map holds a file's source by its path from the
// repo's root.

/** The fewest lines two test files may share in a row before they count as one copied. */
export const TWIN_RUN = 12;

/** One finding: `entry` as STILL_TWINNED lists it, `message` what to do about it. */
export type Twin = { entry: string; message: string };
type Sources = Record<string, string>;

/** A top-level name. A `let` is left out: it's state each file sets in its own beforeEach. */
const DEFINED =
  /^(?:export\s+)?(?:declare\s+)?(?:async\s+)?(?:function\*?|const|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm;
const EXPORT_LIST = /^export\s+(?:type\s+)?\{([^}]*)\}/gm;

/** Every name a file exports, by the file that exports it. */
function supportExports(support: Sources): Map<string, string> {
  const owners = new Map<string, string>();
  for (const [path, source] of Object.entries(support)) {
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
    for (const name of names) if (!owners.has(name)) owners.set(name, path);
  }
  return owners;
}

/** The harnesses by the feature a test file sits under, else where a new one would go. */
function harnessFor(testPath: string, support: Sources): string {
  const [, root, folderOrFile] = testPath.split("/");
  const folder = `tests/support/${root}/`;
  const feature = folderOrFile.replace(/\.test\.tsx?$/, "");
  const found = Object.keys(support).filter(
    (path) =>
      path.startsWith(folder) && path.slice(folder.length).startsWith(feature),
  );
  return found.length > 0
    ? found.join(" or ")
    : `a new ${folder}${feature}.harness.ts`;
}

/** Test files defining at the top level a name tests/support/ exports, one entry a file. */
function redefined(tests: Sources, support: Sources): Twin[] {
  const owners = supportExports(support);
  const found: Twin[] = [];
  for (const [path, source] of Object.entries(tests)) {
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
function sharedRuns(tests: Sources, support: Sources): Twin[] {
  const firstSeen = new Map<string, { path: string; at: number }>();
  const pairs = new Map<string, Twin>();
  for (const path of Object.keys(tests).sort()) {
    const lines = comparedLines(tests[path]);
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

/** Every twin among the test files, sorted by entry. */
export const twins = (tests: Sources, support: Sources): Twin[] =>
  [...redefined(tests, support), ...sharedRuns(tests, support)].sort((a, b) =>
    a.entry.localeCompare(b.entry),
  );
