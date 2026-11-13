import { v, type Infer } from "convex/values";
import { clubRecord } from "../schema";
import { roleLine, roleLineOf } from "../scoring/breakdownShape";
import { categoryName } from "../scoring/categories";
import { scoreMatch } from "../scoring/scoring";
import type { ScoringSet } from "../scoring/scoringSet";
import { MINUTES_STAT } from "../stats/matchRecords";
import type { Position } from "../positions/positionTables";
import type { Cell } from "./pitch";
import { rolesFor, type Formation } from "./roles";

// The role card's shape and pricing (spec/05 Roles; #848), apart from its query (roleCard.ts) so the
// preview and the screen's tests build a card as the server does. Every match is priced at the
// card's slot, with no role for his base points, and under each role alone, never the team's
// instructions (Craig, 6 Nov 2026, on #848: "Role alone").

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
  /** Marked not tested until a real Sportmonks read shows its stats for his position (spec/05
   *  `S05.30`). */
  notTested: v.boolean(),
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

export const roleCardShape = v.object({
  roles: v.array(cardRole),
  /** Newest first, at most ROLE_CARD_MATCHES: none says "No matches yet". */
  matches: v.array(cardMatch),
});
export type RoleCard = Infer<typeof roleCardShape>;
export type CardMatch = Infer<typeof cardMatch>;

/** A match to price: what he did, the set it is priced under, and what the card shows of it. */
export type MatchToPrice = Pick<CardMatch, "gameweek" | "pastSeason" | "opponent"> & { stats: Record<string, number>; set: ScoringSet };

/** The slot's roles a player with these positions may take (spec/05 `S05.29`) as the card lists
 *  them, what each rewards and punishes read from `set`. */
export function cardRolesOf(cell: Cell, formation: Formation, positions: readonly Position[], set: ScoringSet): RoleCard["roles"] {
  const named = (parts: readonly { stat: string }[]) => parts.map(({ stat }) => categoryName(stat, set.ownStats));
  return rolesFor(cell, formation, positions).map(({ key, name, description, rewards, costs, notTested }) => {
    const scored = set.roles?.find((each) => each.role === key);
    return {
      key,
      name,
      description,
      rewards: scored === undefined ? [...rewards] : named(scored.bonus.parts),
      punishes: scored === undefined ? [...costs] : named(scored.cost.parts),
      notTested,
    };
  });
}

/** One match priced at `cell` with no role and under each of `roles`: the totals scoreMatch gives. */
export function pricedMatch({ stats, set, gameweek, pastSeason, opponent }: MatchToPrice, cell: Cell, roles: readonly string[]): CardMatch {
  return {
    gameweek,
    pastSeason,
    opponent,
    minutes: stats[MINUTES_STAT] ?? 0,
    base: scoreMatch(stats, set, cell).total!,
    roles: roles.map((role) => {
      const scored = scoreMatch(stats, set, cell, role);
      const line = scored.role === undefined || scored.role.sides.length === 0 ? null : roleLineOf(scored.role, set.ownStats);
      return { role, points: scored.role?.points ?? 0, total: scored.total!, line };
    }),
  };
}
