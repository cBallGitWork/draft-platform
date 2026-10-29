import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { heldOf } from "../football/matchCommentary";
import { heldTeamSheetsOf } from "../football/matchTeamSheets";
import { heldTeamStatsOf } from "../football/matchTeamStats";
import { clubOf, scoreOf, scoreOnly } from "../football/matchScores";
import { commentary, type MatchupCommentary } from "../matchup/matchupShape";
import { vidiprinter, type VidiprinterPlayer } from "../matchup/vidiprinter";
import { currentPositions } from "../positions/playerPositions";
import { howPositionsCount } from "../positions/positionSettings";
import { POSITIONS } from "../positions/positionTables";
import { seasonRules } from "../rules/rulesHistory";
import { clubRecord, position, scoreRead, sideTeamStats } from "../schema";
import type { ScoringSet } from "../scoring/scoringSet";
import { takeAllOrThrow } from "../shared/cappedRead";
import { logFailure } from "../shared/errors";
import { fixtureByCode } from "../shared/fixtures";
import { memberOf, teamsOf } from "../shared/leagueAccess";
import { clubByCode, playerByCode } from "../shared/players";
import { placeOf } from "../squads/squadPlace";
import { thresholdStepsOf } from "../stats/thresholdSteps";
import { begunGameweeks, workedOutGameweek } from "../table/gameweekScores";
import { inMatchOf, leagueReads, MATCH_RECORDS_MOST, pointsInMatch } from "../table/teamGameweek";

// One real Premier League match (#45; spec/10, The match page): its score and clock, both clubs'
// men as the team sheets named them, starters and substitutes, each man owned in the league with
// his team and his live points, and the match's commentary, newest first, its goals, assists, cards
// and thresholds priced for the league's men, and "Commentary delayed" while the stream falls
// behind. A man's points are his slot's in the lineup that holds him, worked out by the league's
// gameweek scorer (gameweekScores.ts) as the matchup and the table work them, so the three never
// disagree; only once the league's gameweek has begun, as the matchup shows lineups only then.
//
// The men come from the match's records, which the live poller writes from kickoff (#28); before
// any, from the team sheets it reads in the hour before kickoff (football/matchTeamSheets.ts). The
// five team stats are as the live poller last read them (football/matchTeamStats.ts).

type PlayerCode = number;

/** A man the match names: from his record, or before any, from the sheets, not yet played. */
type NamedMan = Pick<Doc<"playerMatchStats">, "playerCode" | "started" | "played">;

const side = v.union(v.literal("home"), v.literal("away"));

const matchMan = v.object({
  playerCode: v.number(),
  name: v.string(),
  /** His main position, null while he has none. */
  position: v.union(position, v.null()),
  /** The club he is at now, by the match's sides; null once he has left both. */
  side: v.union(side, v.null()),
  started: v.boolean(),
  /** False for an unused substitute; null while no feed has sent a substitute's minutes. */
  played: v.union(v.boolean(), v.null()),
  /** The league's team that owns him, null for a free agent. */
  ownerTeamName: v.union(v.string(), v.null()),
  /** His points in this match from his slot in the lineup that holds him, which once the gameweek
   *  has begun is his team's at the deadline, not always his owner's now; null ("—") for a man in no
   *  lineup, before the gameweek begins, or while his record hasn't arrived. */
  points: v.union(v.number(), v.null()),
  /** Whether those points count: false for a bench man who didn't come on, as the matchup greys. */
  counts: v.boolean(),
});
export type MatchMan = Infer<typeof matchMan>;

export const matchPage = v.object({
  fixtureCode: v.number(),
  gameweek: v.union(v.number(), v.null()),
  kickoff: v.union(v.number(), v.null()),
  home: clubRecord,
  away: clubRecord,
  /** Null until a feed's read has given its score. */
  score: v.union(scoreRead.omit("fixtureCode"), v.null()),
  /** Home first, then away, then any who have left both; starters before substitutes, each by
   *  position. */
  men: v.array(matchMan),
  /** Why the league's points can't be worked out, while the rest still shows; null when they can. */
  pointsProblem: v.union(v.string(), v.null()),
  /** Shots, shots on target, possession, corners and cards, each side's; null until a read has
   *  given any. */
  teamStats: v.union(v.object({ home: sideTeamStats, away: sideTeamStats }), v.null()),
  commentary,
});
export type MatchPage = Infer<typeof matchPage>;

/** The match for anyone in the league, or null while no match with its code is held. */
export const ofMatch = query({
  args: { leagueId: v.id("leagues"), fixtureCode: v.number() },
  returns: v.union(matchPage, v.null()),
  handler: async (ctx, { leagueId, fixtureCode }) => {
    const { league } = await memberOf(ctx, leagueId);
    const fixture = await fixtureByCode(ctx, fixtureCode);
    if (fixture === null) return null;
    const records = await takeAllOrThrow(
      ctx.db.query("playerMatchStats").withIndex("by_fixtureCode_and_playerCode", (q) => q.eq("fixtureCode", fixtureCode)),
      MATCH_RECORDS_MOST,
      `Match ${fixtureCode} holds more than ${MATCH_RECORDS_MOST} records, so its men would be cut short`,
    );
    const named = records.length > 0 ? records : await sheetMenOf(ctx, fixtureCode);
    const owners = await ownersOf(ctx, leagueId, named);
    const priced = await pricedOrProblem(ctx, league, fixture, named);
    const held = await scoreOf(ctx, fixtureCode);
    const teamStats = await heldTeamStatsOf(ctx, fixtureCode);
    return {
      fixtureCode,
      gameweek: fixture.gameweek,
      kickoff: fixture.kickoff,
      home: clubOf(await clubByCode(ctx, fixture.homeClubCode)),
      away: clubOf(await clubByCode(ctx, fixture.awayClubCode)),
      score: held === null ? null : scoreOnly(held),
      men: await menOf(ctx, fixture, named, owners, priced),
      pointsProblem: priced.problem,
      teamStats: teamStats === null ? null : { home: teamStats.home, away: teamStats.away },
      commentary: await commentaryOf(ctx, fixture, priced),
    };
  },
});

/** The men the held sheets name, before kickoff; none before a read has named any. */
async function sheetMenOf(ctx: QueryCtx, fixtureCode: number): Promise<NamedMan[]> {
  const sheets = await heldTeamSheetsOf(ctx, fixtureCode);
  return (sheets?.men ?? []).map(({ playerCode, started }) => ({ playerCode, started, played: null }));
}

/** Each man the match names who is owned in the league, by the team that owns him. */
async function ownersOf(ctx: QueryCtx, leagueId: Id<"leagues">, named: readonly NamedMan[]): Promise<Map<PlayerCode, Doc<"teams">>> {
  const teams = new Map((await teamsOf(ctx, leagueId)).map((team) => [team._id, team]));
  const owners = new Map<PlayerCode, Doc<"teams">>();
  for (const { playerCode } of named) {
    const owned = await placeOf(ctx, leagueId, playerCode);
    if (owned === null) continue;
    const team = teams.get(owned.teamId);
    if (team === undefined) throw new Error(`player ${playerCode} is owned by team ${owned.teamId}, which isn't in league ${leagueId}`);
    owners.set(playerCode, team);
  }
  return owners;
}

/** What the league's lineups make of the match: each lineup man's points in it, and the men the
 *  commentary is priced for under the gameweek's set. Empty, with no set, before the gameweek has
 *  begun. */
interface Priced {
  slots: Map<PlayerCode, { points: number | null; counts: boolean }>;
  players: Map<PlayerCode, VidiprinterPlayer>;
  set: ScoringSet | null;
  problem: string | null;
}

const unpriced = (problem: string | null): Priced => ({ slots: new Map(), players: new Map(), set: null, problem });

/** The match priced, or why it can't be: a set holding a rule no longer sound (#287), say. */
async function pricedOrProblem(ctx: QueryCtx, league: Doc<"leagues">, fixture: Doc<"fixtures">, named: readonly NamedMan[]): Promise<Priced> {
  try {
    return await priced(ctx, league, fixture, named);
  } catch (error) {
    return unpriced(logFailure(`League ${league._id} (${league.name}) can't price match ${fixture.code}`, error));
  }
}

/** Every team in the league is priced, not only the men's owners now: a begun gameweek's lineup is
 *  read against the squad at its deadline (lineups.ts), so a man moved or released since still
 *  scores in his old team's lineup, and his points are his slot's in whichever lineup holds him. */
async function priced(ctx: QueryCtx, league: Doc<"leagues">, fixture: Doc<"fixtures">, named: readonly NamedMan[]): Promise<Priced> {
  const { gameweek } = fixture;
  if (gameweek === null || !(await begunGameweeks(ctx, league)).includes(gameweek)) return unpriced(null);
  const season = await seasonRules(ctx, league._id);
  // A league made before rules were held has no scoring (#25).
  if (season === null) return unpriced(null);
  const reads = await leagueReads(ctx, league, season);
  const teamIds = (await teamsOf(ctx, league._id)).map((team) => team._id);
  const inThisMatch = new Set(named.map(({ playerCode }) => playerCode));
  const { set, slotsOf } = await workedOutGameweek(ctx, reads, gameweek, teamIds);
  const result: Priced = { slots: new Map(), players: new Map(), set, problem: null };
  for (const teamId of teamIds) {
    const scored = await slotsOf(teamId);
    for (const slot of [...scored.team.starters, ...scored.team.bench]) {
      // Only the men the match names. One team owned a man at the deadline, so one lineup holds him.
      if (!inThisMatch.has(slot.playerCode)) continue;
      const inMatch = pointsInMatch(scored, slot.playerCode, fixture.code);
      if (inMatch === null) continue;
      result.slots.set(slot.playerCode, { points: inMatch.points, counts: slot.counts });
      const { name } = await heldPlayer(ctx, fixture.code, slot.playerCode);
      result.players.set(slot.playerCode, { name, cell: slot.cell, inMatch: inMatchOf(slot, scored.matchesOf.get(slot.playerCode) ?? []) });
    }
  }
  return result;
}

/** Each man the match names, with his club's side, his owner and his points, in the page's order.
 *  His side is by the club he is at now, as neither a record nor the sheets hold a club: a man since moved between the
 *  two shows under his new one (#502). */
async function menOf(
  ctx: QueryCtx,
  fixture: Doc<"fixtures">,
  named: readonly NamedMan[],
  owners: Map<PlayerCode, Doc<"teams">>,
  { slots }: Priced,
): Promise<MatchMan[]> {
  const how = await howPositionsCount(ctx);
  const men = await Promise.all(
    named.map(async ({ playerCode, started, played }) => {
      const player = await heldPlayer(ctx, fixture.code, playerCode);
      const slot = slots.get(playerCode);
      return {
        playerCode,
        name: player.name,
        position: (await currentPositions(ctx, playerCode, how))[0] ?? null,
        side: player.clubCode === fixture.homeClubCode ? ("home" as const) : player.clubCode === fixture.awayClubCode ? ("away" as const) : null,
        started,
        played,
        ownerTeamName: owners.get(playerCode)?.name ?? null,
        points: slot?.points ?? null,
        counts: slot?.counts ?? true,
      };
    }),
  );
  return men.toSorted((one, other) => sideOrder(one) - sideOrder(other) || Number(other.started) - Number(one.started) || positionOrder(one) - positionOrder(other) || one.name.localeCompare(other.name));
}

/** A man the match names. A record or a sheet's man is kept only for a man FPL lists, so one the
 *  football sync doesn't hold is bad data, and throws. */
async function heldPlayer(ctx: QueryCtx, fixtureCode: number, playerCode: PlayerCode): Promise<Doc<"players">> {
  const player = await playerByCode(ctx, playerCode);
  if (player === null) throw new Error(`match ${fixtureCode} names player ${playerCode}, whom the football sync doesn't hold`);
  return player;
}

const SIDE_ORDER = { home: 0, away: 1 } as const;
const sideOrder = (man: MatchMan) => (man.side === null ? Object.keys(SIDE_ORDER).length : SIDE_ORDER[man.side]);
const positionOrder = (man: MatchMan) => (man.position === null ? POSITIONS.length : POSITIONS.indexOf(man.position));

/** The match's stored lines, newest first, priced for the league's lineup men once the gameweek
 *  has begun; or why they can't be read, while the rest still shows. */
async function commentaryOf(ctx: QueryCtx, fixture: Doc<"fixtures">, { players, set }: Priced): Promise<MatchupCommentary> {
  try {
    const row = await heldOf(ctx, fixture.code);
    if (row === null) return { kind: "read", lines: [], delayed: false };
    const lines =
      set === null
        ? row.lines.map((line) => ({ key: `${fixture.code}:${line.sourceId}`, text: line.text, points: null }))
        : vidiprinter([{ fixtureCode: fixture.code, kickoff: fixture.kickoff, lines: row.lines, steps: await thresholdStepsOf(ctx, fixture.code) }], players, set);
    return { kind: "read", lines, delayed: row.delayed !== null };
  } catch (error) {
    return { kind: "unread", reason: logFailure(`Match ${fixture.code}'s commentary can't be read`, error) };
  }
}
