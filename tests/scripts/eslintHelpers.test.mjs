import { ESLint } from "eslint";
import { join } from "node:path";
import { expect, test } from "vitest";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";

// eslint.config.js's helper entries (#1806): each hand-written form fails lint naming its helper,
// and the helper's own call passes. Linted as text at a path in the folder the entry covers.
const eslint = new ESLint({ cwd: REPO_ROOT });

async function messagesOf(code, path) {
  const [result] = await eslint.lintText(code, { filePath: join(REPO_ROOT, path) });
  return result.messages.map(({ message }) => message);
}

const SERVER = "convex/zz/scratch.ts";
const SCREEN = "src/zz/scratch.tsx";

const CASES = [
  { helper: "seasonStartAt", path: SERVER, byHand: "seasonStartOf(seasonStartYear(now));", fixed: "seasonStartAt(now);" },
  { helper: "seasonStartAt", path: SERVER, byHand: "Date.UTC(seasonStartYear(now), JULY, 1);", fixed: "seasonStartAt(now);" },
  {
    helper: "draftIsOver",
    path: SERVER,
    byHand: "async () => (await draftHasStarted(ctx, leagueId)) && !(await draftIsLive(ctx, leagueId));",
    fixed: "async () => await draftIsOver(ctx, leagueId);",
  },
  {
    helper: "draftIsOver",
    path: SCREEN,
    byHand: "async () => draft.started === undefined || (await draftIsLive(ctx, leagueId));",
    fixed: "async () => !(await draftIsOver(ctx, leagueId));",
  },
  {
    helper: "byKickoff",
    path: SERVER,
    byHand: "matches.toSorted((one, other) => (one.kickoff ?? Infinity) - (other.kickoff ?? Infinity));",
    fixed: "byKickoff(matches);",
  },
  {
    helper: "firstKickoffs",
    path: SERVER,
    byHand: "first.set(gameweek, Math.min(kickoff, first.get(gameweek) ?? kickoff));",
    fixed: "firstKickoffs(matches);",
  },
  {
    helper: "nextDeadline",
    path: SERVER,
    byHand: "for (const [, at] of deadlines) soonest = Math.min(soonest ?? at, at);",
    fixed: "nextDeadline(deadlines, now)?.at ?? null;",
  },
  {
    helper: "inBatches",
    path: SERVER,
    byHand: "for (let start = 0; start < rows.length; start += BATCH_SIZE) send(rows.slice(start, start + BATCH_SIZE));",
    fixed: "for (const batch of inBatches(rows)) send(batch);",
  },
  {
    helper: "idOf",
    path: SCREEN,
    byHand: 'typeof letter === "string" && letter !== "" ? (letter as Id<"letters">) : undefined;',
    fixed: 'idOf<"letters">(letter);',
  },
  {
    helper: "useChange",
    path: SCREEN,
    byHand: "export function useX() { const [busy, setBusy] = useState(false); return [busy, setBusy]; }",
    fixed: "export function useX() { return useChange(); }",
  },
];

test.each(CASES)("$helper written by hand in $path fails lint naming it, and its call passes", async ({ helper, path, byHand, fixed }) => {
  const failed = await messagesOf(byHand, path);
  expect(failed.length).toBeGreaterThan(0);
  for (const message of failed) expect(message).toContain(`Use ${helper}`);
  expect(await messagesOf(fixed, path)).toEqual([]);
});

test("a screen's own helpers aren't asked of convex/, which can't import them", async () => {
  expect(await messagesOf(CASES.find(({ helper }) => helper === "useChange").byHand, SERVER)).toEqual([]);
});

test("a helper's home may write its own rule out, and keeps every other entry", async () => {
  expect(await messagesOf("export const seasonStartAt = (at) => seasonStartOf(seasonStartYear(at));", "convex/shared/time.ts")).toEqual([]);
  expect(await messagesOf("x += BATCH_SIZE;", "convex/shared/time.ts")).toEqual([expect.stringContaining("Use inBatches")]);
});
