import { v, type Infer } from "convex/values";
import { query } from "../_generated/server";
import { leagueRulesShape } from "../rules/leagueRulesShape";
import { deadlineOf, leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { shownDeadline } from "../gameweeks/usedGameweeks";
import { clubByCode, playerByCode, unheldPlayerWords } from "../shared/players";
import { positionsNow } from "../positions/playerPositions";
import { position } from "../schema";
import { managerOf } from "../shared/leagueAccess";
import { squadOf } from "../squads/squadPlace";
import { heldLineupShape, lineupInGameweek, saveGameweekOf } from "./lineups";
import { starsOfPlayers } from "../stars/playerStars";
import { roleStarsShape } from "../stars/starsShape";

// My team's Tactics tab (#14; spec/05, The pitch): what the pitch is set from. The gameweek is the
// one a save now is from (lineups.ts's `save`), so the screen edits the lineup that save replaces,
// under that gameweek's area limits and presets, and counts down to its league deadline (the
// recorded one once passed, #150), with each player's stars, which show the role he suits (#11).

/** One player in the squad, as the pitch shows him and judges where he may stand. */
const squadMember = v.object({
  playerCode: v.number(),
  /** His name; for one the football sync doesn't hold, words saying so (#323). */
  name: v.string(),
  /** Null for one the football sync doesn't hold. */
  clubShortName: v.union(v.string(), v.null()),
  /** FPL's season-stable club code, which his shirt's colours are found by (clubColours.ts); null
   *  for one the football sync doesn't hold, who wears the shirt of a club with no colours. */
  clubCode: v.union(v.number(), v.null()),
  /** The football sync doesn't hold him: data gone wrong, kept so it shows (#323). */
  unheld: v.boolean(),
  positions: v.array(position),
  /** The squad number his manager gave him, on his shirt, or null until given (#13). */
  number: v.union(v.number(), v.null()),
  /** His stars for each role in each area he plays (#11), which pick the role he starts on when
   *  dropped into a slot. */
  stars: v.array(roleStarsShape),
});

const tacticsShape = v.union(
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
    const next = await saveGameweekOf(ctx, leagueId, now);
    if (next.kind !== "open") return { kind: next.kind };
    const { season, gameweek } = next;

    const positionsOfNow = await positionsNow(ctx, leagueId);
    const members = await squadOf(ctx, team._id);
    const starsOf = await starsOfPlayers(
      ctx,
      members.map(({ playerCode }) => playerCode),
    );
    const squad = await Promise.all(
      members.map(async ({ playerCode, number }) => {
        const player = await playerByCode(ctx, playerCode);
        return {
          playerCode,
          name: player === null ? unheldPlayerWords(playerCode) : player.name,
          clubShortName: player === null ? null : (await clubByCode(ctx, player.clubCode)).shortName,
          clubCode: player?.clubCode ?? null,
          unheld: player === null,
          // His positions are read as for any other player: the lineup's check says where he may stand.
          positions: await positionsOfNow(playerCode),
          number: number ?? null,
          stars: starsOf.get(playerCode)!,
        };
      }),
    );
    const { areaLimits, presets } = season.inGameweek(gameweek);
    return {
      kind: "open" as const,
      gameweek,
      deadline: deadlineOf(await leagueDeadlines(ctx, leagueId))(gameweek),
      areaLimits,
      presets,
      squad,
      lineup: await lineupInGameweek(ctx, leagueId, team._id, gameweek),
    };
  },
});
