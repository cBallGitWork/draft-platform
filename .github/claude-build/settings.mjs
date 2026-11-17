#!/usr/bin/env node
// claude-build.yml's project settings: reads the "build" block of the project's .studio/project.json, fills in
// the kit's prompt (prompt.md here) with them and with the run's issue, mode and owner, and writes what the
// workflow's later steps use to GITHUB_OUTPUT (or prints it, run by hand or by Forge's tests).
//   ISSUE=12 MODE=build OWNER=someone node .github/claude-build/settings.mjs
// The "build" block, every key optional:
//   check      what the builder runs before its pull request and in a fix round (default: npm run verify)
//   ruleDocs   what the rules check reads beside the issue (default: the decisions log and spec files)
//   doneLabel  the label for an issue main already does (default: lead:stale; the project's lead reads it)
//   setup      the install command (default: npm ci, or npm install, when there is a package.json)
//   python     a Python version to set up first, such as "3.14"
//   before     a command run before the build, whose failure costs the build nothing (draft-platform starts the
//              apps its ui-verifier shoots); a process it leaves should write its pid to $RUNNER_TEMP/<name>.pid
//   tools      more tools the builder may use, comma-separated, as claude's --allowedTools takes them
//   prompt     a file of this project's own instructions, added after the kit's prompt ({{ISSUE}}, {{PR}} filled in)
//   autoMerge  false keeps the build's pull request for the owner to merge (default: true)
//   unguardedMain  true builds although main has no ruleset (a free private repo): only the run's own guards then
//              keep the builder off main, and a commit main gains with no pull request turns the run red (default: false)
// This file is a kit file: change it in Forge.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT = ".studio/project.json";
const KIT_PROMPT = join(dirname(fileURLToPath(import.meta.url)), "prompt.md");
const DEFAULTS = {
  check: "npm run verify",
  ruleDocs: "the docs it names (docs/decisions.md, and SPEC.md and spec/NN-*.md where they exist)",
  doneLabel: "lead:stale",
  autoMerge: true,
  unguardedMain: false,
};
// every tool the builder needs is named, as the run is headless; the deny list is a speed bump: the real guard is
// the main ruleset's required checks and lane-auto.yml's refusal to approve a build's change to the pipeline
const TOOLS = [
  "Read", "Write", "Edit", "Glob", "Grep",
  ...["git add", "git rm", "git mv", "git commit", "git checkout", "git switch", "git push", "git status", "git diff",
    "git log", "git ls-remote", "git fetch", "git merge", "gh issue view", "gh issue list", "gh issue comment",
    "gh issue edit", "gh issue create", "gh pr create", "gh pr view", "gh pr list", "gh pr checks", "gh run view",
    "gh pr comment", "gh pr edit", "gh pr ready", "npm", "npx", "node", "ls", "cat", "mkdir", "cmp"].map((c) => `Bash(${c}:*)`),
];
const DENIED = [
  "Bash(gh pr merge:*)", "Bash(gh pr edit:*--remove-label*)", "Bash(gh api:*)", "Bash(git push --force:*)",
  // what would get past the runner's guard on main: skipping git's hooks or changing git's settings or hooks
  "Bash(git push*--no-verify*)", "Bash(git*core.hooksPath*)", "Bash(git config:*)", "Edit(.git/**)", "Write(.git/**)",
  "Edit(.github/**)", "Write(.github/**)", "Edit(.claude/**)", "Write(.claude/**)", "Edit(CLAUDE.md)", "Write(CLAUDE.md)",
  "ScheduleWakeup", "CronCreate", "CronDelete", "Monitor", "RemoteTrigger",
];
// Opus builds, at medium effort; the runner never reads Craig's own settings, so without the flags builds run at
// the default
const MODEL_ARGS = "--model claude-opus-5-5 --effort medium --max-turns 150";

/** The project's build settings, defaults filled in; throws naming what is wrong. */
export function buildSettings(root) {
  const file = join(root, PROJECT);
  let build = {};
  if (existsSync(file)) {
    const data = JSON.parse(readFileSync(file, "utf8"));
    build = data?.build ?? {};
  }
  if (typeof build !== "object" || Array.isArray(build)) throw new Error(`${PROJECT} "build" must be an object`);
  for (const [key, value] of Object.entries(build)) {
    const kind = ["autoMerge", "unguardedMain"].includes(key) ? "boolean" : "string";
    if (!["check", "ruleDocs", "doneLabel", "setup", "python", "before", "tools", "prompt", "autoMerge", "unguardedMain"].includes(key)) {
      throw new Error(`${PROJECT} "build" has an unknown key "${key}"`);
    }
    if (typeof value !== kind) throw new Error(`${PROJECT} "build.${key}" must be a ${kind}`);
  }
  if (build.prompt && (isAbsolute(build.prompt) || build.prompt.split(/[\\/]/).includes(".."))) {
    throw new Error(`${PROJECT} "build.prompt" must be a path inside the project`);
  }
  const hasPackage = existsSync(join(root, "package.json"));
  const setup = build.setup ?? (hasPackage ? (existsSync(join(root, "package-lock.json")) ? "npm ci" : "npm install --no-audit --no-fund") : "");
  return { ...DEFAULTS, ...build, setup, hasPackage, hasLock: existsSync(join(root, "package-lock.json")) };
}

const fill = (text, values) => text.replace(/\{\{([A-Z_]+)\}\}/g, (whole, name) => (name in values ? values[name] : whole));

/** The builder's prompt and claude's arguments for one run. */
export function buildRun(root, run, settings = buildSettings(root)) {
  const values = { ISSUE: run.issue, PR: run.pr || "(none)", MODE: run.mode, OWNER: run.owner, CHECK: settings.check,
    RULE_DOCS: settings.ruleDocs, DONE_LABEL: settings.doneLabel };
  const parts = [fill(readFileSync(KIT_PROMPT, "utf8"), values).trimEnd()];
  if (settings.prompt) parts.push(fill(readFileSync(join(root, settings.prompt), "utf8"), values).trimEnd());
  if (run.trust) parts.push(run.trust);
  const tools = [...TOOLS, ...(settings.tools ? settings.tools.split(",").map((t) => t.trim()).filter(Boolean) : [])];
  const args = `${MODEL_ARGS} --allowedTools "${tools.join(",")}" --disallowedTools "${DENIED.join(",")}"`;
  return { prompt: parts.join("\n\n"), args };
}

/** One GITHUB_OUTPUT entry, multi-line safe. */
const output = (name, value) => {
  const mark = `EOF_${randomUUID()}`;
  return `${name}<<${mark}\n${value}\n${mark}\n`;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ISSUE = "", PR = "", MODE = "build", OWNER = "", BODY_TRUST = "", GITHUB_OUTPUT } = process.env;
  if (!/^[0-9]+$/.test(ISSUE) || !/^[0-9]*$/.test(PR) || !["build", "fix", "rules-only"].includes(MODE)) {
    console.error(`claude-build settings: issue "${ISSUE}", pull request "${PR}" or mode "${MODE}" isn't one the build takes`);
    process.exit(1);
  }
  try {
    const settings = buildSettings(process.cwd());
    const { prompt, args } = buildRun(process.cwd(), { issue: ISSUE, pr: PR, mode: MODE, owner: OWNER, trust: BODY_TRUST }, settings);
    const outputs = { check: settings.check, setup: settings.setup, python: settings.python ?? "", before: settings.before ?? "",
      auto_merge: String(settings.autoMerge), package: String(settings.hasPackage), lock: String(settings.hasLock), args, prompt };
    const text = Object.entries(outputs).map(([name, value]) => output(name, value)).join("");
    if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, text);
    else process.stdout.write(text);
    console.error(`claude-build settings: check "${settings.check}", setup "${settings.setup || "none"}", auto-merge ${settings.autoMerge}`);
  } catch (error) {
    console.error(`claude-build settings: ${error.message}`);
    process.exit(1);
  }
}
