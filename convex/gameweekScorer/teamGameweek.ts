import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { autoSubs, gameweekPlay, type AutoSubs, type GameweekPlay } from "../lineup/autoSubs";
import { namedCodes } from "../lineup/lineup";
import { lineupsInGameweek, type HeldLineup } from "../lineup/lineups";
import { ALL_CELLS, playsCell, type Cell } from "../lineup/pitch";
import { positionsNow, type PositionsNow } from "../positions/playerPositions";
import type { Position } from "../positions/positionTables";
import type { StoredScoringSet } from "../scoring/scoringSetShape";
import type { SeasonRules } from "../rules/rulesHistory";
import type { MatchPoints } from "../scoring/scoring";
import type { MatchStats } from "../scoring/values";
import { siteScoringByGameweek } from "../scoring/siteScoring";
import { validateScoringSet } from "../scoring/scoringSet";
import { scoreTeam, type PlayerMatch, type SlotPoints, type TeamPoints } from "../scoring/teamPoints";
import { playerByCode } from "../shared/players";
import { readOnce } from "../shared/readOnce";
import { isWhole, MINUTES_STAT } from "../stats/matchRecords";
import { heldMatches, isFinished, isMatchFinal, playsIn, type HeldMatch } from "./heldMatches";

// One team's points in one gameweek (#29; spec/05, Auto-subs; spec/07): its lineup, auto-subs from
// who played, then scoreTeam under the site's scoring set in force that gameweek. The league's
// scorer (gameweekScores.ts) runs it for the table, every team in every gameweek begun, and slot by
// slot for the matchup (#34), an override (#32), the match page (#45) and a player's card and the
// Squad tab (#577), so none of them disagree.

type TeamId = Id<"teams">;
type PlayerCode = number;

/** What every gameweek's scoring reads, read once for the league. */
export interface LeagueReads {
  leagueId: Id<"leagues">;
  season: SeasonRules;
  setIn: (gameweek: number) => StoredScoringSet;
  player: (code: PlayerCode) => Promise<LineupPlayer>;
}

/** A man a lineup names, as scoring reads him: his club, null for one the football sync doesn't
 *  hold, and his positions. */
interface LineupPlayer {
  clubCode: number | null;
  positions: Position[];
}

/** What scoring any of the league's gameweeks reads, read once. A caller that has read the site's
 *  sets already (`siteScoringByGameweek`, in the same query) hands them in as `setIn`. */
export async function leagueReads(
  ctx: QueryCtx,
  league: Doc<"leagues">,
  season: SeasonRules,
  setIn?: LeagueReads["setIn"],
): Promise<LeagueReads> {
  return {
    leagueId: league._id,
    season,
    setIn: setIn ?? (await siteScoringByGameweek(ctx)),
    player: playerReader(ctx, await positionsNow(ctx)),
  };
}

/** Each player's club and positions, read once however many gameweeks ask. */
function playerReader(ctx: QueryCtx, positionsOfNow: PositionsNow) {
  return readOnce(async (code: PlayerCode): Promise<LineupPlayer> => {
    const held = await playerByCode(ctx, code);
    return { clubCode: held?.clubCode ?? null, positions: await positionsOfNow(code) };
  });
}

/** What scoring the `teamIds` in one gameweek reads: the site's set in force then, checked, the
 *  league's rules in force then, the matches of its `fixtures` with the league's overrides in
 *  them, and each team's lineup. */
export interface GameweekInputs {
  set: StoredScoringSet;
  rules: ReturnType<SeasonRules["inGameweek"]>;
  matches: HeldMatch[];
  lineups: ReadonlyMap<TeamId, HeldLineup>;
}

/** The gameweek's inputs. A set holding a rule no longer sound throws (#287). A caller that has
 *  read the `teamIds`' lineups in the gameweek already (`lineupsInGameweek`, in the same query)
 *  hands them in as `lineups`, so they are read once (the match page, #770). */
export async function gameweekInputs(
  ctx: QueryCtx,
  reads: LeagueReads,
  gameweek: number,
  fixtures: readonly Doc<"fixtures">[],
  teamIds: readonly TeamId[],
  lineups?: GameweekInputs["lineups"],
): Promise<GameweekInputs> {
  return {
    ...rulesIn(reads, gameweek),
    matches: await heldMatches(ctx, reads.leagueId, fixtures),
    lineups: lineups ?? (await lineupsInGameweek(ctx, reads.leagueId, teamIds, gameweek)),
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
  /** It held no lineup in a gameweek begun before #637 gave every team one (lineups.ts), though
   *  its squad had players, so it scores 0 and a screen can say why. */
  noLineup: boolean;
}

/** The team's gameweek: its lineup, auto-subs from who played, then scoreTeam. */
export async function teamInGameweek(reads: LeagueReads, inputs: GameweekInputs, teamId: TeamId): Promise<TeamInGameweek> {
  const { set, rules, matches, lineups } = inputs;
  const held = lineups.get(teamId);
  if (held === undefined) throw new Error(`team ${teamId} isn't one of the teams this gameweek's lineups were read for`);
  const lineup = { starters: held.starters, bench: held.bench };
  const codes = namedCodes(lineup);
  const positions = new Map<PlayerCode, Position[]>();
  const playerMatches = new Map<PlayerCode, PlayerMatch[]>();
  const plays = new Map<PlayerCode, GameweekPlay>();
  const matchesOf = new Map<PlayerCode, HeldMatch[]>();
  for (const code of codes) {
    const { clubCode, positions: hisPositions } = await reads.player(code);
    // One the football sync doesn't hold is data gone wrong: he scores as if he didn't play, with no
    // match, so a starter is subbed and a bench player never comes on (Craig, 31 Oct 2026, #810;
    // spec/05 Auto-subs). Once the sync holds him again, he scores as any other man.
    const hisMatches = clubCode === null ? [] : matches.filter((match) => match.records.has(code) || playsIn(match.fixture, clubCode));
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
  return { team, autoSubs: subs, matchesOf, noLineup: held.noLineup };
}

/** One of his matches as his slot scored it: its points by category, and whether his slot's points
 *  count it, not his other match in a double gameweek that counts only his best (scoring.ts's
 *  countedMatches). */
export interface ScoredInMatch {
  match: HeldMatch;
  points: MatchPoints;
  counted: boolean;
}

/** Each of his matches as his slot scored it. scoreTeam scores a man's matches in the order
 *  matchesOf holds them, so this is the one place that pairs a match with its points. */
function scoredByMatch(slot: SlotPoints, matches: readonly HeldMatch[]): ScoredInMatch[] {
  return matches.map((match, index) => ({ match, points: slot.matches[index], counted: slot.matchesCounted[index] }));
}

/** Each of his matches with his points in it. */
export function pointsByMatch(slot: SlotPoints, matches: readonly HeldMatch[]): { match: HeldMatch; points: number | null }[] {
  return scoredByMatch(slot, matches).map(({ match, points }) => ({ match, points: points.total }));
}

/** A man's slot in the team, and one match as it scored him: null when the lineup doesn't hold
 *  him, and `inMatch` null when the match isn't one of his. */
export function slotInMatch(scored: TeamInGameweek, playerCode: PlayerCode, fixtureCode: number): { slot: SlotPoints; inMatch: ScoredInMatch | null } | null {
  const slot = [...scored.team.starters, ...scored.team.bench].find((each) => each.playerCode === playerCode);
  if (slot === undefined) return null;
  const his = scored.matchesOf.get(playerCode);
  if (his === undefined) throw new Error(`player ${playerCode} has a slot but no matches in the gameweek`);
  return { slot, inMatch: scoredByMatch(slot, his).find(({ match }) => match.fixture.code === fixtureCode) ?? null };
}

/** A man's slot in the team and his points in one match: null when the lineup doesn't hold him,
 *  or the match isn't one of his. */
export function pointsInMatch(scored: TeamInGameweek, playerCode: PlayerCode, fixtureCode: number): { slot: SlotPoints; points: number | null } | null {
  const found = slotInMatch(scored, playerCode, fixtureCode);
  if (found === null || found.inMatch === null) return null;
  return { slot: found.slot, points: found.inMatch.points.total };
}

/** A man's part in each match he has a record in, by match code: his record once whole, whether he
 *  played, and his points there. The commentary (vidiprinter.ts) prices from it. */
export type InMatch = ReadonlyMap<number, { stats: MatchStats | null; played: boolean; points: number | null }>;

/** His part in each of his matches he has a record in, as the commentary prices it (vidiprinter.ts):
 *  the record once whole, whether he played, and his points there. The matchup and the match page
 *  both read it. */
export function inMatchOf(slot: SlotPoints, matches: readonly HeldMatch[]): InMatch {
  return new Map(
    pointsByMatch(slot, matches).flatMap(({ match, points }) => {
      const record = match.records.get(slot.playerCode);
      if (record === undefined) return [];
      return [[match.fixture.code, { stats: isWhole(record) ? record.stats : null, played: record.played === true, points }] as const];
    }),
  );
}

/** What a man neither team sheet named did in a match his club has finished: nothing. */
const NOT_NAMED: Readonly<Record<string, number>> = {};

/** His match for scoreTeam: his record once whole, null ("—") until then, and nothing if the match
 *  is over and no sheet named him; with the league's override of his points there, if it holds
 *  one. Final once the match is locked, its corrections window shut. */
function forPoints(match: HeldMatch, code: PlayerCode): PlayerMatch {
  const record = match.records.get(code);
  const stats = record === undefined ? (isFinished(match) ? NOT_NAMED : null) : isWhole(record) ? record.stats : null;
  return { record: stats, final: isMatchFinal(match), override: match.overrides.get(code) };
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
 *  totals, which those points never reach, and the Squad tab prices them at his best position
 *  (scoredMatches.ts). */
function benchCell(positions: readonly Position[]): Cell {
  return ALL_CELLS.find((cell) => playsCell(positions, cell)) ?? ALL_CELLS[0];
}
