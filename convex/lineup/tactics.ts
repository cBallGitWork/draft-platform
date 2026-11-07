import { v, type Infer } from "convex/values";
import { query } from "../_generated/server";
import { classicShape, leagueRulesShape } from "../rules/leagueRulesShape";
import { classicsOf } from "../rules/firstRules";
import { deadlineOf, leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { shownDeadline } from "../gameweeks/usedGameweeks";
import { clubByCode, playerByCode, unheldPlayerWords } from "../shared/players";
import { workedOutNow } from "../positions/playerPositions";
import { howPositionsCount } from "../positions/positionSettings";
import { position } from "../schema";
import { managerOf } from "../shared/leagueAccess";
import { squadOf } from "../squads/squadPlace";
import { shirtNumber } from "../squads/squadNumbers";
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
  /** His positions flagged by a run of starts elsewhere (#23; spec/06, When positions change), each
   *  with how many in a row: the mark after his name says which is at stake. */
  flagged: v.array(v.object({ position, startsElsewhere: v.number() })),
  /** His shirt's number (#13): his manager's, else his club's, else null (squadNumbers.ts). */
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
    /** The league's classics in force, the first rules' for rules saved before #991 (firstRules.ts
     *  `classicsOf`). */
    classics: v.array(classicShape),
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

    const how = await howPositionsCount(ctx, leagueId);
    const members = await squadOf(ctx, team._id);
    const starsOf = await starsOfPlayers(
      ctx,
      members.map(({ playerCode }) => playerCode),
    );
    const squad = await Promise.all(
      members.map(async (member) => {
        const { playerCode } = member;
        const player = await playerByCode(ctx, playerCode);
        // His positions are read as for any other player: the lineup's check says where he may stand.
        const { positions } = await workedOutNow(ctx, playerCode, how);
        return {
          playerCode,
          name: player === null ? unheldPlayerWords(playerCode) : player.name,
          clubShortName: player === null ? null : (await clubByCode(ctx, player.clubCode)).shortName,
          clubCode: player?.clubCode ?? null,
          unheld: player === null,
          positions: positions.map(({ position }) => position),
          flagged: positions.flatMap(({ position, flaggedElsewhere }) => (flaggedElsewhere === null ? [] : [{ position, startsElsewhere: flaggedElsewhere }])),
          number: await shirtNumber(ctx, member),
          stars: starsOf.get(playerCode)!,
        };
      }),
    );
    const rules = season.inGameweek(gameweek);
    return {
      kind: "open" as const,
      gameweek,
      deadline: deadlineOf(await leagueDeadlines(ctx, leagueId))(gameweek),
      areaLimits: rules.areaLimits,
      presets: rules.presets,
      classics: classicsOf(rules),
      squad,
      lineup: await lineupInGameweek(ctx, leagueId, team._id, gameweek),
    };
  },
});
