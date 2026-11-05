import { v, type Infer } from "convex/values";
import { query } from "../_generated/server";
import { memberOf } from "../shared/leagueAccess";
import { currentClubs, currentPlayersAt } from "../shared/players";
import { squadOf } from "../squads/squadPlace";
import { whyNotLegalFor } from "./draftPicks";
import { draftOf, picksMadeIn } from "./draftRow";
import { pickOnTheClock } from "./snakeOrder";

// The draft room's players list's legal flag (spec/04, The draft room; #1099): which players the
// reader's team can't take as its next pick, and why, so the list greys them out in their place
// ("yes" to Claude's recommendation, 4 Nov 2026) and his Draft button can't be pressed. The list
// itself is Scouting's (../scouting/playersList.ts). The rule is the pick's own
// (draftPicks.ts `whyNotLegalFor`, legalPlayers.ts), so the list and the pick never disagree.

const notLegal = v.union(v.literal("squadFull"), v.literal("clubFull"), v.literal("areasShort"));

const greyedPlayer = v.object({ code: v.number(), reason: notLegal });
export type GreyedPlayer = Infer<typeof greyedPlayer>;

/** Every Premier League player now whom the caller's team may not take as its next pick, with why,
 *  while the draft is live. None before it starts, once it is over, or for a commissioner who runs
 *  no team. Players already drafted are listed too, as the rule says; the list shows them as taken.
 *  Refused to anyone outside the league. */
export const greyedOut = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(greyedPlayer),
  handler: async (ctx, { leagueId }) => {
    const { team } = await memberOf(ctx, leagueId);
    const started = (await draftOf(ctx, leagueId))?.started;
    if (!team || started === undefined) return [];
    if (pickOnTheClock(started.teamIds, started.rounds, await picksMadeIn(ctx, leagueId)) === null) return [];
    // Squads are empty when the draft starts (spec/04, The picks), so each player in it is a pick made.
    const picksLeft = started.rounds - (await squadOf(ctx, team._id)).length;
    const why = await whyNotLegalFor(ctx, leagueId, started, team._id, picksLeft);
    const players = (await Promise.all((await currentClubs(ctx)).map(({ code }) => currentPlayersAt(ctx, code)))).flat();
    const greyed = await Promise.all(players.map(async (player) => ({ code: player.code, reason: await why(player) })));
    return greyed.flatMap(({ code, reason }) => (reason === null ? [] : [{ code, reason }]));
  },
});
