import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { memberOf, refuse, refusals, runnerOf, teamIn, teamsOf } from "../shared/leagueAccess";
import { recordEvent } from "../mail/letters";
import { tellShortlisters } from "../scouting/shortlist";
import { clubByCode, playerByCode, playersNamed } from "../shared/players";
import { MOST_IN_SQUAD } from "../leagues/leagueLimits";
import { latestRules } from "../rules/rulesHistory";
import { areaShape } from "../lineup/pitchShape";
import type { LeagueRules } from "../rules/leagueRulesShape";
import { areasOf, type Area } from "../lineup/pitch";
import { positionsNow } from "../positions/playerPositions";
import { areasShort } from "./areaMinimums";
import { readOnce } from "../shared/readOnce";
import { heldOrNot, ownerOf, placeOf, squadOf, unheldCodes } from "./squadPlace";
import { pickFirstLineupAgain } from "../lineup/lineups";

// Assigning players (#31, spec/15): the league's commissioners and the admin put any player on any
// team, one at a time, move him between teams, or release him to free agency. Each files a Mail
// letter (spec/15: nothing changes quietly), and a release also tells each manager whose shortlist
// holds him (spec/19). The league's squad limits warn, never block.
//
// Each change to a squad files its league event in the same transaction, and nothing else writes
// squadPlayers, so the events say what every squad was at any moment (squadPlace.ts `squadAt`,
// #415). A new way to change a squad must file one of squadPlace.ts's SQUAD_MOVES too, or join
// them, and pick each team's first lineup again (lineups.ts `pickFirstLineupAgain`), so a team
// always has a lineup (#637).

export const squadRefusals = {
  noPlayer: refusals.noPlayer,
  playerGone: (name: string) => `${name} has left the Premier League, so he can't join a team.`,
  alreadyOwned: (name: string, teamName: string) => `${name} is already on ${teamName}. Move him instead.`,
  freeAgent: (name: string) => `${name} isn't on a team in this league.`,
  alreadyThere: (name: string, teamName: string) => `${name} is already on ${teamName}.`,
  squadFull: `A team holds at most ${MOST_IN_SQUAD} players.`,
};

/** The player with `code`, or the refusal that there is none. */
async function heldPlayer(ctx: QueryCtx, code: number): Promise<Doc<"players">> {
  return (await playerByCode(ctx, code)) ?? refuse(squadRefusals.noPlayer);
}


/** Refuses a team already holding the platform's most, whatever the league's own limits say. */
async function roomOn(ctx: QueryCtx, team: Doc<"teams">): Promise<void> {
  if ((await squadOf(ctx, team._id)).length >= MOST_IN_SQUAD) refuse(squadRefusals.squadFull);
}

const placement = { leagueId: v.id("leagues"), playerCode: v.number(), teamId: v.id("teams") };

/** Puts a free agent on a team. A player who has left the Premier League can't join one. */
export const assign = mutation({
  args: placement,
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCode, teamId }) => {
    const { email: by } = await runnerOf(ctx, leagueId);
    const player = await heldPlayer(ctx, playerCode);
    if (player.droppedAt !== undefined) refuse(squadRefusals.playerGone(player.name));
    const team = await teamIn(ctx, leagueId, teamId);
    const place = await placeOf(ctx, leagueId, playerCode);
    if (place !== null) refuse(squadRefusals.alreadyOwned(player.name, (await teamIn(ctx, leagueId, place.teamId)).name));
    await roomOn(ctx, team);
    await ctx.db.insert("squadPlayers", { leagueId, teamId, playerCode });
    await recordEvent(ctx, leagueId, by, { kind: "playerAssigned", playerCode, playerName: player.name, teamId, teamName: team.name });
    await pickFirstLineupAgain(ctx, leagueId, teamId);
    return null;
  },
});

/** Moves a player from his team to another in the league. */
export const move = mutation({
  args: placement,
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCode, teamId }) => {
    const { email: by } = await runnerOf(ctx, leagueId);
    const player = await heldPlayer(ctx, playerCode);
    const team = await teamIn(ctx, leagueId, teamId);
    const place = (await placeOf(ctx, leagueId, playerCode)) ?? refuse(squadRefusals.freeAgent(player.name));
    if (place.teamId === teamId) refuse(squadRefusals.alreadyThere(player.name, team.name));
    await roomOn(ctx, team);
    const from = await teamIn(ctx, leagueId, place.teamId);
    // A new team starts him afresh, on no number of its own (spec/05 Squad numbers).
    await ctx.db.patch("squadPlayers", place._id, { teamId, number: undefined });
    await recordEvent(ctx, leagueId, by, {
      kind: "playerMoved",
      playerCode,
      playerName: player.name,
      teamId,
      teamName: team.name,
      fromTeamId: from._id,
      fromTeamName: from.name,
    });
    await pickFirstLineupAgain(ctx, leagueId, teamId);
    await pickFirstLineupAgain(ctx, leagueId, from._id);
    return null;
  },
});

/** Releases a player from his team to free agency. */
export const release = mutation({
  args: { leagueId: v.id("leagues"), playerCode: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCode }) => {
    const { email: by, league } = await runnerOf(ctx, leagueId);
    const player = await heldPlayer(ctx, playerCode);
    const place = (await placeOf(ctx, leagueId, playerCode)) ?? refuse(squadRefusals.freeAgent(player.name));
    const team = await teamIn(ctx, leagueId, place.teamId);
    await ctx.db.delete("squadPlayers", place._id);
    await recordEvent(ctx, leagueId, by, { kind: "playerReleased", playerCode, playerName: player.name, teamId: team._id, teamName: team.name });
    await tellShortlisters(ctx, league, player, team, by);
    await pickFirstLineupAgain(ctx, leagueId, team._id);
    return null;
  },
});

const squadPlayer = v.object({ code: v.number(), name: v.string(), clubShortName: v.string(), gone: v.boolean() });

/** Where a squad stands against the league's squad limits (spec/03): each one it breaks. */
const squadWarning = v.union(
  v.object({ kind: v.literal("overMaximum"), players: v.number(), maximum: v.number() }),
  v.object({ kind: v.literal("underMinimum"), players: v.number(), minimum: v.number() }),
  v.object({ kind: v.literal("overClubMaximum"), clubShortName: v.string(), players: v.number(), maximum: v.number() }),
  v.object({ kind: v.literal("underAreaMinimum"), area: areaShape, players: v.number(), minimum: v.number() }),
);
export type SquadWarning = Infer<typeof squadWarning>;

const squadWithWarnings = v.object({
  teamId: v.id("teams"),
  teamName: v.string(),
  players: v.array(squadPlayer),
  unheld: unheldCodes,
  warnings: v.array(squadWarning),
});
export type SquadWithWarnings = Infer<typeof squadWithWarnings>;

/** Each team's squad, by name, and the league's squad limits it breaks, which warn but don't block.
 *  Anyone with a part in the league sees them. */
export const squads = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(squadWithWarnings),
  handler: async (ctx, { leagueId }) => {
    await memberOf(ctx, leagueId);
    const rules = await latestRules(ctx, leagueId);
    const positionsOfNow = await positionsNow(ctx, leagueId);
    const shortNameOf = readOnce(async (clubCode: number) => (await clubByCode(ctx, clubCode)).shortName);
    return Promise.all(
      (await teamsOf(ctx, leagueId)).map(async (team) => {
        const squad = await squadOf(ctx, team._id);
        const { held, unheld } = await heldOrNot(ctx, squad);
        const players = await Promise.all(
          held.map(async ({ player }) => ({
            code: player.code,
            name: player.name,
            clubShortName: await shortNameOf(player.clubCode),
            gone: player.droppedAt !== undefined,
          })),
        );
        // Positions are read only for a league with area minimums, the one limit that needs them.
        const playersAreas = rules?.squad.minimumByArea
          ? await Promise.all(squad.map(async ({ playerCode }) => areasOf(await positionsOfNow(playerCode))))
          : [];
        players.sort((one, other) => one.name.localeCompare(other.name));
        const warnings = squadWarnings(squad.length, players, playersAreas, rules?.squad ?? null);
        return { teamId: team._id, teamName: team.name, players, unheld, warnings };
      }),
    );
  },
});

/** The league's squad limits a squad of `playerCount` players breaks (spec/03, Squad make-up),
 *  given the clubs of those the football sync holds and each player's areas (areaMinimums.ts says
 *  how they fill the minimums). */
function squadWarnings(
  playerCount: number,
  players: readonly { clubShortName: string }[],
  playersAreas: readonly (readonly Area[])[],
  squad: LeagueRules["squad"] | null,
): SquadWarning[] {
  if (squad === null) return [];
  const warnings: SquadWarning[] = [];
  const { size, minimumByArea, maxPerClub } = squad;
  if (size !== null && playerCount > size.maximum) warnings.push({ kind: "overMaximum", players: playerCount, maximum: size.maximum });
  if (size !== null && playerCount < size.minimum) warnings.push({ kind: "underMinimum", players: playerCount, minimum: size.minimum });
  if (maxPerClub !== null) {
    const byClub = new Map<string, number>();
    for (const { clubShortName } of players) byClub.set(clubShortName, (byClub.get(clubShortName) ?? 0) + 1);
    for (const [clubShortName, count] of byClub) {
      if (count > maxPerClub) warnings.push({ kind: "overClubMaximum", clubShortName, players: count, maximum: maxPerClub });
    }
  }
  if (minimumByArea !== null) {
    for (const short of areasShort(playersAreas, minimumByArea)) warnings.push({ kind: "underAreaMinimum", ...short });
  }
  return warnings;
}

const foundPlayer = v.object({ code: v.number(), name: v.string(), fullName: v.string(), teamName: v.union(v.string(), v.null()) });
export type FoundPlayer = Infer<typeof foundPlayer>;

/** Players whose name matches, for picking one to assign: each with his team in this league, if
 *  any. For the league's commissioners and the admin. */
export const findPlayers = query({
  args: { leagueId: v.id("leagues"), text: v.string() },
  returns: v.array(foundPlayer),
  handler: async (ctx, { leagueId, text }) => {
    await runnerOf(ctx, leagueId);
    if (!text.trim()) return [];
    const found = await playersNamed(ctx, text);
    const owner = await ownerOf(ctx, leagueId);
    return Promise.all(
      found.map(async (player) => {
        return {
          code: player.code,
          name: player.name,
          fullName: player.fullName,
          teamName: (await owner(player.code))?.name ?? null,
        };
      }),
    );
  },
});
