import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { lineupInGameweek } from "../lineup/lineups";
import { byPitchOrder, heldCell } from "../lineup/pitch";
import { waiverRulesShape, type LeagueRules } from "../rules/leagueRulesShape";
import { clubRecord } from "../schema";
import { byKickoff, gameweekFixtures } from "../shared/fixtures";
import { clubsByCode, playerByCode } from "../shared/players";
import { heldOrNot, squadOf } from "../squads/squadPlace";
import { claimsOf } from "../waivers/waiverClaims";

// League home's panels on the reader's own team (#1976; Craig, 13 Nov 2026, on #1976): the deadline
// strip's Your lineup and Claims close, Your squad news, and the Premier League's gameweek with his
// players and his opponent's. Flagged means FPL gives him a news note, shown word for word.

/** A player FPL gives a news note. */
const flaggedPlayer = v.object({
  playerCode: v.number(),
  name: v.string(),
  /** FPL's note, word for word. */
  news: v.string(),
  /** FPL's chance he plays next round, in percent; null while it gives none. */
  chanceOfPlaying: v.union(v.number(), v.null()),
});
export type FlaggedPlayer = Infer<typeof flaggedPlayer>;

const premierLeagueMatch = v.object({
  fixtureCode: v.number(),
  kickoff: v.union(v.number(), v.null()),
  home: clubRecord,
  away: clubRecord,
  /** The reader's squad's players in it, and his opponents' this gameweek. */
  you: v.array(v.string()),
  them: v.array(v.string()),
});

export const yourGameweek = v.object({
  /** His squad's flagged players, in the order they joined it. */
  squadNews: v.array(flaggedPlayer),
  /** His lineup in this gameweek: null with no gameweek; `set` false while he has none saved, else
   *  its flagged starters in the pitch's order. */
  lineup: v.union(v.null(), v.object({ set: v.boolean(), flagged: v.array(flaggedPlayer) })),
  /** The league's waiver run times, which the screen finds the next of at its minute. */
  waiverRuns: waiverRulesShape.fields.runs,
  /** His claims waiting on a run. */
  claims: v.number(),
  /** This gameweek's matches with one of his players or his opponent's, by kickoff; none with no
   *  gameweek. */
  premierLeague: v.array(premierLeagueMatch),
});
export type YourGameweek = Infer<typeof yourGameweek>;

type HeldPlayer = Doc<"players">;
/** This gameweek, and the teams `team` meets in it (a league average or a bye is none). */
export type ThisGameweek = { gameweek: number; opponents: readonly Id<"teams">[] };
const flagged = (player: HeldPlayer): FlaggedPlayer[] =>
  player.news ? [{ playerCode: player.code, name: player.name, news: player.news, chanceOfPlaying: player.chanceOfPlaying ?? null }] : [];

async function heldSquad(ctx: QueryCtx, teamId: Id<"teams">): Promise<HeldPlayer[]> {
  return (await heldOrNot(ctx, await squadOf(ctx, teamId))).held.map(({ player }) => player);
}

/** League home's panels on `team`, in `current`, this gameweek, when there is one. */
export async function yourGameweekOf(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  rules: LeagueRules,
  team: Doc<"teams">,
  current: ThisGameweek | undefined,
): Promise<YourGameweek> {
  const squad = await heldSquad(ctx, team._id);
  return {
    squadNews: squad.flatMap(flagged),
    lineup: current === undefined ? null : await lineupOf(ctx, leagueId, team._id, current.gameweek, squad),
    waiverRuns: rules.waivers.runs,
    claims: (await claimsOf(ctx, leagueId, team._id)).length,
    premierLeague: current === undefined ? [] : await premierLeagueOf(ctx, current, squad),
  };
}

async function lineupOf(ctx: QueryCtx, leagueId: Id<"leagues">, teamId: Id<"teams">, gameweek: number, squad: readonly HeldPlayer[]) {
  const lineup = await lineupInGameweek(ctx, leagueId, teamId, gameweek);
  if (lineup.fromGameweek === null) return { set: false, flagged: [] };
  const byCode = new Map(squad.map((player) => [player.code, player]));
  const starters = lineup.starters.toSorted((one, other) => byPitchOrder(heldCell(one), heldCell(other)));
  // A begun gameweek's lineup is its squad at the deadline, so a starter who has left since still
  // starts and is read on his own; one the football sync doesn't hold has no note to flag.
  const players = await Promise.all(starters.map(({ playerCode }) => byCode.get(playerCode) ?? playerByCode(ctx, playerCode)));
  return { set: true, flagged: players.flatMap((player) => (player === null ? [] : flagged(player))) };
}

async function premierLeagueOf(ctx: QueryCtx, current: ThisGameweek, squad: readonly HeldPlayer[]) {
  const theirs = (await Promise.all(current.opponents.map((opponent) => heldSquad(ctx, opponent)))).flat();
  const clubs = clubsByCode(ctx);
  const playing = (players: readonly HeldPlayer[], fixture: Doc<"fixtures">) =>
    players.filter(({ clubCode }) => clubCode === fixture.homeClubCode || clubCode === fixture.awayClubCode).map(({ name }) => name);
  const matches = byKickoff(await gameweekFixtures(ctx, current.gameweek, "league home's Premier League panel would be cut short"));
  const shown = matches.map((fixture) => ({ fixture, you: playing(squad, fixture), them: playing(theirs, fixture) })).filter(({ you, them }) => you.length > 0 || them.length > 0);
  return Promise.all(
    shown.map(async ({ fixture, you, them }) => ({
      fixtureCode: fixture.code,
      kickoff: fixture.kickoff,
      home: await clubs(fixture.homeClubCode),
      away: await clubs(fixture.awayClubCode),
      you,
      them,
    })),
  );
}
