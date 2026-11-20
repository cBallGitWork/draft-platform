#!/usr/bin/env node
// The regression pack check (Forge kit; the QA tester's /regression-pack skill). A project's pack is one
// CSV of test cases in the repository, the columns below, kept by whoever changes what a case covers.
// This fails, one line per problem, on a pack that has drifted: a broken row, an ID given twice or in
// an area the project doesn't have, a value outside its list, or a file or spec answer the pack cites
// that is no longer there. It never runs a case: it keeps the pack honest so the cases can be run.
// The project's settings are in .studio/regression-pack.json (pack, areas, specIds, spec), not a kit file.
// Run from the project: node scripts/regression-pack.mjs [--summary]
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const CONFIG_PATH = ".studio/regression-pack.json";
export const COLUMNS = ["ID", "Area", "Feature", "Where", "Role", "Type", "Priority", "Preconditions", "Steps",
  "Expected result", "Spec ref", "Level", "Automated", "Notes", "Status", "Last run", "Run by", "Issue"];
export const TYPES = ["Happy path", "Negative", "Boundary", "Permission", "Multi-user", "Time", "Interruption",
  "Error handling", "Data integrity", "Accessibility", "Open question"];
export const PRIORITIES = ["P1", "P2", "P3"];
export const LEVELS = ["Unit", "Integration", "E2E", "Manual"];
export const STATUSES = ["Not run", "Pass", "Fail", "Blocked"];
const REQUIRED = ["ID", "Feature", "Where", "Type", "Priority", "Steps", "Expected result", "Spec ref", "Level", "Automated", "Status"];
const ID = /^([A-Z]{2,4})-\d{3,}$/;
const AUTOMATED = /^(Yes|Partly|No)\b/;
/** A cited file: a path with a folder and an extension, its line numbers after a colon. */
const FILE = /^([\w.@-]+\/)+[\w.@-]+\.\w+(?=$|:)/;

/** The project's settings, with the pack's default path filled in. */
export function readConfig(text) {
  let config;
  try {
    config = JSON.parse(text);
  } catch (error) {
    throw new Error(`${CONFIG_PATH} is not valid JSON (${error.message})`, { cause: error });
  }
  const { pack = "qa/regression-pack.csv", areas, specIds, spec = [] } = config ?? {};
  if (typeof pack !== "string" || !pack.endsWith(".csv")) throw new Error(`${CONFIG_PATH}: "pack" must be a .csv path`);
  if (typeof areas !== "object" || areas === null || Array.isArray(areas) || !Object.keys(areas).length
    || !Object.keys(areas).every((code) => /^[A-Z]{2,4}$/.test(code))) {
    throw new Error(`${CONFIG_PATH}: "areas" must map two-to-four capital letters to an area's name, such as {"LG": "Leagues"}`);
  }
  if (specIds !== undefined && typeof specIds !== "string") throw new Error(`${CONFIG_PATH}: "specIds" must be a pattern, such as "S\\\\d{2}\\\\.\\\\d+"`);
  if (!Array.isArray(spec) || !spec.every((path) => typeof path === "string")) throw new Error(`${CONFIG_PATH}: "spec" must list the files or folders holding the spec`);
  if (specIds && !spec.length) throw new Error(`${CONFIG_PATH}: "specIds" needs "spec", the files or folders the answers are in`);
  return { pack, areas, specIds: specIds ? new RegExp(`\\b(?:${specIds})\\b`, "g") : null, spec };
}

/** Rows of a CSV (RFC 4180: quoted fields may hold commas, quotes as "" and new lines); CRLF reads as LF. */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false, i = 0;
  text = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  for (; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (quoted) throw new Error("a quoted field never ends");
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Every answer ID given in the spec files under the given paths, and those withdrawn. */
export function readSpecIds(root, paths, pattern) {
  const given = new Set(), withdrawn = new Set();
  const read = (path) => {
    const full = join(root, path);
    if (!existsSync(full)) return;
    if (statSync(full).isDirectory()) return readdirSync(full).forEach((name) => read(join(path, name)));
    if (!path.endsWith(".md")) return;
    for (const line of readFileSync(full, "utf8").split("\n")) {
      for (const id of line.match(pattern) ?? []) {
        given.add(id);
        if (new RegExp(`${id.replace(/\./g, "\\.")} withdrawn`).test(line)) withdrawn.add(id);
      }
    }
  };
  paths.forEach(read);
  return { given, withdrawn };
}

/** The files a cell cites: the first word of each ;-separated part that looks like a path. */
export function citedFiles(cell) {
  return cell.split(";").map((part) => part.trim().split(/\s/)[0].match(FILE)?.[0]).filter(Boolean);
}

/** What's wrong with the pack: one line each, none when it's sound. `fileExists` and `spec` reach the project. */
export function packProblems(text, { areas, specIds }, { fileExists = () => true, spec = { given: new Set(), withdrawn: new Set() } } = {}) {
  let rows;
  try {
    rows = parseCsv(text).filter((row) => row.some((cell) => cell.trim() !== ""));
  } catch (error) {
    return [`the pack can't be read: ${error.message}`];
  }
  const [header = [], ...cases] = rows;
  if (header.join(",") !== COLUMNS.join(",")) return [`the header must be exactly: ${COLUMNS.join(",")}`];
  const problems = [];
  const seen = new Set();
  cases.forEach((row, index) => {
    const line = `row ${index + 2}`;
    if (row.length !== COLUMNS.length) return problems.push(`${line}: ${row.length} columns, not ${COLUMNS.length} (a comma or quote out of place?)`);
    const c = Object.fromEntries(COLUMNS.map((name, i) => [name, row[i].trim()]));
    const at = c.ID ? `${c.ID} (${line})` : line;
    for (const name of REQUIRED) if (!c[name]) problems.push(`${at}: "${name}" is empty`);
    if (c.ID) {
      const area = c.ID.match(ID)?.[1];
      if (!area) problems.push(`${at}: an ID is an area code, a dash and three or more digits, such as LG-001`);
      else if (!(area in areas)) problems.push(`${at}: area ${area} isn't in ${CONFIG_PATH} (${Object.keys(areas).join(", ")})`);
      if (seen.has(c.ID)) problems.push(`${at}: ID given twice; a case keeps its ID for good, a new case takes the next free one`);
      seen.add(c.ID);
    }
    for (const [name, list] of [["Type", TYPES], ["Priority", PRIORITIES], ["Level", LEVELS], ["Status", STATUSES]]) {
      if (c[name] && !list.includes(c[name])) problems.push(`${at}: ${name} "${c[name]}" isn't one of ${list.join(", ")}`);
    }
    if (c.Automated && !AUTOMATED.test(c.Automated)) problems.push(`${at}: Automated starts Yes, Partly or No, then the test files in brackets`);
    if (/^(Yes|Partly)/.test(c.Automated) && !/\(.+\)/.test(c.Automated)) problems.push(`${at}: Automated ${c.Automated.split(" ")[0]} names its test files in brackets`);
    if (c.Status === "Fail" && !c.Issue) problems.push(`${at}: a failing case names its bug issue under Issue`);
    if (c.Issue && !c.Issue.split(/[\s;,]+/).every((ref) => /^#\d+$|^https:\/\/\S+$/.test(ref))) problems.push(`${at}: Issue holds #numbers or links only`);
    const automatedFiles = (c.Automated.match(/\((.*)\)/)?.[1] ?? "");
    for (const file of [...citedFiles(c["Spec ref"]), ...citedFiles(automatedFiles)]) {
      if (!fileExists(file)) problems.push(`${at}: cites ${file}, which isn't in the project; point it at where that moved, or drop it`);
    }
    if (specIds) {
      // a mention such as "S05.43 withdrawn" records history, so only the IDs cited as live are checked
      const live = c["Spec ref"].replace(new RegExp(`(${specIds.source})\\s+(is\\s+)?withdrawn`, "g"), "");
      for (const id of new Set(live.match(specIds) ?? [])) {
        if (!spec.given.has(id)) problems.push(`${at}: cites ${id}, which no spec answer gives`);
        else if (spec.withdrawn.has(id)) problems.push(`${at}: cites ${id}, which is withdrawn; cite the answer that replaced it`);
      }
    }
  });
  return problems;
}

/** Counts by area, as the pack's summary: cases, P1, automated, open questions, passed, failing. */
export function summary(text, { areas }) {
  const [, ...rows] = parseCsv(text).filter((row) => row.some((cell) => cell.trim() !== ""));
  const cases = rows.map((row) => Object.fromEntries(COLUMNS.map((name, i) => [name, (row[i] ?? "").trim()])));
  const count = (list) => ({
    cases: list.length,
    p1: list.filter((c) => c.Priority === "P1").length,
    automated: list.filter((c) => c.Automated.startsWith("Yes")).length,
    questions: list.filter((c) => c.Type === "Open question").length,
    passed: list.filter((c) => c.Status === "Pass").length,
    failing: list.filter((c) => c.Status === "Fail").length,
  });
  return {
    areas: Object.entries(areas).map(([code, name]) => ({ code, name, ...count(cases.filter((c) => c.ID.startsWith(`${code}-`))) })),
    total: count(cases),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.cwd();
  const fail = (lines) => {
    console.error("regression pack: these need fixing in the pack (the /regression-pack skill says how):");
    for (const line of lines) console.error(`  ${line}`);
    process.exit(1);
  };
  if (!existsSync(join(root, CONFIG_PATH))) fail([`${CONFIG_PATH} is missing: start it from the skill's settings example`]);
  let config;
  try {
    config = readConfig(readFileSync(join(root, CONFIG_PATH), "utf8"));
  } catch (error) {
    fail([error.message]);
  }
  if (!existsSync(join(root, config.pack))) fail([`${config.pack} is missing: start it from the skill's template.csv`]);
  const text = readFileSync(join(root, config.pack), "utf8");
  const spec = config.specIds ? readSpecIds(root, config.spec, config.specIds) : undefined;
  const problems = packProblems(text, config, { fileExists: (file) => existsSync(join(root, file)), spec });
  if (problems.length) fail(problems);
  const { areas, total } = summary(text, config);
  console.log(`regression pack: ${total.cases} cases, ${total.p1} P1, ${total.automated} automated, ${total.questions} open questions, ${total.passed} passed, ${total.failing} failing`);
  if (process.argv.includes("--summary")) {
    console.log("area  cases  P1  automated  questions  passed  failing");
    for (const a of areas) console.log(`${a.code.padEnd(5)} ${String(a.cases).padStart(5)} ${String(a.p1).padStart(3)} ${String(a.automated).padStart(10)} ${String(a.questions).padStart(10)} ${String(a.passed).padStart(7)} ${String(a.failing).padStart(8)}  ${a.name}`);
  }
}
