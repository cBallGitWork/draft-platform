// The team instructions (spec/05, Team instructions), by the side of the game each is for: a team
// picks one attacking and one defensive. Only their keys and names so far, which a classic's
// instructions are held by (classics.ts; #991). Which shapes offer each, its description and how
// it scores come with picking them (#990).

/** The side of the game an instruction is for: a team picks one of each. */
export type InstructionSide = "attacking" | "defensive";

export interface Instruction {
  /** Saved with a league's rules, so never renamed: a new name is a new instruction. */
  key: string;
  /** As spec/05's list names it. */
  name: string;
}

const instruction = (key: string, name: string): Instruction => ({ key, name });

/** spec/05's default set, in its order (Craig, 4 Nov 2026). */
export const INSTRUCTIONS: Record<InstructionSide, readonly Instruction[]> = {
  attacking: [
    instruction("playOutFromTheBack", "Play out from the back"),
    instruction("bootItToTheBigMan", "Boot it to the big man"),
    instruction("getItWide", "Get it wide"),
    instruction("shootOnSight", "Shoot on sight"),
    instruction("gungHo", "Gung-ho"),
  ],
  defensive: [
    instruction("pressHigh", "Press high"),
    instruction("holdAHighLine", "Hold a high line"),
    instruction("clearIt", "Clear it"),
    instruction("getStuckIn", "Get stuck in"),
    instruction("keepItTightEarly", "Keep it tight early"),
    instruction("parkTheBus", "Park the bus"),
  ],
};

/** Whether `key` is one of this side's instructions. */
export const isInstruction = (side: InstructionSide, key: string): boolean => INSTRUCTIONS[side].some((each) => each.key === key);
