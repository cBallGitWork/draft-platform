import { v } from "convex/values";
import { SHAPE_NEEDS, SIDES } from "./instructions";

// Team instructions' validators (spec/05, Team instructions; #990): a league's rules hold the set
// and each preset's default pair, and a lineup row its two picks, so they live beside the module.

/** instructions.ts's Side. */
export const sideShape = v.union(...SIDES.map((side) => v.literal(side)));

/** instructions.ts's Instruction. */
export const instructionShape = v.object({
  key: v.string(),
  side: sideShape,
  name: v.string(),
  description: v.string(),
  needs: v.union(...SHAPE_NEEDS.map((need) => v.literal(need))),
});

/** instructions.ts's InstructionPair. */
export const instructionPairShape = v.object({ attacking: v.string(), defensive: v.string() });
