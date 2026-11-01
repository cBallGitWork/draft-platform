// The design lint: fails a board whose drawn text breaks a rule a script can check
// (docs/design/plate.md, Never and Decided): a role written as initials, a colour key or legend,
// a `·` string. The roles come from the role catalogue itself (convex/lineup/roles.ts), so a role
// added there is checked here with no list to keep. Run by the /design skill's render check.
//
// Usage: node scripts/design/lint.mjs <board.dc.html | page.html>...

import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expandBoard } from "./expand.mjs";

const ROLE_CATALOGUE = "convex/lineup/roles.ts";
const ROLES_BUNDLE_PREFIX = ".design-lint-roles-";

const MIDDLE_DOT = "·";
const ENTITIES = { "&middot;": MIDDLE_DOT, "&#183;": MIDDLE_DOT, "&#xb7;": MIDDLE_DOT, "&amp;": "&", "&nbsp;": " " };
const ENTITY = new RegExp(Object.keys(ENTITIES).join("|"), "gi");
// Never drawn as text: the page's head, its scripts and its stylesheets.
const NOT_DRAWN = /<head\b[\s\S]*?<\/head>|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi;
const TAG = /<[^>]*>/g;
const CAPS_TOKEN = /(?<![\w])[A-Z][A-Z0-9]+(?![\w])/g;
const WORD_BREAK = /[\s-]+/;
const DIGITS = /^\d+$/;
// "Key", "Legend:", "Difficulty key", "Fixture difficulty legend": a heading of up to four words
// ending in key or legend, or a label opening with one.
const KEY_HEADING = /^(?:\S+\s+){0,3}(?:key|legend)s?:?$|^(?:key|legend):/i;

/** The ways a role's name is cut to initials on a board: each word's first letter, a number kept
 *  whole ("Defensive full-back" DFB, "Number 10" N10, "False 9" F9), and the first word's first two
 *  ("Shadow striker" SHS). A one-word name has none. */
export function initialsOf(name) {
  const words = name.split(WORD_BREAK).filter(Boolean);
  if (words.length < 2) return [];
  const letter = (word) => (DIGITS.test(word) ? word : word[0].toUpperCase());
  const rest = words.slice(1).map(letter).join("");
  return [...new Set([letter(words[0]) + rest, words[0].slice(0, 2).toUpperCase() + rest])];
}

/** Each role's initials, mapped to the names they cut (SHS: Shadow striker, Shot-stopper); never a
 *  position chip (GK, CB, ST), which a board may show. */
export function roleInitials(roleNames, positions) {
  const initials = new Map();
  for (const name of new Set(roleNames)) {
    for (const each of initialsOf(name)) if (!positions.includes(each)) initials.set(each, [...(initials.get(each) ?? []), name]);
  }
  return initials;
}

/** Every run of drawn text in a page, entities decoded. */
export function drawnText(html) {
  return html
    .replace(NOT_DRAWN, " ")
    .split(TAG)
    .map((run) => run.replace(ENTITY, (entity) => ENTITIES[entity.toLowerCase()]).trim())
    .filter(Boolean);
}

/** What the page breaks, one line for each different problem. */
export function lintPage(html, initials) {
  const problems = new Set();
  for (const run of drawnText(html)) {
    for (const [token] of run.matchAll(CAPS_TOKEN)) {
      if (initials.has(token)) problems.add(`role initials "${token}": write the role in full (${initials.get(token).join(" or ")})`);
    }
    if (KEY_HEADING.test(run)) problems.add(`a key or legend, "${run}": the colours carry it`);
    if (run.includes(MIDDLE_DOT)) problems.add(`a ${MIDDLE_DOT} string, "${run}"`);
  }
  return [...problems];
}

/** The role catalogue's names and positions, bundled with esbuild (as scripts/release.mjs reads
 *  the schema), since Node can't import the TypeScript source's extensionless imports. */
export async function roleCatalogue(cataloguePath = ROLE_CATALOGUE) {
  const { build } = await import("esbuild");
  const bundled = await build({ entryPoints: [cataloguePath], bundle: true, write: false, format: "esm", platform: "node" });
  const file = join(process.cwd(), `${ROLES_BUNDLE_PREFIX}${process.pid}.mjs`);
  writeFileSync(file, bundled.outputFiles[0].text);
  try {
    const { DEFAULT_ROLES } = await import(pathToFileURL(file).href);
    if (!DEFAULT_ROLES) throw new Error(`${cataloguePath} exports no DEFAULT_ROLES`);
    return {
      roleNames: Object.values(DEFAULT_ROLES).flatMap((roles) => roles.map(({ name }) => name)),
      positions: Object.keys(DEFAULT_ROLES),
    };
  } finally {
    rmSync(file, { force: true });
  }
}

/** A board is expanded first; a plain page is read as it is. */
const pageOf = (source) => (source.includes("<x-dc>") ? expandBoard(source).html : source);

async function main(files) {
  if (files.length === 0) {
    console.error("Usage: node scripts/design/lint.mjs <board.dc.html | page.html>...");
    return 2;
  }
  const { roleNames, positions } = await roleCatalogue();
  const initials = roleInitials(roleNames, positions);
  let failed = false;
  for (const file of files) {
    const problems = lintPage(pageOf(readFileSync(file, "utf8")), initials);
    for (const problem of problems) console.error(`${file}: ${problem}`);
    failed ||= problems.length > 0;
    if (problems.length === 0) console.log(`${file}: clean`);
  }
  return failed ? 1 : 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main(process.argv.slice(2)));
}
