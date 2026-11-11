import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { heldSchedule, type HeldSchedule } from "../gameweeks/leagueDeadlines";
import { saveGameweekOf } from "../lineup/lineups";
import { adminByline } from "../mail/letterWords";
import { fileLetter } from "../mail/letters";
import { everyLeague, scheduleEveryLeague } from "../shared/cappedRead";
import { teamsOf } from "../shared/leagueAccess";
import { playerByCode, unheldPlayerWords } from "../shared/players";
import { placeOf, squadOf } from "../squads/squadPlace";
import { workedOutNow } from "./playerPositions";
import { howPositionsCount, type HowPositionsCount } from "./positionSettings";
import type { Position } from "./positionTables";
import { position as positionArg } from "../schema";

// Warning a manager when one of his players is losing a position (#23; spec/06, When positions
// change: "the manager is warned first, then the position goes"). Craig's answers on #23 (5 Nov
// 2026): a Mail letter to whoever owns him in each league at each step, flagged then lost, both
// naming the position and the gameweek it counts from; the admin taking one away by hand sends the
// same letter. Losing one never moves him: he stays where he stands until his manager moves him.
// Positions are worked out on every read, so `positionWarnings` keeps which steps each team was
// told, to tell each once.

/** One of a manager's players' positions changing: flagged by a run of starts elsewhere, lost to
 *  a longer one, or taken away by the admin. */
export type PositionNews = {
  playerName: string;
  position: Position;
  /** The gameweek it counts from: the next his manager can set a lineup for. */
  fromGameweek: number;
} & ({ step: "flagged"; startsElsewhere: number; removeAfter: number } | { step: "lost"; removeAfter: number } | { step: "takenByAdmin" });

const staysPut = "He stays where he stands in your lineup until you move him, and the lineup check shows him out of position.";

/** The letter warning a manager of `news`, in one place for Craig to change. */
export function positionLetter(news: PositionNews): { subject: string; body: string } {
  const { playerName, position, fromGameweek } = news;
  switch (news.step) {
    case "flagged":
      return {
        subject: `${playerName} may lose ${position}`,
        body:
          `From gameweek ${fromGameweek}, ${playerName} is flagged at ${position}: his last ${news.startsElsewhere} starts in a row ` +
          `were elsewhere. After ${news.removeAfter} in a row he loses ${position}; a start there keeps it.`,
      };
    case "lost":
      return {
        subject: `${playerName} has lost ${position}`,
        body: `From gameweek ${fromGameweek}, ${playerName} no longer plays ${position}: he has started ${news.removeAfter} matches in a row elsewhere. ${staysPut}`,
      };
    case "takenByAdmin":
      return {
        subject: `${playerName} has lost ${position}`,
        body: `${adminByline} took ${position} away from ${playerName}, from gameweek ${fromGameweek}. ${staysPut}`,
      };
  }
}

type Step = Doc<"positionWarnings">["step"];
/** A step a run of starts elsewhere has taken one of a player's positions to. */
type PositionChange = { position: Position; step: "flagged"; startsElsewhere: number } | { position: Position; step: "lost" };

/** Why a read of every league that stops short matters here. */
const UNWARNED = "so some managers would go unwarned of a position change";

/** Warns every league's managers of what has changed in their players' positions since they were
 *  last told: after a positions sync, and after the admin changes how positions count. Each league
 *  is warned in its own mutation, run once the caller's has saved (#1545): no one step reads every
 *  squad in every league, and a league whose warning throws leaves the caller's own writes, the
 *  sync's log row among them, and every other league's warning standing. */
export async function warnEveryLeague(ctx: MutationCtx): Promise<void> {
  await scheduleEveryLeague(ctx, internal.positions.positionWarnings.warnLeagueSoon, UNWARNED);
}

// The admin's mutations in playerPositions.ts and positionSettings.ts run these two through
// `internal`, never by import: this file reads both, so importing it back would be a cycle.

/** `warnEveryLeague`, for the admin's mutations to run inside their own. */
export const warnEveryLeagueSoon = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await warnEveryLeague(ctx);
    return null;
  },
});

/** One league's warnings, as `warnEveryLeague` schedules them; a league gone since tells nothing. */
export const warnLeagueSoon = internalMutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const league = await ctx.db.get("leagues", leagueId);
    if (league !== null) await warnLeague(ctx, league);
    return null;
  },
});

/** `warnOfAdminRemoval`, for `removePosition` to run before it saves the removal. */
export const warnOfAdminRemovalNow = internalMutation({
  args: { code: v.number(), position: positionArg },
  returns: v.null(),
  handler: async (ctx, { code, position }) => {
    await warnOfAdminRemoval(ctx, code, position);
    return null;
  },
});

/** Each team's players flagged or lost at a position, as the league's own deadlines judge them,
 *  and not yet told to his manager, are told now (those standing as he joined were kept as told
 *  then: `knownOnJoining`); a step that no longer stands, or a player gone from the team, is forgotten, so it is told again if it comes back. A league with no gameweek
 *  left to set a lineup for tells nothing. */
async function warnLeague(ctx: MutationCtx, league: Doc<"leagues">): Promise<void> {
  const schedule = await heldSchedule(ctx);
  const next = await saveGameweekOf(ctx, league._id, Date.now(), schedule);
  if (next.kind !== "open") return;
  const how = await howPositionsCount(ctx, league._id, schedule.matches);
  for (const team of await teamsOf(ctx, league._id)) {
    const told = await toldTo(ctx, team._id);
    const standing = new Set<string>();
    for (const { playerCode } of await squadOf(ctx, team._id)) {
      for (const change of await changesOf(ctx, playerCode, how)) {
        const { position, step } = change;
        standing.add(key(playerCode, position, step));
        if (isTold(told, playerCode, position, step)) continue;
        // Kept only once a letter goes out, so a manager who arrives later is still told.
        if (team.managerEmail === undefined) continue;
        await ctx.db.insert("positionWarnings", { teamId: team._id, playerCode, position, step });
        const news = { playerName: await nameOf(ctx, playerCode), fromGameweek: next.gameweek, removeAfter: how.thresholds.removeAfter };
        await fileLetter(ctx, league, [team.managerEmail], positionLetter({ ...news, ...change }));
      }
    }
    for (const each of told) {
      if (!standing.has(key(each.playerCode, each.position, each.step))) await ctx.db.delete("positionWarnings", each._id);
    }
  }
}

/** The steps a run of starts elsewhere has taken his positions to, as `how` judges them. */
async function changesOf(ctx: QueryCtx, playerCode: number, how: HowPositionsCount): Promise<PositionChange[]> {
  const worked = await workedOutNow(ctx, playerCode, how);
  return [
    ...worked.positions.flatMap(({ position, flaggedElsewhere }) =>
      flaggedElsewhere === null ? [] : [{ position, step: "flagged" as const, startsElsewhere: flaggedElsewhere }],
    ),
    ...worked.removed.map((position) => ({ position, step: "lost" as const })),
  ];
}

/** A player joining `teamId` (drafted, assigned, moved, picked up, claimed or traded): the steps
 *  his positions already stand at are kept as told to it, with no letter (Craig, 11 Nov 2026, on
 *  #1615: a position flagged or lost before he joined is known, and his card still shows it). A
 *  step that comes after is told as ever. */
export async function knownOnJoining(ctx: MutationCtx, leagueId: Id<"leagues">, teamId: Id<"teams">, playerCode: number): Promise<void> {
  const told = await toldTo(ctx, teamId);
  for (const { position, step } of await changesOf(ctx, playerCode, await howPositionsCount(ctx, leagueId))) {
    if (!isTold(told, playerCode, position, step)) await ctx.db.insert("positionWarnings", { teamId, playerCode, position, step });
  }
}

/** Tells whoever owns him in each league that the admin took `position` away (Craig, 5 Nov 2026,
 *  on #23: the same letter, and he keeps his slot that gameweek): only where he held it, as the
 *  league's own deadlines judge it. Call before the removal is saved. */
export async function warnOfAdminRemoval(ctx: MutationCtx, playerCode: number, position: Position): Promise<void> {
  // Read once, and only once a league has him: most leagues don't.
  let schedule: HeldSchedule | undefined;
  for (const league of await everyLeague(ctx, UNWARNED)) {
    const place = await placeOf(ctx, league._id, playerCode);
    if (place === null) continue;
    const team = await ctx.db.get("teams", place.teamId);
    if (team?.managerEmail === undefined) continue;
    schedule ??= await heldSchedule(ctx);
    const held = (await workedOutNow(ctx, playerCode, await howPositionsCount(ctx, league._id, schedule.matches))).positions;
    if (!held.some((each) => each.position === position)) continue;
    const next = await saveGameweekOf(ctx, league._id, Date.now(), schedule);
    if (next.kind !== "open") continue;
    const letter = positionLetter({ step: "takenByAdmin", playerName: await nameOf(ctx, playerCode), position, fromGameweek: next.gameweek });
    await fileLetter(ctx, league, [team.managerEmail], letter);
  }
}

/** Two steps for each position a player holds, for a squad at its largest: well above any team's. */
const MOST_WARNINGS_A_TEAM = 1000;

const key = (playerCode: number, position: Position, step: Step) => `${playerCode} ${position} ${step}`;

/** The steps the team has been told of. */
function toldTo(ctx: QueryCtx, teamId: Id<"teams">): Promise<Doc<"positionWarnings">[]> {
  return ctx.db
    .query("positionWarnings")
    .withIndex("by_teamId", (q) => q.eq("teamId", teamId))
    .take(MOST_WARNINGS_A_TEAM);
}

const isTold = (told: Doc<"positionWarnings">[], playerCode: number, position: Position, step: Step) =>
  told.some((each) => key(each.playerCode, each.position, each.step) === key(playerCode, position, step));

async function nameOf(ctx: MutationCtx, playerCode: number): Promise<string> {
  return (await playerByCode(ctx, playerCode))?.name ?? unheldPlayerWords(playerCode);
}
