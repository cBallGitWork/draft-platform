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
import { memberOf } from "../shared/leagueAccess";
import { clubsByCode, playerByCode, type Clubs } from "../shared/players";
import { ownerNameOf, placeOf } from "../squads/squadPlaces";
import { isWhole, MINUTES_STAT, statValue } from "../stats/matchRecords";
import { currentFixturesByCode, overridesOf, seasonRecords } from "../stats/seasonRecords";
import { cardPoints, scoredAs } from "./cardPoints";
import { startersByGameweek } from "../lineup/lineups";
import { roleName } from "../lineup/roles";

// A player's card (spec/12, The player card; #381), for anyone in the league: who he is and who
// owns him here, FPL's news on him, this season's matches priced under the site's scoring, and his
// club's next fixtures. A match his team started him in is priced at the slot and role he started
// in, any other at his best position (cardPoints.ts); last season's matches aren't held, so the
// card has no totals for it yet.

/** How many of his club's next matches the card shows: "the next few" (spec/12). Claude's choice,
 *  not yet Craig's. */
export const NEXT_FIXTURES_SHOWN = 5;

// `v.union` takes two or more members, which a mapped array cannot promise its type (as convex/tables/positions.ts's `position`).
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
    scoredAs,
    position: v.union(slotPosition, v.null()),
    total: v.union(v.number(), v.null()),
    /** Each of the set's categories, by full name, in its order. */
    categories: v.array(v.object({ stat: v.string(), name: v.string(), points: v.union(v.number(), v.null()) })),
    /** His role's adjustment, when his team started him and the set adjusts that role (spec/05:
     *  "Attacking full-back: +2, two key passes"): its name, its points, each stat he made. */
    role: v.optional(
      v.object({
        name: v.string(),
        points: v.number(),
        lines: v.array(v.object({ stat: v.string(), name: v.string(), actions: v.number(), points: v.number() })),
      }),
    ),
  }),
  /** The league's override of his points in the match (#32), or null with none. */
  override: v.union(v.object({ points: v.number(), reason: v.string() }), v.null()),
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
    const place = await placeOf(ctx, leagueId, playerCode);
    return {
      code: player.code,
      name: player.name,
      fullName: player.fullName,
      club: await clubs(player.clubCode),
      gone: player.droppedAt !== undefined,
      positions,
      ownerTeamName: await ownerNameOf(ctx, place),
      news: player.news || null,
      chanceOfPlaying: player.chanceOfPlaying ?? null,
      matches: await seasonMatches(ctx, leagueId, player, place, positions, clubs),
      nextFixtures: await nextFixtures(ctx, player.clubCode, now, clubs),
    };
  },
});

const asMatch = async (fixture: Doc<"fixtures">, clubs: Clubs) => ({
  fixtureCode: fixture.code,
  gameweek: fixture.gameweek,
  kickoff: fixture.kickoff,
  home: await clubs(fixture.homeClubCode),
  away: await clubs(fixture.awayClubCode),
});

/** This season's matches he was in (seasonRecords), each priced under the site's set with the
 *  league's override of his points there, if any, newest first. */
async function seasonMatches(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  player: Doc<"players">,
  place: Doc<"squadPlayers"> | null,
  positions: readonly Position[],
  clubs: Clubs,
): Promise<PlayedMatch[]> {
  const setIn = await siteScoringByGameweek(ctx);
  const overrides = await overridesOf(ctx, leagueId, player.code);
  // His team's lineups, for the slot and role he started in: priced as the Squad tab prices him.
  const starters = place === null ? null : startersByGameweek(ctx, leagueId, place.teamId);
  const played = await Promise.all(
    (await seasonRecords(ctx, player.code, await currentFixturesByCode(ctx))).map(async ({ record, fixture, gameweek }) => {
      const set = setIn(gameweek);
      const slot = starters === null ? null : ((await starters(gameweek)).get(player.code) ?? null);
      const { role, ...points } = cardPoints(isWhole(record) ? record.stats : null, set, positions, slot);
      const categories = points.categories.map((each) => ({ ...each, name: categoryName(each.stat, set.ownStats) }));
      const named = (stat: string) => categoryName(stat, set.ownStats);
      const roleLine =
        role === undefined
          ? {}
          : { role: { name: roleName(role.role), points: role.points, lines: role.lines.map((line) => ({ ...line, name: named(line.stat) })) } };
      const override = overrides.get(fixture.code);
      return {
        ...(await asMatch(fixture, clubs)),
        minutes: statValue(record, MINUTES_STAT),
        points: { ...points, categories, ...roleLine },
        override: override === undefined ? null : { points: override.points, reason: override.reason },
      };
    }),
  );
  return played.sort((one, other) => (other.kickoff ?? 0) - (one.kickoff ?? 0));
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
