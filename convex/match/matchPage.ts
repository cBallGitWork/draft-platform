import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { heldOf } from "../football/matchCommentary";
import { heldTeamStatsOf } from "../football/matchTeamStats";
import { clubOf, scoreOf, scoreOnly } from "../football/matchScores";
import { inMatchOf } from "../matchup/matchup";
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
import { memberOf, teamsOf } from "../shared/leagueAccess";
import { clubByCode, playerByCode } from "../shared/players";
import { thresholdStepsOf } from "../stats/thresholdSteps";
import { begunGameweeks } from "../table/gameweekScores";
import { gameweekInputs, heldFixtures, leagueReads, MATCH_RECORDS_MOST, teamInGameweek } from "../table/teamGameweek";

// One real Premier League match (#45; spec/10, The match page): its score and clock, both clubs'
// men as the team sheets named them, starters and substitutes, each man owned in the league with
// his team and his live points, and the match's commentary, newest first, its goals, assists, cards
// and thresholds priced for the league's men, and "Commentary delayed" while the stream falls
// behind. A man's points are his slot's in his team's lineup, worked out by teamGameweek.ts as the
// matchup and the table work them, so the three never disagree; only once the league's gameweek has
// begun, as the matchup shows lineups only then.
//
// The men come from the match's records, which the live poller writes from kickoff (#28): the
// sheets an hour before it aren't stored yet (#45 stays open for them). The five team stats are as
// the live poller last read them (football/matchTeamStats.ts).

type PlayerCode = number;

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
  /** His points in this match from his slot in his team's lineup; null ("—") for a man in no
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
    const fixture = await ctx.db
      .query("fixtures")
      .withIndex("by_code", (q) => q.eq("code", fixtureCode))
      .unique();
    if (fixture === null) return null;
    const records = await takeAllOrThrow(
      ctx.db.query("playerMatchStats").withIndex("by_fixtureCode_and_playerCode", (q) => q.eq("fixtureCode", fixtureCode)),
      MATCH_RECORDS_MOST,
      `Match ${fixtureCode} holds more than ${MATCH_RECORDS_MOST} records, so its men would be cut short`,
    );
    const owners = await ownersOf(ctx, leagueId, records);
    const priced = await pricedOrProblem(ctx, league, fixture, owners);
    const held = await scoreOf(ctx, fixtureCode);
    const teamStats = await heldTeamStatsOf(ctx, fixtureCode);
    return {
      fixtureCode,
      gameweek: fixture.gameweek,
      kickoff: fixture.kickoff,
      home: clubOf(await clubByCode(ctx, fixture.homeClubCode)),
      away: clubOf(await clubByCode(ctx, fixture.awayClubCode)),
      score: held === null ? null : scoreOnly(held),
      men: await menOf(ctx, fixture, records, owners, priced),
      pointsProblem: priced.problem,
      teamStats: teamStats === null ? null : { home: teamStats.home, away: teamStats.away },
      commentary: await commentaryOf(ctx, fixture, priced),
    };
  },
});

/** Each man the match's records hold who is owned in the league, by the team that owns him. */
async function ownersOf(ctx: QueryCtx, leagueId: Id<"leagues">, records: readonly Doc<"playerMatchStats">[]): Promise<Map<PlayerCode, Doc<"teams">>> {
  const teams = new Map((await teamsOf(ctx, leagueId)).map((team) => [team._id, team]));
  const owners = new Map<PlayerCode, Doc<"teams">>();
  for (const { playerCode } of records) {
    const owned = await ctx.db
      .query("squadPlayers")
      .withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("playerCode", playerCode))
      .unique();
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
async function pricedOrProblem(ctx: QueryCtx, league: Doc<"leagues">, fixture: Doc<"fixtures">, owners: Map<PlayerCode, Doc<"teams">>): Promise<Priced> {
  try {
    return await priced(ctx, league, fixture, owners);
  } catch (error) {
    return unpriced(logFailure(`League ${league._id} (${league.name}) can't price match ${fixture.code}`, error));
  }
}

async function priced(ctx: QueryCtx, league: Doc<"leagues">, fixture: Doc<"fixtures">, owners: Map<PlayerCode, Doc<"teams">>): Promise<Priced> {
  const { gameweek } = fixture;
  if (gameweek === null || !(await begunGameweeks(ctx, league)).includes(gameweek)) return unpriced(null);
  const season = await seasonRules(ctx, league._id);
  // A league made before rules were held has no scoring (#25).
  if (season === null) return unpriced(null);
  const reads = await leagueReads(ctx, league, season);
  const teamIds = [...new Set([...owners.values()].map((team) => team._id))];
  const inputs = await gameweekInputs(ctx, reads, gameweek, await heldFixtures(ctx, gameweek), teamIds);
  const result: Priced = { slots: new Map(), players: new Map(), set: inputs.set, problem: null };
  for (const teamId of teamIds) {
    const scored = await teamInGameweek(reads, inputs, teamId);
    if (scored === null) continue;
    for (const slot of [...scored.team.starters, ...scored.team.bench]) {
      // Only the men in this match, whom alone `owners` holds, and each in his own team's lineup.
      if (owners.get(slot.playerCode)?._id !== teamId) continue;
      const his = scored.matchesOf.get(slot.playerCode) ?? [];
      const index = his.findIndex((match) => match.fixture.code === fixture.code);
      if (index === -1) continue;
      result.slots.set(slot.playerCode, { points: slot.matches[index].total, counts: slot.counts });
      const { name } = await heldPlayer(ctx, fixture.code, slot.playerCode);
      result.players.set(slot.playerCode, { name, cell: slot.cell, inMatch: inMatchOf(slot, his) });
    }
  }
  return result;
}

/** Each man the records hold, with his club's side, his owner and his points, in the page's order.
 *  His side is by the club he is at now, as a record holds no club: a man since moved between the
 *  two shows under his new one (#502). */
async function menOf(
  ctx: QueryCtx,
  fixture: Doc<"fixtures">,
  records: readonly Doc<"playerMatchStats">[],
  owners: Map<PlayerCode, Doc<"teams">>,
  { slots }: Priced,
): Promise<MatchMan[]> {
  const how = await howPositionsCount(ctx);
  const men = await Promise.all(
    records.map(async ({ playerCode, started, played }) => {
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

/** A man with a record in the match. A record is filed only for a man FPL lists, so one the
 *  football sync doesn't hold is bad data, and throws. */
async function heldPlayer(ctx: QueryCtx, fixtureCode: number, playerCode: PlayerCode): Promise<Doc<"players">> {
  const player = await playerByCode(ctx, playerCode);
  if (player === null) throw new Error(`match ${fixtureCode} has a record for player ${playerCode}, whom the football sync doesn't hold`);
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
