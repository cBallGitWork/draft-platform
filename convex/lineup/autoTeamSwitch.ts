import type { Doc } from "../_generated/dataModel";

// The auto team's rule, pure, apart from autoTeam.ts so trades can read it: autoTeam.ts imports
// trades/tradeClose.ts, and a value import back would be a cycle (tests/convex/importCycles.test.ts).

/** Whether the team is on the auto team: switched on by a person, or with no manager (spec/09). */
export const onAutoTeam = (team: Doc<"teams">) => team.autoTeam !== undefined || team.managerEmail === undefined;
