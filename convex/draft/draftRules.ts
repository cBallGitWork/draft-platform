// The kinds a league's draft rules choose between (spec/04; #1087), as ../rules/leagueRulesShape.ts
// stores them. Pure: no I/O.

/** How the draft order is set (spec/04, Starting it). "commissioner": the commissioner's order,
 *  which starts as the order the teams joined in, a team joining later going to the bottom
 *  (draftOrder.ts). "random": drawn before the draft starts. Last season's finish isn't one
 *  (Craig, 4 Nov 2026, on #1087: "i dont think we implment this"). */
export const DRAFT_ORDERS = ["commissioner", "random"] as const;
export type DraftOrder = (typeof DRAFT_ORDERS)[number];

/** Where the players nobody drafts go (spec/04, The picks). Until waivers are built, the draft
 *  sends them to free agents whichever is chosen (Craig, 4 Nov 2026, on #1087). */
export const UNDRAFTED_GO_TO = ["waivers", "freeAgents"] as const;
export type UndraftedGoTo = (typeof UNDRAFTED_GO_TO)[number];
