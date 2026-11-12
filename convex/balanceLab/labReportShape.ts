import { v, type Infer } from "convex/values";

// The rule balance lab's report (spec/14, The rule balance lab; #843): what balanceLab.ts works out
// of a patch draft on the past seasons, shown to the admin on the draft patch and kept with the
// patch once announced, for the patch notes (Craig, 6 Nov 2026: "5 a").

/** A role the past seasons could test: its average a start over the slot's real starts it was
 *  tested on, null with none, and whether that is more than ROLE_TARGET_MARGIN off its target. */
const testedRole = v.object({
  role: v.string(),
  slot: v.string(),
  target: v.number(),
  starts: v.number(),
  average: v.union(v.number(), v.null()),
  offTarget: v.boolean(),
});

/** A role scoring a stat the past seasons weren't copied with: "not tested", naming those stats,
 *  with no average and no flag (Craig, 7 Nov 2026, on #843: "a"). */
const notTestedRole = v.object({ role: v.string(), slot: v.string(), target: v.number(), missing: v.array(v.string()) });

const labRoleShape = v.union(testedRole, notTestedRole);
export type LabRole = Infer<typeof labRoleShape>;

/** A team instruction the set scores (spec/14 S14.9): its average for a whole XI over the clubs'
 *  real XIs in a shape that allows it, null with none, and how many XIs that was. */
const testedInstruction = v.object({ instruction: v.string(), xis: v.number(), average: v.union(v.number(), v.null()) });

/** A team instruction scoring a stat the past seasons weren't copied with: "not tested", naming
 *  those stats (S14.13). On a report kept before #1541's averages every instruction is one, its
 *  `missing` empty where every stat was copied. */
const notTestedInstruction = v.object({ instruction: v.string(), missing: v.array(v.string()) });

const labInstructionShape = v.union(testedInstruction, notTestedInstruction);
export type LabInstruction = Infer<typeof labInstructionShape>;

export const labReportShape = v.object({
  /** The past seasons it ran on, oldest first, each the year it starts. */
  seasons: v.array(v.number()),
  /** The real starts it counted in a slot. */
  starts: v.number(),
  /** Starts with a position that maps to no slot: left out (Craig, 6 Nov 2026, on #843). */
  startsSkipped: v.number(),
  /** Each role the set scores, slot by slot. */
  roles: v.array(labRoleShape),
  /** Each team instruction the set scores, in its order; absent on a report kept before #1541. */
  instructions: v.optional(v.array(labInstructionShape)),
  /** The clubs' real XIs in the past matches; absent on a report kept before #1541's averages. */
  xis: v.optional(v.number()),
  /** Of those, the XIs short of a starter whose position maps to a cell, scored on the starters
   *  they have; absent on a report kept before #1541's averages. */
  xisShort: v.optional(v.number()),
});
export type LabReport = Infer<typeof labReportShape>;
