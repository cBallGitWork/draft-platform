// Reopens a test build's pull request from Craig's account: `node scripts/reopen-test-build.mjs <pr>`.
// A build run from a branch (`gh workflow run claude-build.yml --ref <branch>`, how a pipeline change is tested)
// opens its pull request with the job's own token, so the github-actions bot is its author, and lane-auto.yml's
// approval, given by that same bot, is refused: "Can not approve your own pull request" (#1146 and #1153, 5 Nov 2026).
// There is no other account to open it as, so once the pipeline change has merged, the session that ran the test
// runs this: it merges main into the build's work, so the pipeline commit drops out of the diff, pushes it as a new
// branch, opens the same pull request as Craig with auto-merge on, and closes the bot's one, pointing at the new one.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** The author lane-auto can't approve for: the bot whose token a branch build opens its pull request with. */
export const TEST_BUILD_AUTHOR = "app/github-actions";

/** The prefixes a branch may start with (CLAUDE.md, "Working"). */
export const BRANCH_PREFIXES = ["feat/", "fix/", "refactor/", "docs/", "chore/"];

/** A suffix that keeps the new branch's name apart from the bot's, which is left as it was. */
export const REOPENED_SUFFIX = "-reopened";

/** The new branch's name: the bot's with the suffix, under `feat/` when its prefix isn't one of ours (a `wip/`
 *  branch kept from an unfinished build). */
export function reopenedBranch(botBranch) {
  const ours = BRANCH_PREFIXES.some((prefix) => botBranch.startsWith(prefix));
  const name = ours ? botBranch : `feat/${botBranch.slice(botBranch.indexOf("/") + 1)}`;
  return `${name}${REOPENED_SUFFIX}`;
}

/** What the bot's pull request says when it is closed. */
export function closingNote(newPr) {
  return `Replaced by ${newPr}: the same work, opened from Craig's account so lane-auto can approve it (the bot can't approve a pull request it opened), with main merged in.`;
}

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
  } catch (error) {
    const said = String(error.stderr ?? "").trim() || error.message;
    throw new Error(`${command} ${args.slice(0, 2).join(" ")} failed: ${said}`);
  }
}

function main(prNumber) {
  if (!/^\d+$/.test(prNumber ?? "")) {
    throw new Error("give the test build's pull request number, as in node scripts/reopen-test-build.mjs 1153");
  }
  const repo = run("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  const pr = JSON.parse(run("gh", ["pr", "view", prNumber, "--json", "author,state,headRefName,title,body"]));
  const author = pr.author.login;  // gh gives an app's login as "app/<name>"
  if (author !== TEST_BUILD_AUTHOR || pr.state !== "OPEN") {
    throw new Error(`#${prNumber} is ${pr.state} and by ${author}; only an open one by ${TEST_BUILD_AUTHOR} needs reopening.`);
  }
  // over HTTPS with gh's sign-in, since SSH to GitHub fails on Craig's Mac
  const remote = `https://github.com/${repo}.git`;
  const git = (...args) => run("git", ["-c", "credential.helper=!gh auth git-credential", ...args]);
  const branch = reopenedBranch(pr.headRefName);
  const work = mkdtempSync(join(tmpdir(), "reopen-test-build-"));
  const tree = { cwd: join(work, "tree") };
  let added = false;
  try {
    git("fetch", "-q", remote, `+refs/heads/main:refs/remotes/origin/main`, `+refs/heads/${pr.headRefName}:refs/reopen/${prNumber}`);
    git("worktree", "add", "-q", "--detach", tree.cwd, `refs/reopen/${prNumber}`);
    added = true;
    try {
      execFileSync("git", ["merge", "-q", "--no-edit", "origin/main"], { ...tree, stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      throw new Error(`main doesn't merge cleanly into #${prNumber}'s branch; merge it by hand, then run this again.`);
    }
    run("git", ["-c", "credential.helper=!gh auth git-credential", "push", "-q", remote, `HEAD:refs/heads/${branch}`], tree);
    const bodyFile = join(work, "body.md");
    writeFileSync(bodyFile, pr.body);
    const url = run("gh", ["pr", "create", "--repo", repo, "--base", "main", "--head", branch, "--title", pr.title, "--body-file", bodyFile]);
    run("gh", ["pr", "merge", url, "--squash", "--auto"]);
    run("gh", ["pr", "close", prNumber, "--repo", repo, "--comment", closingNote(url)]);
    console.log(`#${prNumber} reopened as ${url}, set to merge once green.`);
  } finally {
    if (added) run("git", ["worktree", "remove", "--force", tree.cwd]);
    spawnSync("git", ["update-ref", "-d", `refs/reopen/${prNumber}`], { stdio: "ignore" });  // absent if the fetch failed
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main(process.argv[2]);
  } catch (error) {
    console.error(`reopen-test-build: ${error.message}`);
    process.exit(1);
  }
}
