import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { autoSubs, gameweekPlay, type GameweekPlay } from "../lineup/autoSubs";
import { lineupsInGameweek } from "../lineup/lineups";
import { AREAS, LANES, playsCell, type Cell } from "../lineup/pitch";
import { currentPositions } from "../positions/playerPositions";
import { howPositionsCount, type HowPositionsCount } from "../positions/positionSettings";
import type { Position } from "../positions/positionTables";
import { passedDeadlinesOf } from "../gameweeks/passedDeadlines";
import { GAMEWEEKS, isGameweekUsed } from "../gameweeks/usedGameweeks";
import { MOST_TEAMS } from "../leagues/leagueLimits";
import type { SeasonRules } from "../rules/rulesHistory";
import type { StoredScoringSet } from "../rules/leagueRulesShape";
import { siteScoringByGameweek } from "../scoring/siteScoring";
import { validateScoringSet } from "../scoring/scoringSet";
import { scoreTeam, type PlayerMatch } from "../scoring/teamPoints";
import { isWhole, MINUTES_STAT } from "../stats/matchRecords";
import { statusOf } from "../stats/matchStats";
import { GAMEWEEK_MATCHES_MOST } from "../football/matchScores";
import { takeAllOrThrow } from "../shared/cappedRead";
import { logFailure } from "../shared/errors";
import { playerByCode } from "../shared/players";

// Each team's points in each gameweek the league has begun (#29; spec/14; spec/05, Auto-subs;
// spec/07): its lineup in the gameweek, auto-subs from who played, then scoreTeam under the site's
// scoring set in force that gameweek. A gameweek not yet final is worked out on every read: the
// table's query then re-runs whenever a record, a match's state or a lineup changes, so live matches
// move it minute by minute (#28). One final (every match in it locked, so no correction changes it:
// spec/07) is read from finalScores.ts's stored rows, so a season's worth never outgrows one read
// (#418). Little a final gameweek reads changes after: its head-to-heads are stored
// (playedFixtures.ts), the site's set never reaches a gameweek begun (siteScoring.ts), a locked
// match's records no longer change (matchStats.ts) and its lineup is read against the squad at its
// deadline (#415). Its matches can: the stored rows name those they were scored from, and a match
// moved in or out by the football sync reopens the gameweek, to be worked out and stored again.
//
// A gameweek that can't be scored (a site set holding a rule no longer sound, say: #287) is left
// out and named with the reason, logged, rather than blanking or breaking the league's table.

/** The most records one match holds: one for each man two team sheets name, about forty. More
 *  throws, never a silent cut. */
export const MATCH_RECORDS_MOST = 80;

type TeamId = Id<"teams">;
type PlayerCode = number;

/** A team's points in a gameweek. */
export interface TeamGameweek {
  points: number;
  /** While a record that counts hasn't arrived, or a match it counts isn't locked (spec/07). */
  provisional: boolean;
  /** It has never saved a lineup, so it scores 0: what such a team fields isn't settled. */
  noLineup: boolean;
}

/** A gameweek left out of the table, and why. */
interface Unscored {
  gameweek: number;
  reason: string;
}

type TeamScores = Map<TeamId, TeamGameweek>;

/** Teams' final points worked out here, not read from finalScores: for it to store. */
interface FinalUnstored {
  gameweek: number;
  /** The teams worked out: every team, or only those added since the rest were stored. */
  teamIds: TeamId[];
  /** The gameweek's matches they were scored from, stored with them. */
  fixtureCodes: number[];
  /** Whether the gameweek's stored rows go first: its matches have changed since, or it had none. */
  replace: boolean;
}

interface LeagueScores {
  /** Gameweek to team to points: each gameweek begun and scored. */
  scores: Map<number, TeamScores>;
  unscored: Unscored[];
  finalUnstored: FinalUnstored[];
}

/** One of the gameweek's matches as held: its state, if read at full time, and its records. */
interface HeldMatch {
  fixture: Doc<"fixtures">;
  status: Doc<"matchStatsStatus"> | null;
  records: Map<PlayerCode, Doc<"playerMatchStats">>;
}

/** What every gameweek's scoring reads, read once for the league. */
interface LeagueReads {
  leagueId: Id<"leagues">;
  season: SeasonRules;
  setIn: (gameweek: number) => StoredScoringSet;
  player: (code: PlayerCode) => Promise<{ clubCode: number; positions: Position[] }>;
}

/** The gameweeks the league plays that have begun since it was made, by its recorded deadlines. */
async function begunGameweeks(ctx: QueryCtx, league: Doc<"leagues">): Promise<number[]> {
  const passed = await passedDeadlinesOf(ctx, league._id);
  return [...passed]
    .filter(([gameweek, deadline]) => deadline >= league._creationTime && isGameweekUsed(league, gameweek))
    .map(([gameweek]) => gameweek)
    .sort((one, other) => one - other);
}

/** Every team's points in each gameweek the league has begun: read from finalScores while the
 *  gameweek holds the same matches it was stored from, else worked out. A team added since the
 *  rest were stored is worked out alone. */
export async function leagueScores(
  ctx: QueryCtx,
  league: Doc<"leagues">,
  season: SeasonRules,
  teamIds: readonly TeamId[],
): Promise<LeagueScores> {
  const gameweeks = await begunGameweeks(ctx, league);
  const result: LeagueScores = { scores: new Map(), unscored: [], finalUnstored: [] };
  if (gameweeks.length === 0 || teamIds.length === 0) return result;
  const stored = await storedFinalScores(ctx, league._id);
  const reads: LeagueReads = {
    leagueId: league._id,
    season,
    setIn: await siteScoringByGameweek(ctx),
    player: playerReader(ctx, await howPositionsCount(ctx)),
  };
  for (const gameweek of gameweeks) {
    try {
      const fixtures = await heldFixtures(ctx, gameweek);
      const fixtureCodes = fixtures.map((fixture) => fixture.code);
      const held = stored.get(gameweek);
      const storedScores = held !== undefined && sameCodes(held.fixtureCodes, fixtureCodes) ? held.scores : new Map<TeamId, TeamGameweek>();
      const unstored = teamIds.filter((teamId) => !storedScores.has(teamId));
      const worked = unstored.length === 0 ? null : await gameweekScores(ctx, reads, gameweek, fixtures, unstored);
      const scores = new Map(teamIds.map((teamId) => [teamId, storedScores.get(teamId) ?? worked!.scores.get(teamId)!]));
      result.scores.set(gameweek, scores);
      if (worked?.final) result.finalUnstored.push({ gameweek, teamIds: unstored, fixtureCodes, replace: storedScores.size === 0 });
    } catch (error) {
      const reason = logFailure(`League ${league._id} (${league.name}) can't score gameweek ${gameweek}`, error);
      result.unscored.push({ gameweek, reason });
    }
  }
  return result;
}

/** Each player's club and positions, read once however many gameweeks ask. A player the football
 *  sync doesn't hold is data gone wrong, and throws. */
function playerReader(ctx: QueryCtx, how: HowPositionsCount) {
  const read = new Map<PlayerCode, Promise<{ clubCode: number; positions: Position[] }>>();
  return (code: PlayerCode) => {
    let player = read.get(code);
    if (player === undefined) {
      player = (async () => {
        const held = await playerByCode(ctx, code);
        if (held === null) throw new Error(`player ${code} is in a lineup but the football sync doesn't hold him`);
        return { clubCode: held.clubCode, positions: await currentPositions(ctx, code, how) };
      })();
      read.set(code, player);
    }
    return player;
  };
}

/** The most final rows a league holds: one for each team in each gameweek. */
const FINAL_SCORES_MOST = GAMEWEEKS * MOST_TEAMS;

/** A gameweek's stored final scores, and the matches they were scored from. */
interface StoredGameweek {
  fixtureCodes: number[];
  scores: TeamScores;
}

/** Each gameweek's stored final scores. A gameweek whose rows disagree on its matches counts as
 *  holding none, to be stored again whole. */
async function storedFinalScores(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Map<number, StoredGameweek>> {
  const rows = await takeAllOrThrow(
    ctx.db.query("finalScores").withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId)),
    FINAL_SCORES_MOST,
    `League ${leagueId} holds more than ${FINAL_SCORES_MOST} final scores, so some would be left out`,
  );
  const rowsByGameweek = new Map<number, Doc<"finalScores">[]>();
  for (const row of rows) rowsByGameweek.set(row.gameweek, [...(rowsByGameweek.get(row.gameweek) ?? []), row]);
  const byGameweek = new Map<number, StoredGameweek>();
  for (const [gameweek, [first, ...rest]] of rowsByGameweek) {
    const agree = rest.every((row) => sameCodes(row.fixtureCodes, first.fixtureCodes));
    const scores = new Map<TeamId, TeamGameweek>(
      agree ? [first, ...rest].map(({ teamId, points, noLineup }) => [teamId, { points, provisional: false, noLineup }]) : [],
    );
    byGameweek.set(gameweek, { fixtureCodes: first.fixtureCodes, scores });
  }
  return byGameweek;
}

/** Whether two lists hold the same match codes, in any order. */
function sameCodes(one: readonly number[], other: readonly number[]): boolean {
  const others = new Set(other);
  return one.length === others.size && one.every((code) => others.has(code));
}

/** The teams' points in one gameweek, from its held fixtures, and whether they are final: the
 *  gameweek holds a match and every match in it is locked, so nothing counted is provisional. One
 *  with no match held (each postponed, say) is never final. */
async function gameweekScores(
  ctx: QueryCtx,
  reads: LeagueReads,
  gameweek: number,
  fixtures: readonly Doc<"fixtures">[],
  teamIds: readonly TeamId[],
): Promise<{ scores: TeamScores; final: boolean }> {
  const set = reads.setIn(gameweek);
  validateScoringSet(set);
  const rules = reads.season.inGameweek(gameweek);
  const matches = await heldMatches(ctx, fixtures);
  const scores = new Map<TeamId, TeamGameweek>();
  const lineups = await lineupsInGameweek(ctx, reads.leagueId, teamIds, gameweek);
  for (const teamId of teamIds) {
    const held = lineups.get(teamId)!;
    if (held.kind === "none") {
      scores.set(teamId, { points: 0, provisional: false, noLineup: true });
      continue;
    }
    const lineup = { starters: held.starters, bench: held.bench };
    const codes = [...lineup.starters.map(({ playerCode }) => playerCode), ...lineup.bench];
    const positions = new Map<PlayerCode, Position[]>();
    const playerMatches = new Map<PlayerCode, PlayerMatch[]>();
    const plays = new Map<PlayerCode, GameweekPlay>();
    for (const code of codes) {
      const { clubCode, positions: hisPositions } = await reads.player(code);
      const hisMatches = matches.filter((match) => match.records.has(code) || playsIn(match.fixture, clubCode));
      positions.set(code, hisPositions);
      playerMatches.set(code, hisMatches.map((match) => forPoints(match, code)));
      plays.set(code, gameweekPlay(hisMatches.map((match) => forPlay(match, code))));
    }
    const subs = autoSubs(lineup, positions, plays, { areaLimits: rules.areaLimits });
    const team = scoreTeam({
      lineup,
      matches: playerMatches,
      set,
      doubleGameweekRule: rules.doubleGameweek,
      substitutions: subs.substitutions.map(({ off, on, area, lane }) => ({ off, on, cell: { area, lane } })),
      benchCells: new Map(lineup.bench.map((code) => [code, benchCell(positions.get(code)!)])),
    });
    scores.set(teamId, { points: team.total, provisional: team.provisional, noLineup: false });
  }
  const final = matches.length > 0 && matches.every(isLocked) && [...scores.values()].every((team) => !team.provisional);
  return { scores, final };
}

/** The gameweek's fixtures the feed still sends. */
function heldFixtures(ctx: QueryCtx, gameweek: number): Promise<Doc<"fixtures">[]> {
  return takeAllOrThrow(
    ctx.db.query("fixtures").withIndex("by_gameweek_and_droppedAt", (q) => q.eq("gameweek", gameweek).eq("droppedAt", undefined)),
    GAMEWEEK_MATCHES_MOST,
    `More than ${GAMEWEEK_MATCHES_MOST} matches are held for gameweek ${gameweek}, so its points would be cut short`,
  );
}

/** The fixtures' matches, each with its state and records. */
async function heldMatches(ctx: QueryCtx, fixtures: readonly Doc<"fixtures">[]): Promise<HeldMatch[]> {
  return Promise.all(
    fixtures.map(async (fixture) => {
      const rows = await takeAllOrThrow(
        ctx.db.query("playerMatchStats").withIndex("by_fixtureCode_and_playerCode", (q) => q.eq("fixtureCode", fixture.code)),
        MATCH_RECORDS_MOST,
        `Match ${fixture.code} holds more than ${MATCH_RECORDS_MOST} records, so its points would be cut short`,
      );
      return { fixture, status: await statusOf(ctx, fixture.code), records: new Map(rows.map((row) => [row.playerCode, row])) };
    }),
  );
}

const playsIn = (fixture: Doc<"fixtures">, clubCode: number) => fixture.homeClubCode === clubCode || fixture.awayClubCode === clubCode;

/** A match read at full time has a state; one still live has none (liveStats.ts). */
const isFinished = (match: HeldMatch) => match.status !== null;
/** Its corrections window shut: nothing changes its points after (spec/07). */
const isLocked = (match: HeldMatch) => match.status?.state === "locked";

/** What a man neither team sheet named did in a match his club has finished: nothing. */
const NOT_NAMED: Readonly<Record<string, number>> = {};

/** His match for scoreTeam: his record once whole, null ("—") until then, and nothing if the match
 *  is over and no sheet named him. Final once the match is locked, its corrections window shut. */
function forPoints(match: HeldMatch, code: PlayerCode): PlayerMatch {
  const record = match.records.get(code);
  const stats = record === undefined ? (isFinished(match) ? NOT_NAMED : null) : isWhole(record) ? record.stats : null;
  return { record: stats, final: isLocked(match) };
}

/** The minutes counted for a man the sheets say played whose minutes no feed has sent yet: any
 *  above none tells auto-subs he played. */
const PLAYED_MINUTES_UNKNOWN = 1;

/** His match for auto-subs: whether it is over, and his minutes. The sheets saying he came on
 *  count before either feed has sent his minutes, so he is never subbed off for a feed's delay. */
function forPlay(match: HeldMatch, code: PlayerCode) {
  const record = match.records.get(code);
  const minutes = record?.stats[MINUTES_STAT] ?? 0;
  return { finished: isFinished(match), minutes: record?.played === true ? Math.max(minutes, PLAYED_MINUTES_UNKNOWN) : minutes };
}

/** Where a bench player's greyed points are priced while he hasn't come on: the first cell he plays,
 *  back to front, or the first cell of all for a man with no position yet. The table reads only
 *  totals, which those points never reach; where a screen prices them is not settled (#29). */
function benchCell(positions: readonly Position[]): Cell {
  const cells = AREAS.flatMap((area) => LANES.map((lane) => ({ area, lane })));
  return cells.find((cell) => playsCell(positions, cell)) ?? cells[0];
}
