import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { SLOT_POSITIONS } from "../lineup/pitch";
import { areaShape } from "../lineup/pitchShape";
import { roleName } from "../lineup/roles";
import { positionsNow } from "../positions/playerPositions";
import type { Position } from "../positions/positionTables";
import { clubRecord, position } from "../schema";
import { categoryName } from "../scoring/categories";
import { bandShape } from "../scoring/scoringSetShape";
import { siteVersionByGameweek } from "../scoring/siteVersions";
import { memberOf } from "../shared/leagueAccess";
import { clubsByCode, playerByCode, type Clubs } from "../shared/players";
import { ownerOf, placeOf } from "../squads/squadPlace";
import { isWhole, MINUTES_STAT, statValue } from "../stats/matchRecords";
import { playsIn } from "../gameweekScorer/heldMatches";
import { scoredMatches } from "../gameweekScorer/scoredMatches";
import { basePoints, cardPositions } from "./cardPoints";

// A player's card (spec/12, The player card; #381), for anyone in the league: who he is and who
// owns him here, FPL's news on him, this season's matches at his base points, at each position he
// has (Craig, 31 Oct 2026), with his role's line where his team started him (scoredMatches.ts), and
// his club's next fixtures. Last season's matches aren't held, so the card has no totals for it
// yet.

/** How many of his club's next matches the card shows: "the next few" (spec/12). Claude's choice,
 *  not yet Craig's. */
export const NEXT_FIXTURES_SHOWN = 5;

const slotPosition = v.union(...SLOT_POSITIONS.map((each) => v.literal(each)));

const match = v.object({
  fixtureCode: v.number(),
  gameweek: v.union(v.number(), v.null()),
  kickoff: v.union(v.number(), v.null()),
  home: clubRecord,
  away: clubRecord,
});

/** scoring.ts's CategoryWhy: what a category's points are made of (spec/14, On screen). */
const categoryWhy = v.object({
  actions: v.number(),
  value: v.union(
    v.object({ shape: v.literal("perAction"), points: v.number() }),
    v.object({ shape: v.literal("perCount"), every: v.number(), points: v.number() }),
    v.object({ shape: v.literal("bands"), earned: v.array(bandShape) }),
  ),
  pricedBy: v.union(
    v.object({ by: v.literal("all") }),
    v.object({ by: v.literal("area"), area: areaShape }),
    v.object({ by: v.literal("position"), position: slotPosition }),
  ),
  cut: v.union(
    v.null(),
    v.object({ by: v.literal("minutes"), atLeast: v.number() }),
    v.object({ by: v.union(v.literal("max"), v.literal("min")), limit: v.number() }),
  ),
});

/** His base points in a match at one position: the site's scoring set for what he did, with no
 *  role (SPEC.md, base points). */
const pricedPoints = v.object({
  /** The slot's position he is priced at; null while it can't be known: his record hasn't arrived
   *  and no position of his has a price, or he has no position yet. */
  position: v.union(slotPosition, v.null()),
  /** Null while his whole record hasn't arrived. */
  total: v.union(v.number(), v.null()),
  /** Each of the set's categories, by full name, in its order: its points and why, or null points
   *  while his whole record hasn't arrived. */
  categories: v.array(
    v.union(
      v.object({ stat: v.string(), name: v.string(), points: v.null() }),
      v.object({ stat: v.string(), name: v.string(), points: v.number(), why: categoryWhy }),
    ),
  ),
});

const playedMatch = v.object({
  ...match.fields,
  /** Null while his whole record hasn't arrived. */
  minutes: v.union(v.number(), v.null()),
  /** His base points at each of the card's positions, in its order; one at his best position when
   *  none of his positions has a price (spec/14: SS has none yet). */
  points: v.array(pricedPoints),
  /** The version of the site's scoring set his points were scored under (26_27.1), null for the
   *  first set (spec/14, On screen). */
  version: v.union(v.string(), v.null()),
  /** His role's adjustment, when his team started him and the set adjusts that role (spec/05:
   *  "Attacking full-back: +2, two key passes"): its name, its points, each stat he made. Shown
   *  beside his base points, never in them. */
  role: v.optional(
    v.object({
      name: v.string(),
      points: v.number(),
      lines: v.array(v.object({ stat: v.string(), name: v.string(), actions: v.number(), points: v.number() })),
    }),
  ),
  /** The league's override of his points in the match (#32), or null with none. */
  override: v.union(v.object({ points: v.number(), reason: v.string() }), v.null()),
  /** His points may still move: the match isn't final, or, from his team's lineup, auto-subs aren't. */
  provisional: v.boolean(),
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
  /** The positions the card's switch prices him at, back to front: each match's points, in this
   *  order. Fewer than two, and the card shows no switch. */
  pricedAt: v.array(slotPosition),
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
    const { league } = await memberOf(ctx, leagueId);
    const player = await playerByCode(ctx, playerCode);
    if (player === null) return null;
    const positions = await (await positionsNow(ctx))(playerCode);
    const clubs = clubsByCode(ctx);
    return {
      code: player.code,
      name: player.name,
      fullName: player.fullName,
      club: await clubs(player.clubCode),
      gone: player.droppedAt !== undefined,
      positions,
      pricedAt: cardPositions(positions),
      ownerTeamName: (await (await ownerOf(ctx, leagueId))(playerCode))?.name ?? null,
      news: player.news || null,
      chanceOfPlaying: player.chanceOfPlaying ?? null,
      matches: await seasonMatches(ctx, league, player, positions, clubs),
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

/** This season's matches he was in, newest first, each at his base points at every position the
 *  card prices, by category. His role's line, the league's override and whether his points may
 *  still move come from his team's scoring (scoredMatches.ts); the points his team got are the
 *  Squad tab's, not the card's. */
async function seasonMatches(ctx: QueryCtx, league: Doc<"leagues">, player: Doc<"players">, positions: readonly Position[], clubs: Clubs): Promise<PlayedMatch[]> {
  const owner = await placeOf(ctx, league._id, player.code);
  const { of } = await scoredMatches(ctx, league, owner?.teamId ?? null);
  // Read beside scoredMatches' own, for the version's name: the same versions, so the same set.
  const versionIn = await siteVersionByGameweek(ctx);
  const scored = await of({ code: player.code, positions });
  const played = await Promise.all(
    scored.map(async ({ record, fixture, gameweek, points: { role }, override, provisional }) => {
      const { set, name: version } = versionIn(gameweek);
      const named = (stat: string) => categoryName(stat, set.ownStats);
      const points = basePoints(isWhole(record) ? record.stats : null, set, positions).map(({ position, total, categories }) => ({
        position,
        total,
        categories: categories.map((each) => ({ ...each, name: named(each.stat) })),
      }));
      const roleLine =
        role === undefined
          ? {}
          : { role: { name: roleName(role.role), points: role.points, lines: role.lines.map((line) => ({ ...line, name: named(line.stat) })) } };
      return {
        ...(await asMatch(fixture, clubs)),
        minutes: statValue(record, MINUTES_STAT),
        points,
        version,
        ...roleLine,
        override: override === null ? null : { points: override.points, reason: override.reason },
        provisional,
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
    if (!playsIn(fixture, clubCode)) continue;
    next.push(await asMatch(fixture, clubs));
    if (next.length === NEXT_FIXTURES_SHOWN) break;
  }
  return next;
}
