import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { autoSubs, gameweekPlay, type AutoSubs, type GameweekPlay } from "../lineup/autoSubs";
import { lineupsInGameweek, type HeldLineup } from "../lineup/lineups";
import { AREAS, LANES, playsCell, type Cell } from "../lineup/pitch";
import { currentPositions } from "../positions/playerPositions";
import { howPositionsCount, type HowPositionsCount } from "../positions/positionSettings";
import type { Position } from "../positions/positionTables";
import type { SeasonRules } from "../rules/rulesHistory";
import type { StoredScoringSet } from "../rules/leagueRulesShape";
import { siteScoringByGameweek } from "../scoring/siteScoring";
import { validateScoringSet } from "../scoring/scoringSet";
import { scoreTeam, type PlayerMatch, type TeamPoints } from "../scoring/teamPoints";
import { isWhole, MINUTES_STAT } from "../stats/matchRecords";
import { statusOf } from "../stats/matchStats";
import { takeAllOrThrow } from "../shared/cappedRead";
import { gameweekFixtures } from "../shared/fixtures";
import { playerByCode } from "../shared/players";

// One team's points in one gameweek (#29; spec/05, Auto-subs; spec/07): its lineup, auto-subs from
// who played, then scoreTeam under the site's scoring set in force that gameweek. The table
// (gameweekScores.ts) runs it for every team in every gameweek begun; the matchup (#34) for the
// two sides of one head-to-head, slot by slot, so the two never disagree.

/** The most records one match holds: one for each man two team sheets name, about forty. More
 *  throws, never a silent cut. */
export const MATCH_RECORDS_MOST = 80;

type TeamId = Id<"teams">;
type PlayerCode = number;

/** One of the gameweek's matches as held: its state, if read at full time, its records, and the
 *  league's overrides of men's points in it (#32). */
export interface HeldMatch {
  fixture: Doc<"fixtures">;
  status: Doc<"matchStatsStatus"> | null;
  records: Map<PlayerCode, Doc<"playerMatchStats">>;
  overrides: Map<PlayerCode, number>;
}

/** What every gameweek's scoring reads, read once for the league. */
export interface LeagueReads {
  leagueId: Id<"leagues">;
  season: SeasonRules;
  setIn: (gameweek: number) => StoredScoringSet;
  player: (code: PlayerCode) => Promise<{ clubCode: number; positions: Position[] }>;
}

/** What scoring any of the league's gameweeks reads, read once. */
export async function leagueReads(ctx: QueryCtx, league: Doc<"leagues">, season: SeasonRules): Promise<LeagueReads> {
  return {
    leagueId: league._id,
    season,
    setIn: await siteScoringByGameweek(ctx),
    player: playerReader(ctx, await howPositionsCount(ctx)),
  };
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

/** What scoring the `teamIds` in one gameweek reads: the site's set in force then, checked, the
 *  league's rules in force then, the matches of its `fixtures` with the league's overrides in
 *  them, and each team's lineup. */
export interface GameweekInputs {
  set: StoredScoringSet;
  rules: ReturnType<SeasonRules["inGameweek"]>;
  matches: HeldMatch[];
  lineups: Map<TeamId, HeldLineup>;
}

/** The gameweek's inputs. A set holding a rule no longer sound throws (#287). */
export async function gameweekInputs(
  ctx: QueryCtx,
  reads: LeagueReads,
  gameweek: number,
  fixtures: readonly Doc<"fixtures">[],
  teamIds: readonly TeamId[],
): Promise<GameweekInputs> {
  return {
    ...rulesIn(reads, gameweek),
    matches: await heldMatches(ctx, reads.leagueId, fixtures),
    lineups: await lineupsInGameweek(ctx, reads.leagueId, teamIds, gameweek),
  };
}

/** The site's set in force in the gameweek, checked, and the league's rules then. */
export function rulesIn(reads: LeagueReads, gameweek: number) {
  const set = reads.setIn(gameweek);
  validateScoringSet(set);
  return { set, rules: reads.season.inGameweek(gameweek) };
}

/** A team's gameweek, slot by slot, for a screen that shows it so (the matchup, #34) as well as
 *  for the table's totals. */
export interface TeamInGameweek {
  team: TeamPoints;
  autoSubs: AutoSubs;
  /** Each player's matches in the gameweek: his club's, and any other he has a record in. */
  matchesOf: Map<PlayerCode, HeldMatch[]>;
}

/** The team's gameweek: its lineup, auto-subs from who played, then scoreTeam. Null while it has
 *  never saved a lineup, so it scores 0: what such a team fields isn't settled. */
export async function teamInGameweek(reads: LeagueReads, inputs: GameweekInputs, teamId: TeamId): Promise<TeamInGameweek | null> {
  const { set, rules, matches, lineups } = inputs;
  const held = lineups.get(teamId);
  if (held === undefined) throw new Error(`team ${teamId} isn't one of the teams this gameweek's lineups were read for`);
  if (held.kind === "none") return null;
  const lineup = { starters: held.starters, bench: held.bench };
  const codes = [...lineup.starters.map(({ playerCode }) => playerCode), ...lineup.bench];
  const positions = new Map<PlayerCode, Position[]>();
  const playerMatches = new Map<PlayerCode, PlayerMatch[]>();
  const plays = new Map<PlayerCode, GameweekPlay>();
  const matchesOf = new Map<PlayerCode, HeldMatch[]>();
  for (const code of codes) {
    const { clubCode, positions: hisPositions } = await reads.player(code);
    const hisMatches = matches.filter((match) => match.records.has(code) || playsIn(match.fixture, clubCode));
    positions.set(code, hisPositions);
    matchesOf.set(code, hisMatches);
    playerMatches.set(code, hisMatches.map((match) => forPoints(match, code)));
    plays.set(code, gameweekPlay(hisMatches.map((match) => forPlay(match, code))));
  }
  const subs = autoSubs(lineup, positions, plays, { areaLimits: rules.areaLimits }, held.vacated);
  const departed = new Set(held.vacated.map(({ playerCode }) => playerCode));
  const team = scoreTeam({
    lineup,
    matches: playerMatches,
    set,
    doubleGameweekRule: rules.doubleGameweek,
    // A sub plays the role auto-subs gave him: the empty slot's, into it (autoSubs.ts). One into a
    // slot left empty by a man who left the squad comes off for no one the lineup names.
    substitutions: subs.substitutions.map(({ off, on, area, lane }) => ({
      off: departed.has(off) ? null : off,
      on,
      cell: { area, lane },
      role: subs.lineup.starters.find((starter) => starter.playerCode === on)?.role,
    })),
    benchCells: new Map(lineup.bench.map((code) => [code, benchCell(positions.get(code)!)])),
  });
  return { team, autoSubs: subs, matchesOf };
}

/** The gameweek's fixtures the feed still sends. */
export function heldFixtures(ctx: QueryCtx, gameweek: number): Promise<Doc<"fixtures">[]> {
  return gameweekFixtures(ctx, gameweek, "its points would be cut short");
}

/** The fixtures' matches, each with its state, its records and the league's overrides in it. */
async function heldMatches(ctx: QueryCtx, leagueId: Id<"leagues">, fixtures: readonly Doc<"fixtures">[]): Promise<HeldMatch[]> {
  return Promise.all(
    fixtures.map(async (fixture) => {
      const rows = await takeAllOrThrow(
        ctx.db.query("playerMatchStats").withIndex("by_fixtureCode_and_playerCode", (q) => q.eq("fixtureCode", fixture.code)),
        MATCH_RECORDS_MOST,
        `Match ${fixture.code} holds more than ${MATCH_RECORDS_MOST} records, so its points would be cut short`,
      );
      return {
        fixture,
        status: await statusOf(ctx, fixture.code),
        records: new Map(rows.map((row) => [row.playerCode, row])),
        overrides: await overridesIn(ctx, leagueId, fixture.code),
      };
    }),
  );
}

/** The most overrides a league holds in one match: one a man, as many as the records allow. More
 *  throws, never a silent cut. */
export const MATCH_OVERRIDES_MOST = MATCH_RECORDS_MOST;

/** The league's overrides of men's points in the match (#32), by player. */
async function overridesIn(ctx: QueryCtx, leagueId: Id<"leagues">, fixtureCode: number): Promise<Map<PlayerCode, number>> {
  const rows = await takeAllOrThrow(
    ctx.db
      .query("pointsOverrides")
      .withIndex("by_leagueId_and_fixtureCode_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("fixtureCode", fixtureCode)),
    MATCH_OVERRIDES_MOST,
    `League ${leagueId} holds more than ${MATCH_OVERRIDES_MOST} overrides in match ${fixtureCode}, so its points would be cut short`,
  );
  return new Map(rows.map((row) => [row.playerCode, row.points]));
}

export const playsIn = (fixture: Doc<"fixtures">, clubCode: number) => fixture.homeClubCode === clubCode || fixture.awayClubCode === clubCode;

/** A match read at full time has a state; one still live has none (liveStats.ts). */
export const isFinished = (match: HeldMatch) => match.status !== null;
/** Its corrections window shut: nothing changes its points after (spec/07). */
export const isLocked = (match: Pick<HeldMatch, "status">) => match.status?.state === "locked";

/** What a man neither team sheet named did in a match his club has finished: nothing. */
const NOT_NAMED: Readonly<Record<string, number>> = {};

/** His match for scoreTeam: his record once whole, null ("—") until then, and nothing if the match
 *  is over and no sheet named him; with the league's override of his points there, if it holds
 *  one. Final once the match is locked, its corrections window shut. */
function forPoints(match: HeldMatch, code: PlayerCode): PlayerMatch {
  const record = match.records.get(code);
  const stats = record === undefined ? (isFinished(match) ? NOT_NAMED : null) : isWhole(record) ? record.stats : null;
  return { record: stats, final: isLocked(match), override: match.overrides.get(code) };
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
 *  totals, which those points never reach, and his card prices them at his best position
 *  (scoredMatches.ts). */
function benchCell(positions: readonly Position[]): Cell {
  const cells = AREAS.flatMap((area) => LANES.map((lane) => ({ area, lane })));
  return cells.find((cell) => playsCell(positions, cell)) ?? cells[0];
}
