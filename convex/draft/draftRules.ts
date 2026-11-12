import type { LeagueRules } from "../rules/leagueRulesShape";
import { squadMaximumOf } from "../rules/squadMaximums";

// The kind a league's draft rules choose between (spec/04; #1087), as ../rules/leagueRulesShape.ts
// stores it. How the draft order is set is no longer one: the commissioner always orders the teams
// himself or draws them at random (draftOrder.ts; Craig, 4 Nov 2026, on #1089). Pure: no I/O.

/** Where the players nobody drafts go (spec/04, The picks): on waivers for the next run, or
 *  straight to the free agents (pickWindow.ts `endDraft`, once the last pick's 10 seconds are
 *  up; #1197). */
export const UNDRAFTED_GO_TO = ["waivers", "freeAgents"] as const;
export type UndraftedGoTo = (typeof UNDRAFTED_GO_TO)[number];

/** The draft's rounds under these rules: the squad's most players, or null with no squad size
 *  limit. draftStart.ts starts the draft with the latest
 *  rules', and a pick trade (../trades/tradePicks.ts) trades a pick in one of them. */
export const roundsOf = (rules: LeagueRules): number | null => squadMaximumOf(rules);
