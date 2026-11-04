// The kind a league's draft rules choose between (spec/04; #1087), as ../rules/leagueRulesShape.ts
// stores it. How the draft order is set is no longer one: the commissioner always orders the teams
// himself or draws them at random (draftOrder.ts; Craig, 4 Nov 2026, on #1089). Pure: no I/O.

/** Where the players nobody drafts go (spec/04, The picks). Until waivers are built, the draft
 *  sends them to free agents whichever is chosen (Craig, 4 Nov 2026, on #1087). */
export const UNDRAFTED_GO_TO = ["waivers", "freeAgents"] as const;
export type UndraftedGoTo = (typeof UNDRAFTED_GO_TO)[number];
