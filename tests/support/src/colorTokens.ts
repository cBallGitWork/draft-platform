// styles.css's colour tokens as written, for tests that hold a value elsewhere equal to one, or
// work out a contrast on it. Vitest empties every CSS import; only this raw read of styles.css is
// let through (vitest.config.ts).

import stylesCss from "../../../src/styles.css?raw";

/** The `#rrggbb` that styles.css gives `--color-<name>`; throws when it gives none. */
export function colorToken(name: string): string {
  const value = stylesCss.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))?.[1];
  if (value === undefined) throw new Error(`styles.css gives --color-${name} no #rrggbb`);
  return value;
}

/** Every `--color-<name>` styles.css defines, whatever its value (a hex, an rgb(), a var()). */
export function colorTokenNames(): Set<string> {
  return new Set([...stylesCss.matchAll(/^\s*--color-([a-z0-9-]+):/gm)].map((match) => match[1]));
}
