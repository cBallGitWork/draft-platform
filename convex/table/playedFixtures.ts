import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isLocked } from "../gameweeks/deadline";
import { GAMEWEEKS, usedGameweeksOf } from "../gameweeks/usedGameweeks";
import { drawRulesOf } from "../rules/firstRules";
import type { LeagueRules } from "../rules/leagueRulesShape";
import { teamsOf } from "../shared/leagueAccess";
import { drawFixtures, type GameweekFixtures } from "./roundRobin";

// A league's head-to-head fixtures, played and to come (#137; spec/13, Gameweeks: "a change
// reshuffles only fixtures not yet played"). The round robin is drawn on each read (roundRobin.ts).
// Once a gameweek begins, at the league's own deadline (never FPL's; deadline.ts), it is stored in
// `playedFixtures` and read from there ever after: "Once a gameweek has begun, its fixtures are
// fixed: neither the commissioner's edits nor a rule change touches them" (spec/13, 24 Oct 2026).
// So nothing that changes later (a team joining, a rule, a ticked gameweek, the draw's own code)
// can move a gameweek already begun.
//
// A gameweek that began with no head-to-head in it is stored too, with no fixtures, so none is
// ever drawn for it later: one that began before the league was made ("A league made mid-season
// has no head-to-head fixtures in the gameweeks that began before it existed", spec/13, 24 Oct
// 2026; #282), one played as total points, and one the league had fewer than two teams for. The
// draw leaves those out, so the round robin starts at the league's first gameweek with fixtures.
//
// The football sync stores them, beside the passed deadlines it records (deadlineRecorder.ts), and
// a new team is never made without them stored first (teams.ts's putOnTeam), as a team joining is
// the one change that would redraw a gameweek already begun. A rule change can't: it takes effect
// from a gameweek not yet begun (leagueRules.ts), and the draw deals each gameweek by the rules in
// force in it (#266). Nor can a ticked or unticked gameweek: only one not yet begun can be, and
// each gameweek's draw hangs only on those before it (roundRobin.ts's roundOrder).

type TeamsGameweek = GameweekFixtures<Id<"teams">>;
export type Schedule = TeamsGameweek[];
/** Stored gameweeks, by number. */
type Stored = Map<number, TeamsGameweek>;

/** All of a league's rules this reads: those in force in each gameweek (leagueRules.ts's
 *  `seasonRules`). */
export type RulesInForce = { inGameweek: (gameweek: number) => LeagueRules };

/** What a gameweek that began with no head-to-head in it is stored as. */
const NO_HEAD_TO_HEAD: Pick<TeamsGameweek, "fixtures" | "byes"> = { fixtures: [], byes: [] };

/** Whether a stored gameweek began with no head-to-head in it. With two teams or more, every
 *  gameweek drawn has a fixture, so only NO_HEAD_TO_HEAD has none. */
const hasNoHeadToHead = ({ fixtures, byes }: TeamsGameweek) => fixtures.length === 0 && byes.length === 0;

/** The league's stored gameweeks, by number: each it has begun, one row each at most
 *  (`storeBegunFixtures` skips one stored), so a season's gameweeks are all there are. */
async function storedFixturesOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Stored> {
  const rows = await ctx.db
    .query("playedFixtures")
    .withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId))
    .take(GAMEWEEKS);
  return new Map(rows.map(({ gameweek, fixtures, byes }) => [gameweek, { gameweek, fixtures, byes }]));
}

/** The stored gameweeks that began with no head-to-head in them. */
const withoutHeadToHead = (stored: Stored) => [...stored.values()].filter(hasNoHeadToHead).map(({ gameweek }) => gameweek);

/** The league's head-to-head fixtures in each gameweek that has any, in order: each gameweek it
 *  has begun as stored, and the rest drawn from its teams today, the gameweeks it plays and the
 *  rules in force in each, seeded by the league so a read gives the same draw each time. */
export async function scheduleOf(ctx: QueryCtx, league: Doc<"leagues">, rules: RulesInForce): Promise<Schedule> {
  const stored = await storedFixturesOf(ctx, league._id);
  return scheduleAround(ctx, league, rules, stored, new Set(withoutHeadToHead(stored)));
}

/** `scheduleOf`, around the `stored` gameweeks already read, drawing none for those `without`
 *  head-to-head.
 *
 *  The rest are drawn as if the whole season were drawn now, so while the teams are those the
 *  stored gameweeks were drawn with, they carry on the round robin those began. A team joining
 *  mid-season starts a new draw for them instead; whether one can, and how its season then runs,
 *  is for a grill of leagues with splits (docs/to-grill.md), as is the commissioner editing the
 *  fixtures (spec/09). */
async function scheduleAround(
  ctx: QueryCtx,
  league: Doc<"leagues">,
  rules: RulesInForce,
  stored: Stored,
  without: ReadonlySet<number>,
): Promise<Schedule> {
  const teamIds = (await teamsOf(ctx, league._id)).map((team) => team._id);
  const drawRulesIn = (gameweek: number) => drawRulesOf(rules.inGameweek(gameweek));
  const gameweeks = usedGameweeksOf(league).filter((gameweek) => !without.has(gameweek));
  const drawn = drawFixtures(teamIds, gameweeks, drawRulesIn, league._id);
  const begun = [...stored.values()].filter((gameweek) => !hasNoHeadToHead(gameweek));
  const toCome = drawn.filter(({ gameweek }) => !stored.has(gameweek));
  return [...begun, ...toCome].sort((one, other) => one.gameweek - other.gameweek);
}

/** Stores each gameweek the league plays that has begun by `now`, by its `deadlines`
 *  (leagueRules.ts's `leagueDeadlines`), and isn't stored yet: as it is drawn now when the league
 *  plays it head-to-head, and with no fixtures when it began before the league was made, is
 *  played as total points, or has fewer than two teams to draw. A gameweek already stored is left
 *  as it is, so storing again does no harm. Null rules are a league made before #25, which has no
 *  fixtures to store. */
export async function storeBegunFixtures(
  ctx: MutationCtx,
  league: Doc<"leagues">,
  rules: RulesInForce | null,
  deadlines: ReadonlyMap<number, number | null>,
  now: number,
): Promise<void> {
  if (rules === null) return;
  const stored = await storedFixturesOf(ctx, league._id);
  const toStore = usedGameweeksOf(league).flatMap((gameweek) => {
    const deadline = deadlines.get(gameweek) ?? null;
    return !stored.has(gameweek) && deadline !== null && isLocked(deadline, now) ? [{ gameweek, deadline }] : [];
  });
  // The football sync calls this for every league on each batch: most find nothing to store, and
  // skip the draw.
  if (toStore.length === 0) return;
  const noHeadToHeadIn = toStore.flatMap(({ gameweek, deadline }) =>
    deadline < league._creationTime || rules.inGameweek(gameweek).format !== "headToHead" ? [gameweek] : [],
  );
  // Left out of the draw, as every read will leave them out once they are stored.
  const without = new Set([...withoutHeadToHead(stored), ...noHeadToHeadIn]);
  const drawn = new Map((await scheduleAround(ctx, league, rules, stored, without)).map((each) => [each.gameweek, each]));
  for (const { gameweek } of toStore) {
    const { fixtures, byes } = drawn.get(gameweek) ?? NO_HEAD_TO_HEAD;
    await ctx.db.insert("playedFixtures", { leagueId: league._id, gameweek, fixtures, byes, storedAt: now });
  }
}
