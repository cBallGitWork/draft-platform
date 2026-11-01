import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { DEFAULT_ROLES } from "../../../convex/lineup/roles.ts";
import { POSITIONS as POSITION_LABELS } from "../../../convex/positions/positionTables.ts";
import { initialsOf, lintPage, roleCatalogue, roleInitials } from "../../../scripts/design/lint.mjs";
import { REPO_ROOT } from "../../support/scripts/repoRoot.mjs";

// The design lint (plate.md, Never and Decided): role initials, a key or legend, a `·` string.

const ROLE_NAMES = Object.values(DEFAULT_ROLES).flatMap((roles) => roles.map(({ name }) => name));
const POSITIONS = [...new Set([...Object.keys(DEFAULT_ROLES), ...POSITION_LABELS])];
const INITIALS = roleInitials(ROLE_NAMES, POSITIONS);

const page = (body) => `<!doctype html><html><head><title>A · B</title><style>.key{}</style></head><body>${body}</body></html>`;

/** A board as the canvas writes one: its rows come from renderVals(), drawn by <sc-for>. */
const board = (rows) => `<!doctype html><html><head><script src="./support.js"></script></head><body>
<x-dc><helmet><style>body{margin:0}</style></helmet>
<table><sc-for list="{{rows}}" as="row"><tr><td>{{row.pos}}</td><td>{{row.role}}</td></tr></sc-for></table>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":900}}'>
class Component extends DCLogic { renderVals() { return { rows: ${JSON.stringify(rows)} }; } }
</script></body></html>`;

test("a role's initials are each word's first letter, a number kept whole, and the first word's first two", () => {
  expect(initialsOf("Defensive full-back")).toEqual(["DFB", "DEFB"]);
  expect(initialsOf("Number 10")).toEqual(["N10", "NU10"]);
  expect(initialsOf("Shadow striker")).toEqual(["SS", "SHS"]);
  expect(initialsOf("Poacher")).toEqual([]);
});

test("the role catalogue's initials hold the ones Craig struck out, and no position chip", () => {
  for (const each of ["SHS", "DFB", "IF", "N10", "F9", "BW"]) expect(INITIALS.has(each)).toBe(true);
  for (const position of POSITIONS) expect(INITIALS.has(position)).toBe(false);
});

test("SS is spec/06's support striker label, so a board may show it though it is Shadow striker's initials", () => {
  expect(INITIALS.has("SS")).toBe(false);
  expect(lintPage(page("<td>SS</td><td>Bergkamp</td>"), INITIALS)).toEqual([]);
});

test("the real catalogue reads both modules: a slot label and SS both come back as chips", async () => {
  const { roleNames, positions } = await roleCatalogue();
  expect(positions).toEqual(expect.arrayContaining(["CAM", "SW", "SS"]));
  expect(roleInitials(roleNames, positions).has("SS")).toBe(false);
});

test("role initials in drawn text fail, naming the role in full; a position chip passes", () => {
  expect(lintPage(page("<td>ST</td><td>SHS</td><td>CB</td>"), INITIALS)).toEqual([
    'role initials "SHS": write the role in full (Shot-stopper or Shadow striker)',
  ]);
});

test("a key or legend heading fails; a word that only contains one passes", () => {
  expect(lintPage(page("<h3>Difficulty key</h3><p>Legend:</p><p>Keyword</p><p>Monkey business ahead today</p>"), INITIALS)).toEqual([
    'a key or legend, "Difficulty key": the colours carry it',
    'a key or legend, "Legend:": the colours carry it',
  ]);
});

test("a · string fails, typed or as an entity; one in the page's head or stylesheet is never drawn", () => {
  expect(lintPage(page("<p>GW9 · Tue</p><p>ARS &middot; CHE</p>"), INITIALS)).toEqual(['a · string, "GW9 · Tue"', 'a · string, "ARS · CHE"']);
  expect(lintPage(page("<p>Saka</p>"), INITIALS)).toEqual([]);
});

const scratch = mkdtempSync(join(tmpdir(), "design-lint-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const runLint = (file) => spawnSync(process.execPath, ["scripts/design/lint.mjs", file], { cwd: REPO_ROOT, encoding: "utf8" });

test("run on a board, it expands the board, reads the real catalogue and fails on what it draws", () => {
  const file = join(scratch, "Bad.dc.html");
  writeFileSync(file, board([{ pos: "W", role: "IF" }]));
  const { status, stderr } = runLint(file);
  expect(status).toBe(1);
  expect(stderr).toContain('role initials "IF": write the role in full (Inside forward)');
});

test("run on a clean board, it passes", () => {
  const file = join(scratch, "Good.dc.html");
  writeFileSync(file, board([{ pos: "W", role: "Inside forward" }]));
  const { status, stdout } = runLint(file);
  expect(status).toBe(0);
  expect(stdout).toContain("clean");
});
