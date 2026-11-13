// How the import checks read an import line, written once: tests/convex/importCycles.test.ts and
// tests/src/featureImports.test.ts (#1715).

/** `import … from "x"` and `export … from "x"`, the clause kept to tell type-only ones apart. */
export const FROM_CLAUSE = /^\s*(import|export)\s+([^;=]*?)\s*from\s*["']([^"']+)["']/gm;

/** How an `import.meta.glob` key from a test two folders down starts, before the repo path. */
export const SOURCE_PREFIX = "../../";

/** True when the clause brings in only types. */
export function typeOnly(clause: string): boolean {
  if (/^type\s/.test(clause)) return true;
  const braces = clause.match(/^\{([\s\S]*)\}$/);
  if (!braces) return false;
  const names = braces[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return names.length > 0 && names.every((name) => /^type\s/.test(name));
}
