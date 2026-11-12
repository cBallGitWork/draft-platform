import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isLocked, type LeagueDeadlines } from "../gameweeks/deadline";
import { deadlineOf } from "../gameweeks/leagueDeadlines";
import { seasonGameweekCount } from "../gameweeks/seasonGameweeks";
import { GAMEWEEKS_MOST, isGameweekScored, scoredGameweeksOf } from "../gameweeks/usedGameweeks";
import { drawRulesOf } from "../rules/firstRules";
import { gameModeOf } from "../rules/gameMode";
import type { SeasonRules } from "../rules/rulesHistory";
import { takeAllOrThrow } from "../shared/cappedRead";
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
//
// A gameweek before the league's scoring start has no head-to-head (spec/04, After the draft;
// scoringStart.ts), so the round robin starts at the start. One that began before the start was
// set, or before a draft running late moved it on, may be stored with fixtures: they are never read.

type TeamsGameweek = GameweekFixtures<Id<"teams">>;
export type Schedule = TeamsGameweek[];
/** Stored gameweeks, by number. */
type Stored = Map<number, TeamsGameweek>;

/** All of a league's rules this reads: those in force in each gameweek. */
type RulesInForce = Pick<SeasonRules, "inGameweek">;

/** What a gameweek that began with no head-to-head in it is stored as. */
const NO_HEAD_TO_HEAD: Pick<TeamsGameweek, "fixtures" | "byes"> = { fixtures: [], byes: [] };

/** Whether a stored gameweek began with no head-to-head in it. With two teams or more, every
 *  gameweek drawn has a fixture, so only NO_HEAD_TO_HEAD has none. */
const hasNoHeadToHead = ({ fixtures, byes }: TeamsGameweek) => fixtures.length === 0 && byes.length === 0;

/** The league's stored gameweeks, by number: each it has begun, one row each at most
 *  (`storeBegunFixtures` skips one stored), so a season's gameweeks are all there are. */
async function storedFixturesOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Stored> {
  const rows = await takeAllOrThrow(
    ctx.db.query("playedFixtures").withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId)),
    GAMEWEEKS_MOST,
    `More than ${GAMEWEEKS_MOST} stored gameweeks are held for one league, so its latest begun gameweeks would read as not begun`,
  );
  return new Map(rows.map(({ gameweek, fixtures, byes }) => [gameweek, { gameweek, fixtures, byes }]));
}

/** The stored gameweeks that began with no head-to-head in them. */
const withoutHeadToHead = (stored: Stored) => [...stored.values()].filter(hasNoHeadToHead).map(({ gameweek }) => gameweek);

/** The commissioner's edits of gameweeks not yet begun (fixtureEdits.ts), by number. */
type Edits = ReadonlyMap<number, Doc<"fixtureEdits">>;

/** The league's edits, one row a gameweek at most (fixtureEdits.ts replaces one). */
async function editsOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Edits> {
  const rows = await takeAllOrThrow(
    ctx.db.query("fixtureEdits").withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId)),
    GAMEWEEKS_MOST,
    `More than ${GAMEWEEKS_MOST} fixture edit rows are held for one league, so its latest edits would be lost`,
  );
  return new Map(rows.map((row) => [row.gameweek, row]));
}

type Games = Pick<TeamsGameweek, "fixtures" | "byes">;

/** Whether two draws of a gameweek give the same fixtures and byes, in the same order. */
const sameGames = (one: Games, other: Games) =>
  one.fixtures.length === other.fixtures.length &&
  one.fixtures.every(({ team, opponent }, index) => team === other.fixtures[index].team && opponent === other.fixtures[index].opponent) &&
  one.byes.length === other.byes.length &&
  one.byes.every((team, index) => team === other.byes[index]);

/** `drawn` as the commissioner edited it, while it still draws as it did when the edits were made:
 *  a change that redraws it since (a rule, a team, a gameweek ticked) replaces them, as it does any
 *  fixture not yet played (spec/13, Gameweeks). */
function asEdited(drawn: TeamsGameweek, edit: Doc<"fixtureEdits"> | undefined): TeamsGameweek {
  if (edit === undefined || !sameGames(drawn, edit.drawn)) return drawn;
  return { gameweek: drawn.gameweek, fixtures: edit.fixtures, byes: edit.byes };
}

/** The league's head-to-head fixtures in each gameweek that has any, in order: each gameweek it
 *  has begun as stored, and the rest drawn from its teams today, the gameweeks it plays and the
 *  rules in force in each, seeded by the league so a read gives the same draw each time, and as
 *  the commissioner edited them (fixtureEdits.ts). */
export async function scheduleOf(ctx: QueryCtx, league: Doc<"leagues">, rules: RulesInForce): Promise<Schedule> {
  const stored = await storedFixturesOf(ctx, league._id);
  return scheduleAround(ctx, league, rules, stored, new Set(withoutHeadToHead(stored)), await editsOf(ctx, league._id));
}

/** A gameweek not yet begun as the round robin draws it now, no edit taken: what an edit is made
 *  on (fixtureEdits.ts). Undefined for one begun, or one with no head-to-head fixtures drawn. */
export async function drawnGameweek(ctx: QueryCtx, league: Doc<"leagues">, rules: RulesInForce, gameweek: number): Promise<TeamsGameweek | undefined> {
  const stored = await storedFixturesOf(ctx, league._id);
  if (stored.has(gameweek)) return undefined;
  const schedule = await scheduleAround(ctx, league, rules, stored, new Set(withoutHeadToHead(stored)), new Map());
  return schedule.find((each) => each.gameweek === gameweek);
}

/** `scheduleOf`, around the `stored` gameweeks already read, drawing none for those `without`
 *  head-to-head, and taking the commissioner's `edits` of those to come.
 *
 *  The rest are drawn as if the whole season were drawn now, so while the teams are those the
 *  stored gameweeks were drawn with, they carry on the round robin those began. A team joining
 *  mid-season starts a new draw for them instead; whether one can, and how its season then runs,
 *  is for a grill of leagues with splits (docs/to-grill.md). An edit moves only its own gameweek:
 *  each other is drawn as it would be without it (spec/09, Fixture edits). */
async function scheduleAround(
  ctx: QueryCtx,
  league: Doc<"leagues">,
  rules: RulesInForce,
  stored: Stored,
  without: ReadonlySet<number>,
  edits: Edits,
): Promise<Schedule> {
  const teamIds = (await teamsOf(ctx, league._id)).map((team) => team._id);
  const drawRulesIn = (gameweek: number) => drawRulesOf(rules.inGameweek(gameweek));
  const count = await seasonGameweekCount(ctx);
  const gameweeks = scoredGameweeksOf(league, count).filter((gameweek) => !without.has(gameweek));
  const drawn = drawFixtures(teamIds, gameweeks, drawRulesIn, league._id);
  const begun = [...stored.values()].filter((each) => !hasNoHeadToHead(each) && isGameweekScored(league, each.gameweek, count));
  const toCome = drawn.filter(({ gameweek }) => !stored.has(gameweek)).map((each) => asEdited(each, edits.get(each.gameweek)));
  return [...begun, ...toCome].sort((one, other) => one.gameweek - other.gameweek);
}

/** Stores each gameweek the league plays that has begun by `now`, by its `deadlines`
 *  (leagueDeadlines.ts's `leagueDeadlines`), and isn't stored yet: as `scheduleOf` reads it now, edits and all, when the league
 *  plays it head-to-head, and with no fixtures when it began before the league was made, is
 *  played as total points, or has fewer than two teams to draw. A gameweek already stored is left
 *  as it is, so storing again does no harm. */
export async function storeBegunFixtures(
  ctx: MutationCtx,
  league: Doc<"leagues">,
  rules: RulesInForce,
  deadlines: LeagueDeadlines,
  now: number,
): Promise<void> {
  const stored = await storedFixturesOf(ctx, league._id);
  const deadlineIn = deadlineOf(deadlines);
  const toStore = scoredGameweeksOf(league, await seasonGameweekCount(ctx)).flatMap((gameweek) => {
    const deadline = deadlineIn(gameweek);
    return !stored.has(gameweek) && deadline !== null && isLocked(deadline, now) ? [{ gameweek, deadline }] : [];
  });
  // The football sync calls this for every league on each batch: most find nothing to store, and
  // skip the draw.
  if (toStore.length === 0) return;
  const noHeadToHeadIn = toStore.flatMap(({ gameweek, deadline }) =>
    deadline < league._creationTime || !gameModeOf(rules.inGameweek(gameweek)).hasMatchups ? [gameweek] : [],
  );
  // Left out of the draw, as every read will leave them out once they are stored.
  const without = new Set([...withoutHeadToHead(stored), ...noHeadToHeadIn]);
  const edits = await editsOf(ctx, league._id);
  const drawn = new Map((await scheduleAround(ctx, league, rules, stored, without, edits)).map((each) => [each.gameweek, each]));
  for (const { gameweek } of toStore) {
    const { fixtures, byes } = drawn.get(gameweek) ?? NO_HEAD_TO_HEAD;
    await ctx.db.insert("playedFixtures", { leagueId: league._id, gameweek, fixtures, byes, storedAt: now });
  }
}
