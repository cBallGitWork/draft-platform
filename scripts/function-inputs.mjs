#!/usr/bin/env node
// A call already queued keeps the inputs it was made with (#2172): a scheduled job, a cron's next
// run or a page still open in someone's browser calls a function by its path with arguments
// matching the code that queued it. Fails when a function in origin/main's record of inputs
// (INPUTS_RECORD, which tests/scripts/function-inputs.test.mjs keeps in step with the code) is
// gone from the branch's, or takes inputs a call made against main may not fit: a new required
// argument, one dropped, or a narrower type. Unless a commit on the branch carries the trailer
//     Inputs-changed: <function>: <how queued calls survive: re-export or drain>
// naming that function as the record does ("draft/draftPicks:makePick"). New functions, new
// optional arguments and wider types pass.
// Run from the repo: `node scripts/function-inputs.mjs`; `npm test` runs it, so CI does.

import { existsSync, readFileSync } from "node:fs";
import { branchCheck, TRAILER_PLACE } from "./branchCheck.mjs";
import { ranDirectly } from "./thisScript.mjs";
import { strandedAt } from "./schema-shape.mjs";

/** Every public function's and every schedulable one's arguments, as Convex's validators export
 *  them, keyed "folder/module:name". */
export const INPUTS_RECORD = "tests/support/functionInputs.json";
export const INPUTS_TRAILER = "Inputs-changed";

/** Each function in `before` that `after` lost or takes inputs a call made against `before` may
 *  not fit, with where. */
export function brokenInputs(before, after) {
  return Object.entries(before).flatMap(([fn, args]) => {
    if (!(fn in after)) return [{ fn, why: "is gone" }];
    const at = strandedAt(args, after[fn], { newRequiredStrands: true });
    if (at === null) return [];
    return [{ fn, why: at ? `takes inputs a queued call may not fit, at ${at}` : "takes inputs a queued call may not fit" }];
  });
}

/** A record of inputs as its file holds it: one function a line, so a change reads as its own line. */
export const recordText = (record) =>
  `{\n${Object.keys(record)
    .sort()
    .map((fn) => `  ${JSON.stringify(fn)}: ${JSON.stringify(record[fn])}`)
    .join(",\n")}\n}\n`;

if (ranDirectly(import.meta.url)) {
  const { fail, git, base: baseOf, trailerValues } = branchCheck("function inputs check");
  const base = baseOf();
  if (!existsSync(INPUTS_RECORD)) {
    fail(`${INPUTS_RECORD} is missing. Write it with: npx vitest run tests/scripts/function-inputs.test.mjs -u`);
  }
  // No record on main yet: nothing queued against it to compare with.
  if (git("ls-tree", "--name-only", base, "--", INPUTS_RECORD).trim()) {
    const before = JSON.parse(git("show", `${base}:${INPUTS_RECORD}`));
    const after = JSON.parse(readFileSync(INPUTS_RECORD, "utf8"));
    /** The functions the branch's commits say changed inputs on purpose, with how queued calls survive. */
    const allowed = new Set(
      trailerValues(INPUTS_TRAILER, base)
        .map((value) => value.match(/^\s*(\S+):\s+\S/)?.[1])
        .filter(Boolean),
    );
    const refused = brokenInputs(before, after).filter(({ fn }) => !allowed.has(fn));
    if (refused.length) {
      fail(
        `calls queued before this branch deploys may still run, but ${refused.map(({ fn, why }) => `${fn} ${why}`).join("; ")}. ` +
          `Keep the old inputs working, or add a trailer to a commit on this branch for each, saying how queued calls ` +
          `survive (a re-export under the old inputs, or a drain before the deploy): "${INPUTS_TRAILER}: <function>: <how>", ${TRAILER_PLACE}.`,
      );
    }
  }
}
