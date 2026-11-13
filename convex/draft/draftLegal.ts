import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { MinimumAreasNow } from "../positions/playerPositions";
import type { Position } from "../positions/positionTables";
import { heldPlayerByCode } from "../shared/players";
import { squadOf } from "../squads/squadPlace";
import { draftedPositionsIn, picksLeftOf, type StartedDraft, type Turn } from "./draftRow";
import { whyNotLegal, type DraftPlayer, type NotLegal } from "./legalPlayers";

// Which players a team may legally take as its next pick, read from the league (spec/04, The
// picks; #1090): the rule itself is legalPlayers.ts's. The pick (draftPicks.ts) and the draft
// room's greyed-out list (draftPlayers.ts) both ask it, so the two never disagree.

/** Why `teamId` may not take a player as its next pick, under the squad rules the draft started
 *  under, with `picksLeft` picks still to make counting this one and a legal finish from the
 *  `undrafted`; null when it may, each player's areas for the minimums read through
 *  `minimumAreasOf`. The pick and the draft room's greyed-out list both ask it. */
export async function whyNotLegalFor(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  started: StartedDraft,
  teamId: Id<"teams">,
  picksLeft: number,
  undrafted: readonly Doc<"players">[],
  minimumAreasOf: MinimumAreasNow,
): Promise<(player: Doc<"players">) => Promise<NotLegal | null>> {
  const asDraftPlayer = async ({ clubCode, code }: Doc<"players">, positions?: Position[]): Promise<DraftPlayer> => ({
    clubCode,
    areas: await minimumAreasOf(code, positions),
  });
  // His squad counts each player it drafted at the positions he had then (#1484).
  const drafted = await draftedPositionsIn(ctx, leagueId);
  const squad = await Promise.all(
    (await squadOf(ctx, teamId)).map(async ({ playerCode }) =>
      asDraftPlayer(await heldPlayerByCode(ctx, playerCode, `Player ${playerCode}, drafted by team ${teamId}, isn't in the football data`), drafted.get(playerCode)),
    ),
  );
  const why = whyNotLegal(squad, picksLeft, started.squad, await Promise.all(undrafted.map((each) => asDraftPlayer(each))));
  return async (player) => why(await asDraftPlayer(player));
}

/** Whether the team on the clock may legally take a player, under the squad rules the draft started
 *  under, with the picks it has left counting this one and a legal finish from the `undrafted`. */
export async function legalForTurn(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  draft: Doc<"drafts">,
  started: StartedDraft,
  turn: Turn,
  undrafted: readonly Doc<"players">[],
  minimumAreasOf: MinimumAreasNow,
): Promise<(player: Doc<"players">) => Promise<boolean>> {
  const why = await whyNotLegalFor(ctx, leagueId, started, turn.team, await picksLeftOf(ctx, draft, started, turn.team), undrafted, minimumAreasOf);
  return async (player) => (await why(player)) === null;
}
