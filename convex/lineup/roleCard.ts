import { v, type Infer } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import { lastSeasonCopied, pastRowsOf } from "../pastSeasons/pastSeasonPoints";
import { clubRecord } from "../schema";
import { roleLine, roleLineOf } from "../scoring/breakdownShape";
import { categoryName } from "../scoring/categories";
import { scoreMatch } from "../scoring/scoring";
import type { ScoringSet } from "../scoring/scoringSet";
import { siteScoringAt, siteScoringByGameweek } from "../scoring/siteVersions";
import { managerOf } from "../shared/leagueAccess";
import { clubsByCode, playerByCode, type Club } from "../shared/players";
import { isWhole, MINUTES_STAT, statValue } from "../stats/matchRecords";
import { seasonRecords } from "../stats/seasonRecords";
import type { Cell } from "./pitch";
import { cellShape } from "./pitchShape";
import { rolesOfSlot, type Formation } from "./roles";

// A player's role card for a slot (spec/05 Roles; #848): every role the slot offers in the
// formation, each with its description, what it scores more and less for, and what he would have
// scored under it in his last ROLE_CARD_MATCHES matches played, against his base points. Craig, 6
// Nov 2026, on #848: his last 5 matches played, cameos included, at any Premier League club, with
// last season's filling in once recorded; the role alone, never the team's instructions. Every
// match is priced at the card's slot, under the site's set its gameweek was scored under; last
// season's under the set in force now, as his card prices them (playerCard.ts).

/** How many of his newest matches played the card prices (Craig, 6 Nov 2026: "Last 5 played"). */
export const ROLE_CARD_MATCHES = 5;

/** One role the slot offers, as the card lists it. */
const cardRole = v.object({
  key: v.string(),
  name: v.string(),
  description: v.string(),
  /** The stats its bonus adds up, and the bad action its cost counts, as the site's set names them
   *  (spec/05: "Each role says what it rewards and what it costs"); the role's own words while the
   *  set scores no such role. */
  rewards: v.array(v.string()),
  punishes: v.array(v.string()),
});

/** One of his matches priced under each role. */
const cardMatch = v.object({
  /** This season's gameweek, or null for one of last season's. */
  gameweek: v.union(v.number(), v.null()),
  /** The season by the year it starts, for one of last season's; null for this season's. */
  pastSeason: v.union(v.number(), v.null()),
  /** Who he played and whether at home; null for last season's, whose copy holds neither. */
  opponent: v.union(v.object({ club: clubRecord, home: v.boolean() }), v.null()),
  minutes: v.number(),
  /** His base points at the slot: what he did, with no role (SPEC.md, base points). */
  base: v.number(),
  /** Under each role, in the card's order: what the role adds, his total, and the role's line
   *  (spec/05 `S05.2`), null when it moved him nothing. */
  roles: v.array(v.object({ role: v.string(), points: v.number(), total: v.number(), line: v.union(roleLine, v.null()) })),
});

const roleCardShape = v.object({
  roles: v.array(cardRole),
  /** Newest first, at most ROLE_CARD_MATCHES: none says "No matches yet". */
  matches: v.array(cardMatch),
});
export type RoleCard = Infer<typeof roleCardShape>;
export type CardMatch = Infer<typeof cardMatch>;

/** A match to price: what he did, with what the card shows of it. */
export interface MatchToPrice {
  stats: Record<string, number>;
  set: ScoringSet;
  gameweek: number | null;
  pastSeason: number | null;
  opponent: { club: Club; home: boolean } | null;
}

/** The slot's roles as the card lists them, what each rewards and punishes read from `set`. */
export function cardRolesOf(cell: Cell, formation: Formation, set: ScoringSet): RoleCard["roles"] {
  return rolesOfSlot(cell, formation).map(({ key, name, description, rewards, costs }) => {
    const scored = set.roles?.find((each) => each.role === key);
    const named = (parts: readonly { stat: string }[]) => parts.map(({ stat }) => categoryName(stat, set.ownStats));
    return {
      key,
      name,
      description,
      rewards: scored === undefined ? [...rewards] : named(scored.bonus.parts),
      punishes: scored === undefined ? [...costs] : named(scored.cost.parts),
    };
  });
}

/** One match priced at `cell` with no role and under each of `roles`: the totals scoreMatch gives. */
export function pricedMatch(match: MatchToPrice, cell: Cell, roles: readonly string[]): CardMatch {
  const base = scoreMatch(match.stats, match.set, cell).total!;
  return {
    gameweek: match.gameweek,
    pastSeason: match.pastSeason,
    opponent: match.opponent,
    minutes: match.stats[MINUTES_STAT] ?? 0,
    base,
    roles: roles.map((role) => {
      const scored = scoreMatch(match.stats, match.set, cell, role);
      const points = scored.role?.points ?? 0;
      return { role, points, total: scored.total!, line: scored.role === undefined || scored.role.sides.length === 0 ? null : roleLineOf(scored.role, match.set.ownStats) };
    }),
  };
}

/** The card for `playerCode` in `cell` of `formation` (the eleven's cells), as it stands at `now`
 *  (the screen's minute: a query may not read the clock). Refused for anyone who runs no team in
 *  the league. */
export const forSlot = query({
  args: { leagueId: v.id("leagues"), playerCode: v.number(), cell: cellShape, formation: v.array(cellShape), now: v.number() },
  returns: roleCardShape,
  handler: async (ctx, { leagueId, playerCode, cell, formation, now }) => {
    await managerOf(ctx, leagueId);
    const roles = cardRolesOf(cell, formation, await siteScoringAt(ctx, now));
    const matches = await lastMatchesPlayed(ctx, playerCode, now);
    return { roles, matches: matches.map((match) => pricedMatch(match, cell, roles.map(({ key }) => key))) };
  },
});

/** His newest ROLE_CARD_MATCHES matches played, cameos included, newest first: this season's
 *  final ones (locked or complete, his whole record in), at whichever club, then last season's
 *  copied matches to fill. */
async function lastMatchesPlayed(ctx: QueryCtx, playerCode: number, now: number): Promise<MatchToPrice[]> {
  const setIn = await siteScoringByGameweek(ctx);
  const clubs = clubsByCode(ctx);
  const currentClub = (await playerByCode(ctx, playerCode))?.clubCode ?? null;
  const played = (await seasonRecords(ctx, playerCode))
    .filter(({ record }) => record.state !== "provisional" && isWhole(record) && (statValue(record, MINUTES_STAT) ?? 0) > 0)
    .toSorted((one, other) => (other.fixture.kickoff ?? 0) - (one.fixture.kickoff ?? 0))
    .slice(0, ROLE_CARD_MATCHES);
  const matches: MatchToPrice[] = [];
  for (const { record, fixture, gameweek } of played) {
    const clubCode = record.clubCode ?? currentClub;
    const home = clubCode === fixture.homeClubCode;
    const opponent = clubCode === null ? null : { club: await clubs(home ? fixture.awayClubCode : fixture.homeClubCode), home };
    matches.push({ stats: record.stats, set: setIn(gameweek), gameweek, pastSeason: null, opponent });
  }
  if (matches.length === ROLE_CARD_MATCHES) return matches;
  const season = await lastSeasonCopied(ctx);
  if (season === null) return matches;
  const set = await siteScoringAt(ctx, now);
  const past = (await pastRowsOf(ctx, season, playerCode))
    .flatMap(({ match }) => (match !== null && (match.stats[MINUTES_STAT] ?? 0) > 0 ? [match] : []))
    .toSorted((one, other) => other.kickoff - one.kickoff)
    .slice(0, ROLE_CARD_MATCHES - matches.length);
  return [...matches, ...past.map(({ stats }) => ({ stats, set, gameweek: null, pastSeason: season, opponent: null }))];
}
