import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { memberOf, refuse, refusals, runnerOf, teamIn, teamsOf } from "../shared/leagueAccess";
import { recordEvent } from "../mail/letters";
import { tellShortlisters } from "../scouting/shortlist";
import { clubByCode, playerByCode, playersNamed } from "../shared/players";
import { MOST_IN_SQUAD } from "../leagues/leagueLimits";
import { latestRules } from "../rules/rulesHistory";
import { areaShape, type LeagueRules } from "../rules/leagueRulesShape";
import type { leagueEvent } from "../schema";
import { areasOf, type Area } from "../lineup/pitch";
import { currentPositions } from "../positions/playerPositions";
import { howPositionsCount } from "../positions/positionSettings";
import { areasShort } from "./areaMinimums";
import { takeAllOrThrow } from "../shared/cappedRead";

// Assigning players (#31, spec/15): the league's commissioners and the admin put any player on any
// team, one at a time, move him between teams, or release him to free agency. Each files a Mail
// letter (spec/15: nothing changes quietly), and a release also tells each manager whose shortlist
// holds him (spec/19). The league's squad limits warn, never block.
//
// Each change to a squad files its league event in the same transaction, and nothing else writes
// squadPlayers, so the events say what every squad was at any moment (`squadAt`, #415). A new way
// to change a squad must file one of SQUAD_MOVES too, or join them.

/** The league events that change a squad. Today a commissioner assigns, moves and releases players
 *  (#31); waiver claims and trades join them when built. */
export const SQUAD_MOVES = ["playerAssigned", "playerMoved", "playerReleased"] as const;

/** The most squad moves of each kind `squadAt` reads after a moment: Claude's sizing, well above a
 *  season's moves in one league. Past it this throws rather than return a wrong squad. */
export const SQUAD_MOVES_READ_MOST = 2000;

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

/** The player's place in this league, or null while he is a free agent. */
function placeOf(ctx: QueryCtx, leagueId: Id<"leagues">, playerCode: number) {
  return ctx.db
    .query("squadPlayers")
    .withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("playerCode", playerCode))
    .unique();
}

/** The team's squad rows, in the order its players joined it. */
export function squadOf(ctx: QueryCtx, teamId: Id<"teams">) {
  return ctx.db
    .query("squadPlayers")
    .withIndex("by_teamId", (q) => q.eq("teamId", teamId))
    .take(MOST_IN_SQUAD);
}

type LeagueEvent = Infer<typeof leagueEvent>;
type SquadMove = Extract<LeagueEvent, { kind: (typeof SQUAD_MOVES)[number] }>;
export const isSquadMove = (event: LeagueEvent): event is SquadMove => (SQUAD_MOVES as readonly string[]).includes(event.kind);

/** A league's squad moves filed at `at` or after, newest first: what `squadAt` undoes. */
export type SquadMovesSince = Doc<"leagueEvents">[];

/** The league's squad moves filed at `at` or after, newest first. Read once for every team. */
export async function squadMovesSince(ctx: QueryCtx, leagueId: Id<"leagues">, at: number): Promise<SquadMovesSince> {
  const movesOfEachKind = await Promise.all(
    SQUAD_MOVES.map((kind) =>
      takeAllOrThrow(
        ctx.db
          .query("leagueEvents")
          .withIndex("by_leagueId_and_kind_and_at", (q) => q.eq("leagueId", leagueId).eq("event.kind", kind).gte("at", at)),
        SQUAD_MOVES_READ_MOST,
        `League ${leagueId} has more than ${SQUAD_MOVES_READ_MOST} ${kind} moves since ${at}, so its squads then can't be read`,
      ),
    ),
  );
  return movesOfEachKind.flat().toSorted((one, other) => other._creationTime - one._creationTime);
}

/** The team's player codes as its squad stood before `movesSince`: today's squad with each of them
 *  undone, newest first. Those still in it keep the order they joined; those who have left since
 *  follow, in the order they left. A move that doesn't fit the squad it undoes (one who joined but
 *  isn't there, one who left but is) throws: the history is broken. */
export async function squadAt(ctx: QueryCtx, teamId: Id<"teams">, movesSince: SquadMovesSince): Promise<number[]> {
  let stayed = (await squadOf(ctx, teamId)).map(({ playerCode }) => playerCode);
  let leftSince: number[] = [];
  for (const { _id, event } of movesSince) {
    // Only these kinds were read; any other is a bug in the read.
    if (!isSquadMove(event)) throw new Error(`League event ${_id} is a ${event.kind}, not a squad move`);
    const { playerCode } = event;
    const held = stayed.includes(playerCode) || leftSince.includes(playerCode);
    if (event.kind !== "playerReleased" && event.teamId === teamId) {
      if (!held) throw new Error(`League event ${_id} put player ${playerCode} on team ${teamId}, but he isn't in its squad after it`);
      stayed = stayed.filter((code) => code !== playerCode);
      leftSince = leftSince.filter((code) => code !== playerCode);
    }
    const leftHere = event.kind === "playerReleased" ? event.teamId === teamId : event.kind === "playerMoved" && event.fromTeamId === teamId;
    if (leftHere) {
      if (held) throw new Error(`League event ${_id} took player ${playerCode} off team ${teamId}, but he is in its squad after it`);
      leftSince = [playerCode, ...leftSince];
    }
  }
  return [...stayed, ...leftSince];
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
    await ctx.db.patch("squadPlayers", place._id, { teamId });
    await recordEvent(ctx, leagueId, by, {
      kind: "playerMoved",
      playerCode,
      playerName: player.name,
      teamId,
      teamName: team.name,
      fromTeamId: from._id,
      fromTeamName: from.name,
    });
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

const teamSquad = v.object({ teamId: v.id("teams"), teamName: v.string(), players: v.array(squadPlayer), warnings: v.array(squadWarning) });
export type TeamSquad = Infer<typeof teamSquad>;

/** Each team's squad, by name, and the league's squad limits it breaks, which warn but don't block.
 *  Anyone with a part in the league sees them. */
export const squads = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(teamSquad),
  handler: async (ctx, { leagueId }) => {
    await memberOf(ctx, leagueId);
    const rules = await latestRules(ctx, leagueId);
    const how = await howPositionsCount(ctx);
    const shortNames = new Map<number, string>();
    const shortNameOf = async (clubCode: number) => {
      const shortName = shortNames.get(clubCode) ?? (await clubByCode(ctx, clubCode)).shortName;
      shortNames.set(clubCode, shortName);
      return shortName;
    };
    return Promise.all(
      (await teamsOf(ctx, leagueId)).map(async (team) => {
        const squad = await squadOf(ctx, team._id);
        const players = await Promise.all(
          squad.map(async ({ playerCode }) => {
            const player = await heldPlayer(ctx, playerCode);
            return {
              code: player.code,
              name: player.name,
              clubShortName: await shortNameOf(player.clubCode),
              gone: player.droppedAt !== undefined,
            };
          }),
        );
        // Positions are read only for a league with area minimums, the one limit that needs them.
        const playersAreas = rules?.squad.minimumByArea
          ? await Promise.all(squad.map(async ({ playerCode }) => areasOf(await currentPositions(ctx, playerCode, how))))
          : [];
        players.sort((one, other) => one.name.localeCompare(other.name));
        return { teamId: team._id, teamName: team.name, players, warnings: squadWarnings(players, playersAreas, rules?.squad ?? null) };
      }),
    );
  },
});

/** The league's squad limits a squad breaks (spec/03, Squad make-up), given each player's areas
 *  (areaMinimums.ts says how they fill the minimums). */
function squadWarnings(
  players: readonly { clubShortName: string }[],
  playersAreas: readonly (readonly Area[])[],
  squad: LeagueRules["squad"] | null,
): SquadWarning[] {
  if (squad === null) return [];
  const warnings: SquadWarning[] = [];
  const { size, minimumByArea, maxPerClub } = squad;
  if (size !== null && players.length > size.maximum) warnings.push({ kind: "overMaximum", players: players.length, maximum: size.maximum });
  if (size !== null && players.length < size.minimum) warnings.push({ kind: "underMinimum", players: players.length, minimum: size.minimum });
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
    const teamNames = new Map((await teamsOf(ctx, leagueId)).map((team) => [team._id, team.name]));
    return Promise.all(
      found.map(async (player) => {
        const place = await placeOf(ctx, leagueId, player.code);
        return {
          code: player.code,
          name: player.name,
          fullName: player.fullName,
          teamName: place === null ? null : (teamNames.get(place.teamId) ?? null),
        };
      }),
    );
  },
});
