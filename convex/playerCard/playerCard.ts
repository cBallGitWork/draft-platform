import { v, type Infer, type VLiteral } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { SLOT_POSITIONS, type SlotPosition } from "../lineup/pitch";
import type { Position } from "../positions/positionTables";
import { currentPositions } from "../positions/playerPositions";
import { howPositionsCount } from "../positions/positionSettings";
import { clubRecord, position } from "../schema";
import { categoryName } from "../scoring/categories";
import { siteScoringByGameweek } from "../scoring/siteScoring";
import { takeAllOrThrow } from "../shared/cappedRead";
import { memberOf } from "../shared/leagueAccess";
import { clubByCode, playerByCode } from "../shared/players";
import { isWhole, MINUTES_STAT, statValue } from "../stats/matchRecords";
import { cardPoints } from "./cardPoints";

// A player's card (spec/12, The player card; #381), for anyone in the league: who he is and who
// owns him here, FPL's news on him, this season's matches priced under the site's scoring, and his
// club's next fixtures. No lineup is kept until #29, so every match is priced at his best position
// (cardPoints.ts); last season's matches aren't held, so the card has no totals for it yet.

/** How many of his club's next matches the card shows: "the next few" (spec/12). Claude's choice,
 *  not yet Craig's. */
export const NEXT_FIXTURES_SHOWN = 5;

/** The most match records one player's read takes: a season's 38 and the cups' none, kept season
 *  on season, so ten seasons with room. More throws, never a silent cut. */
export const PLAYER_RECORDS_MOST = 500;

// `v.union` takes two or more members, which a mapped array cannot promise its type (as schema.ts's `position`).
const slotLiterals = SLOT_POSITIONS.map((each) => v.literal(each));
const slotPosition = v.union(...(slotLiterals as [VLiteral<SlotPosition>, VLiteral<SlotPosition>, ...VLiteral<SlotPosition>[]]));

const match = v.object({
  fixtureCode: v.number(),
  gameweek: v.union(v.number(), v.null()),
  kickoff: v.union(v.number(), v.null()),
  home: clubRecord,
  away: clubRecord,
});

const playedMatch = v.object({
  ...match.fields,
  /** Null while his whole record hasn't arrived. */
  minutes: v.union(v.number(), v.null()),
  points: v.object({
    scoredAs: v.union(v.literal("slot"), v.literal("bestPosition")),
    position: v.union(slotPosition, v.null()),
    total: v.union(v.number(), v.null()),
    /** Each of the set's categories, by full name, in its order. */
    categories: v.array(v.object({ stat: v.string(), name: v.string(), points: v.union(v.number(), v.null()) })),
  }),
});
export type PlayedMatch = Infer<typeof playedMatch>;

const playerCard = v.object({
  code: v.number(),
  name: v.string(),
  fullName: v.string(),
  club: clubRecord,
  /** The feed no longer sends him: he has left the Premier League. */
  gone: v.boolean(),
  positions: v.array(position),
  /** The team in this league that owns him, or null for a free agent. */
  ownerTeamName: v.union(v.string(), v.null()),
  /** FPL's news on him, or null with none. */
  news: v.union(v.string(), v.null()),
  /** FPL's chance he plays in the next round, in percent; null while it has no doubt about him. */
  chanceOfPlaying: v.union(v.number(), v.null()),
  /** This season's matches he was in, newest first. */
  matches: v.array(playedMatch),
  /** His club's next matches, soonest first, at most NEXT_FIXTURES_SHOWN. */
  nextFixtures: v.array(match),
});
export type PlayerCard = Infer<typeof playerCard>;

/** His card as it stands at `now`, the screen's minute (a query may not read the clock), or null
 *  while the football sync holds no player with his code. Anyone not in the league is refused. */
export const card = query({
  args: { leagueId: v.id("leagues"), playerCode: v.number(), now: v.number() },
  returns: v.union(playerCard, v.null()),
  handler: async (ctx, { leagueId, playerCode, now }) => {
    await memberOf(ctx, leagueId);
    const player = await playerByCode(ctx, playerCode);
    if (player === null) return null;
    const positions = await currentPositions(ctx, playerCode, await howPositionsCount(ctx));
    const clubs = clubsByCode(ctx);
    return {
      code: player.code,
      name: player.name,
      fullName: player.fullName,
      club: await clubs(player.clubCode),
      gone: player.droppedAt !== undefined,
      positions,
      ownerTeamName: await ownerIn(ctx, leagueId, playerCode),
      news: player.news ? player.news : null,
      chanceOfPlaying: player.chanceOfPlaying ?? null,
      matches: await seasonMatches(ctx, player, positions, clubs),
      nextFixtures: await nextFixtures(ctx, player.clubCode, now, clubs),
    };
  },
});

type Club = Infer<typeof clubRecord>;
type Clubs = (code: number) => Promise<Club>;

/** Clubs by code, each read once. */
function clubsByCode(ctx: QueryCtx): Clubs {
  const read = new Map<number, Promise<Club>>();
  return (code) => {
    if (!read.has(code)) read.set(code, clubByCode(ctx, code).then(({ code, name, shortName }) => ({ code, name, shortName })));
    return read.get(code)!;
  };
}

async function ownerIn(ctx: QueryCtx, leagueId: Id<"leagues">, playerCode: number): Promise<string | null> {
  const owned = await ctx.db
    .query("squadPlayers")
    .withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("playerCode", playerCode))
    .unique();
  return owned === null ? null : (await ctx.db.get("teams", owned.teamId))!.name;
}

const asMatch = async (fixture: Doc<"fixtures">, clubs: Clubs) => ({
  fixtureCode: fixture.code,
  gameweek: fixture.gameweek,
  kickoff: fixture.kickoff,
  home: await clubs(fixture.homeClubCode),
  away: await clubs(fixture.awayClubCode),
});

/** This season's matches he was in, for whichever club, newest first: a match the feed still
 *  sends is this season's. An unused substitute's match is left out, as one he wasn't named for is. */
async function seasonMatches(ctx: QueryCtx, player: Doc<"players">, positions: readonly Position[], clubs: Clubs): Promise<PlayedMatch[]> {
  const records = await takeAllOrThrow(
    ctx.db.query("playerMatchStats").withIndex("by_playerCode", (q) => q.eq("playerCode", player.code)),
    PLAYER_RECORDS_MOST,
    `More than ${PLAYER_RECORDS_MOST} match records are held for player ${player.code}, so his card would be cut short`,
  );
  const setIn = await siteScoringByGameweek(ctx);
  const played = await Promise.all(
    records
      .filter((record) => record.played !== false)
      .map(async (record) => {
        const fixture = await ctx.db
          .query("fixtures")
          .withIndex("by_code", (q) => q.eq("code", record.fixtureCode))
          .unique();
        if (fixture === null || fixture.droppedAt !== undefined || fixture.gameweek === null) return [];
        const set = setIn(fixture.gameweek);
        // No lineup is kept until #29, so nobody stands in a slot yet.
        const points = cardPoints(isWhole(record) ? record.stats : null, set, positions, null);
        const categories = points.categories.map((each) => ({ ...each, name: categoryName(each.stat, set.ownStats) }));
        return [{ ...(await asMatch(fixture, clubs)), minutes: statValue(record, MINUTES_STAT), points: { ...points, categories } }];
      }),
  );
  return played.flat().sort((one, other) => (other.kickoff ?? 0) - (one.kickoff ?? 0));
}

/** His club's next matches after `now`, soonest first. A match with no kickoff time is left out. */
async function nextFixtures(ctx: QueryCtx, clubCode: number, now: number, clubs: Clubs) {
  const next = [];
  const ahead = ctx.db.query("fixtures").withIndex("by_droppedAt_and_kickoff", (q) => q.eq("droppedAt", undefined).gt("kickoff", now));
  for await (const fixture of ahead) {
    if (fixture.homeClubCode !== clubCode && fixture.awayClubCode !== clubCode) continue;
    next.push(await asMatch(fixture, clubs));
    if (next.length === NEXT_FIXTURES_SHOWN) break;
  }
  return next;
}
