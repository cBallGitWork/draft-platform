import { expect, test } from "vitest";
import { BRANCH_PREFIXES, closingNote, reopenedBranch, REOPENED_SUFFIX } from "../../scripts/reopen-test-build.mjs";

test("a build's branch keeps its name, with the suffix that keeps it apart from the bot's", () => {
  expect(reopenedBranch("feat/draft-pause-1135")).toBe(`feat/draft-pause-1135${REOPENED_SUFFIX}`);
  expect(reopenedBranch("fix/clock-1136")).toBe(`fix/clock-1136${REOPENED_SUFFIX}`);
});

test("an unfinished build's wip/ branch goes under feat/, so the new one starts with one of our prefixes", () => {
  const branch = reopenedBranch("wip/issue-1137-41937367705");
  expect(branch).toBe(`feat/issue-1137-41937367705${REOPENED_SUFFIX}`);
  expect(BRANCH_PREFIXES.some((prefix) => branch.startsWith(prefix))).toBe(true);
});

test("the bot's pull request, closed, points at the new one", () => {
  const url = "https://github.com/cBallGitWork/draft-platform/pull/1155";
  expect(closingNote(url)).toContain(url);
});
