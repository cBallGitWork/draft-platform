import { v, type Infer } from "convex/values";
import { query } from "../_generated/server";
import { seasonRules } from "../rules/rulesHistory";
import { leagueRulesShape } from "../rules/leagueRulesShape";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { GAMEWEEKS, shownDeadline } from "../gameweeks/usedGameweeks";
import { clubByCode, playerByCode } from "../shared/players";
import { currentPositions } from "../positions/playerPositions";
import { howPositionsCount } from "../positions/positionSettings";
import { position } from "../schema";
import { managerOf } from "../shared/leagueAccess";
import { squadOf } from "../squads/squadPlace";
import { heldLineupShape, lineupInGameweek, nextOpenGameweek } from "./lineups";

// My team's Tactics tab (#14; spec/05, The pitch): what the pitch is set from. The gameweek is the
// one a save now is from (lineups.ts's `save`), so the screen edits the lineup that save replaces,
// under that gameweek's area limits and presets, and counts down to its league deadline (the
// recorded one once passed, #150). Stars, which show the role a player suits, aren't built (#11).

/** One player in the squad, as the pitch shows him and judges where he may stand. */
const squadMember = v.object({
  playerCode: v.number(),
  name: v.string(),
  clubShortName: v.string(),
  positions: v.array(position),
  /** The squad number his manager gave him, on his shirt, or null until given (#13). */
  number: v.union(v.number(), v.null()),
});

export const tacticsShape = v.union(
  /** A league made before rules were held: no deadline and no area limits to set a lineup under. */
  v.object({ kind: v.literal("noRules") }),
  /** Every gameweek has begun: there is none left to set. */
  v.object({ kind: v.literal("seasonOver") }),
  v.object({
    kind: v.literal("open"),
    gameweek: v.number(),
    deadline: shownDeadline,
    areaLimits: leagueRulesShape.fields.areaLimits,
    presets: leagueRulesShape.fields.presets,
    /** In the order its players joined it. */
    squad: v.array(squadMember),
    lineup: heldLineupShape,
  }),
);
export type Tactics = Infer<typeof tacticsShape>;
export type OpenTactics = Extract<Tactics, { kind: "open" }>;

/** The caller's own team's lineup to set, for the next gameweek not begun at `now` (the screen's:
 *  a query may not read the clock). Refused for anyone who runs no team in the league. */
export const ofMyTeam = query({
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: tacticsShape,
  handler: async (ctx, { leagueId, now }) => {
    const { team } = await managerOf(ctx, leagueId);
    const season = await seasonRules(ctx, leagueId);
    if (season === null) return { kind: "noRules" as const };
    const gameweek = await nextOpenGameweek(ctx, leagueId, season, now);
    if (gameweek > GAMEWEEKS) return { kind: "seasonOver" as const };

    const how = await howPositionsCount(ctx);
    const squad = await Promise.all(
      (await squadOf(ctx, team._id)).map(async ({ playerCode, number }) => {
        // Players are never deleted, and a squad holds only one the football sync held (squads.ts).
        const player = await playerByCode(ctx, playerCode);
        if (player === null) throw new Error(`Player ${playerCode} is in team ${team._id}'s squad but isn't held`);
        return {
          playerCode,
          name: player.name,
          clubShortName: (await clubByCode(ctx, player.clubCode)).shortName,
          positions: await currentPositions(ctx, playerCode, how),
          number: number ?? null,
        };
      }),
    );
    const { areaLimits, presets } = season.inGameweek(gameweek);
    return {
      kind: "open" as const,
      gameweek,
      deadline: (await leagueDeadlines(ctx, leagueId)).get(gameweek) ?? null,
      areaLimits,
      presets,
      squad,
      lineup: await lineupInGameweek(ctx, leagueId, team._id, gameweek),
    };
  },
});
