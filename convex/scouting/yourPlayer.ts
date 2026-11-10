import { v, type Infer } from "convex/values";
import { query } from "../_generated/server";
import { MOST_IN_SQUAD } from "../leagues/leagueLimits";
import { lineupInGameweek, saveGameweekOf } from "../lineup/lineups";
import { positionOfSlot, type Area, type Lane } from "../lineup/pitch";
import { cardOpensAt } from "../playerCard/cardPoints";
import { positionsNow } from "../positions/playerPositions";
import { latestRules } from "../rules/rulesHistory";
import { position } from "../schema";
import { memberOf } from "../shared/leagueAccess";
import { heldOrNot, squadOf } from "../squads/squadPlace";
import { shownSeasonPoints } from "./shownSeasonPoints";

// Whom the selected player's panel on Scouting offers to compare him with (#1028's story 4; Craig,
// 9 Nov 2026, on #1028, answer 1): the manager's starter at his main position in the current
// lineup; with none starting there, the squad player whose main position it is with the most
// season points; with none of either, nobody, so only Compare with another… shows. And whether the
// manager's squad is full, so Compare's pickup names who goes (answer 4).

const yourPlayer = v.object({
  /** The selected player's main position, which the button names ("Compare with your CAM"). */
  position,
  code: v.number(),
  name: v.string(),
});

const yours = v.union(
  /** The caller runs no team in the league. */
  v.null(),
  v.object({
    /** Your player at his main position, or null with none (or him alone). */
    player: v.union(yourPlayer, v.null()),
    /** Whether the squad holds as many as the league's rules allow (MOST_IN_SQUAD with no limit),
     *  so a pickup or a claim from Compare drops the player it is compared with. */
    squadFull: v.boolean(),
  }),
);
export type YourPlayer = Infer<typeof yours>;

/** The caller's player at the main position of the player with `playerCode`, from the lineup for
 *  the next gameweek not begun at `now` (the screen's: a query may not read the clock), and
 *  whether his squad is full. Null for anyone who runs no team in the league. */
export const at = query({
  args: { leagueId: v.id("leagues"), playerCode: v.number(), now: v.number() },
  returns: yours,
  handler: async (ctx, { leagueId, playerCode, now }): Promise<YourPlayer> => {
    const { team } = await memberOf(ctx, leagueId);
    if (team === undefined) return null;
    const { held } = await heldOrNot(ctx, await squadOf(ctx, team._id));
    const maximum = (await latestRules(ctx, leagueId)).squad.size?.maximum ?? MOST_IN_SQUAD;
    const squadFull = held.length >= maximum;
    const positionsOf = await positionsNow(ctx, leagueId);
    const main = cardOpensAt(await positionsOf(playerCode));
    if (main === null) return { player: null, squadFull };
    const nameOf = new Map(held.map(({ player }) => [player.code, player.name]));
    const named = (code: number) => ({ position: main, code, name: nameOf.get(code)! });

    const next = await saveGameweekOf(ctx, leagueId, now);
    if (next.kind === "open") {
      const { starters } = await lineupInGameweek(ctx, leagueId, team._id, next.gameweek);
      const starter = starters.find(
        (each) => each.playerCode !== playerCode && nameOf.has(each.playerCode) && positionOfSlot({ area: each.area as Area, lane: each.lane as Lane }) === main,
      );
      if (starter !== undefined) return { player: named(starter.playerCode), squadFull };
    }

    const { pointsOf } = await shownSeasonPoints(ctx, leagueId, [...nameOf.keys()]);
    let best: { code: number; points: number } | null = null;
    for (const code of nameOf.keys()) {
      if (code === playerCode) continue;
      const positions = await positionsOf(code);
      if (cardOpensAt(positions) !== main) continue;
      const points = pointsOf(code, positions) ?? 0;
      if (best === null || points > best.points) best = { code, points };
    }
    return { player: best === null ? null : named(best.code), squadFull };
  },
});
