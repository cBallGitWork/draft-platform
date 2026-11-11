import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { PlayerCode } from "../shared/players";
import { autoSubs, gameweekPlay, type AutoSubs, type GameweekPlay } from "../lineup/autoSubs";
import { namedCodes } from "../lineup/lineup";
import { lineupsInGameweek, type HeldLineup } from "../lineup/lineups";
import { ALL_CELLS, playsCell, type Cell } from "../lineup/pitch";
import { keptOrSwitched, type Instruction } from "../lineup/instructions";
import { backLineOf, presetNameOf } from "../lineup/presets";
import { instructionsOf } from "../rules/firstRules";
import { gameModeOf, playedSet } from "../rules/gameMode";
import type { TeamScoring } from "../scoring/scoring";
import { positionsNow } from "../positions/playerPositions";
import type { Position } from "../positions/positionTables";
import type { StoredScoringSet } from "../scoring/scoringSetShape";
import type { SeasonRules } from "../rules/rulesHistory";
import type { MatchPoints } from "../scoring/scoring";
import type { MatchStats } from "../scoring/values";
import { siteScoringByGameweek } from "../scoring/siteVersions";
import { checkedOnce } from "../scoring/scoringSet";
import { scoreTeam, type PlayerMatch, type SlotPoints, type TeamPoints } from "../scoring/teamPoints";
import { MINUTES_STAT, statsIfWhole } from "../stats/matchRecords";
import { heldMatches, isFinished, isMatchFinal, isPostponed, playsIn, teamOverridesIn, type HeldMatch } from "./heldMatches";
import { keptAtDeadline, playerReader, type KeptAtDeadline, type LineupPlayer } from "../stars/deadlineStars";

// One team's points in one gameweek (#29; spec/05, Auto-subs; spec/07): its lineup, auto-subs from
// who played, then scoreTeam under the site's scoring set in force that gameweek. The league's
// scorer (gameweekScores.ts) runs it for the table, every team in every gameweek begun, and slot by
// slot for the matchup (#34), an override (#32), the match page (#45) and a player's card and the
// Squad tab (#577), so none of them disagree.

type TeamId = Id<"teams">;

/** What every gameweek's scoring reads, read once for the league. */
export interface LeagueReads {
  leagueId: Id<"leagues">;
  season: SeasonRules;
  setIn: (gameweek: number) => StoredScoringSet;
  player: (code: PlayerCode) => Promise<LineupPlayer>;
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
    player: playerReader(ctx, await positionsNow(ctx, league._id)),
  };
}

/** What scoring the `teamIds` in one gameweek reads: the site's set in force then, checked, the
 *  league's rules in force then, the matches of its `fixtures` with the league's overrides in
 *  them, and each team's lineup. */
export interface GameweekInputs {
  set: StoredScoringSet;
  rules: ReturnType<SeasonRules["inGameweek"]>;
  matches: HeldMatch[];
  lineups: ReadonlyMap<TeamId, HeldLineup>;
  /** What each team's row kept at the deadline: its bench players' stars, which pick an auto-sub's
   *  role, and each man its lineup named, with his club and positions then. */
  kept: ReadonlyMap<TeamId, KeptAtDeadline>;
  /** The league's overrides of teams' totals in the gameweek (#903): each its team's total. */
  teamOverrides: ReadonlyMap<TeamId, Doc<"teamOverrides">>;
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
    kept: await keptAtDeadline(ctx, reads.leagueId, gameweek),
    teamOverrides: await teamOverridesIn(ctx, reads.leagueId, gameweek),
  };
}

/** The site's set in force in the gameweek, checked, as the league plays it then, and the
 *  league's rules then. */
export function rulesIn(reads: LeagueReads, gameweek: number) {
  const set = reads.setIn(gameweek);
  checkedOnce(set);
  const rules = reads.season.inGameweek(gameweek);
  return { set: playedSet(set, gameModeOf(rules)), rules };
}

/** A team's gameweek, slot by slot, for a screen that shows it so (the matchup, #34) as well as
 *  for the table's totals. */
export interface TeamInGameweek {
  team: TeamPoints;
  autoSubs: AutoSubs;
  /** Each player's matches in the gameweek: his club's, and any other he has a record in. */
  matchesOf: Map<PlayerCode, HeldMatch[]>;
  /** The preset its lineup stands in, named as the league's presets in force in the gameweek name
   *  it; null once its manager has edited the shape off every preset (presets.ts `presetNameOf`).
   *  Read from the lineup as it locked, a slot left empty by a man gone from the squad included:
   *  auto-subs aren't an edit. */
  formation: string | null;
  /** The league's team instructions in force in the gameweek, which name its men's instruction
   *  lines (spec/05: "Park the bus: clean sheet +1"). */
  instructions: readonly Instruction[];
  /** What the team adds to its men's points, as its slots were scored by it (`teamScoring`): the
   *  commentary prices its instructions' moves by it. Undefined for a team with no lineup. */
  scoring: TeamScoring | undefined;
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
  const kept = inputs.kept.get(teamId);
  for (const code of codes) {
    // He is read as he stood at the deadline (spec/06, When positions change; #1540), so a position
    // lost or a club changed since never re-works the gameweek's auto-subs; as he is now only where
    // nothing was kept of him (deadlineStars.ts says when).
    const { clubCode, positions: hisPositions } = kept?.players.get(code) ?? (await reads.player(code));
    // One the football sync doesn't hold is data gone wrong: he scores as if he didn't play, with no
    // match, so a starter is subbed and a bench player never comes on (Craig, 31 Oct 2026, #810;
    // spec/05 Auto-subs), but for a match the league has overridden his points in: "we can always
    // admin update later" (#810; spec/14 S14.5). There his saved record says whether he played.
    // Once the sync holds him again, he scores as any other man.
    const hisMatches = matches.filter((match) =>
      clubCode === null ? match.overrides.has(code) : match.records.has(code) || playsIn(match.fixture, clubCode),
    );
    positions.set(code, hisPositions);
    matchesOf.set(code, hisMatches);
    playerMatches.set(code, hisMatches.map((match) => forPoints(match, code)));
    plays.set(code, gameweekPlay(hisMatches.map((match) => forPlay(match, code))));
  }
  const subs = autoSubs(lineup, positions, plays, { areaLimits: rules.areaLimits }, held.vacated, (code) => kept?.stars.get(code) ?? []);
  const departed = new Set(held.vacated.map(({ playerCode }) => playerCode));
  const formation = presetNameOf([...held.starters, ...held.vacated], rules.presets);
  const scoring = teamScoring(held, inputs, formation);
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
    team: scoring,
  });
  return { team, autoSubs: subs, matchesOf, formation, instructions: instructionsOf(rules), scoring };
}

/** What the team adds to its men's points (spec/05, Team instructions; #990), from its lineup as it
 *  locked, a slot left empty by a man gone from the squad included: the two instructions in force
 *  under the league's rules then (a pick its shape no longer offers takes the formation's default,
 *  as on the Tactics tab), and the back line of the preset it stands in. The back line counts only
 *  in a gameweek whose site set scores instructions: it is among their first values, which start
 *  from the next gameweek not begun (Craig, 9 Nov 2026, on #990), so a gameweek played before them
 *  is never repriced. A team with no lineup has neither. */
function teamScoring(held: HeldLineup, { set, rules }: Pick<GameweekInputs, "set" | "rules">, formation: string | null): TeamScoring | undefined {
  const cells = [...held.starters, ...held.vacated] as Cell[];
  if (cells.length === 0) return undefined;
  const { pair } = keptOrSwitched(held.instructions, cells, rules.presets, instructionsOf(rules));
  const scoring = set.instructions === undefined ? null : backLineOf(cells, rules.presets);
  return { instructions: [pair.attacking, pair.defensive], backLine: formation === null || scoring === null ? null : { formation, scoring } };
}

/** One of his matches as his slot scored it: its points by category, and whether his slot's points
 *  count it, not his other match in a double gameweek that counts only his best (scoring.ts's
 *  countedMatches). */
interface ScoredInMatch {
  match: HeldMatch;
  points: MatchPoints;
  counted: boolean;
}

/** Each of his matches as his slot scored it. scoreTeam scores a man's matches in the order
 *  matchesOf holds them, so this is the one place that pairs a match with its points. */
export function scoredByMatch(slot: SlotPoints, matches: readonly HeldMatch[]): ScoredInMatch[] {
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
      return [[match.fixture.code, { stats: statsIfWhole(record), played: record.played === true, points }] as const];
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
  const stats = record === undefined ? (isFinished(match) ? NOT_NAMED : null) : statsIfWhole(record);
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
  return {
    finished: isFinished(match),
    minutes: record?.played === true ? Math.max(minutes, PLAYED_MINUTES_UNKNOWN) : minutes,
    postponed: isPostponed(match),
  };
}

/** Where a bench player's greyed points are priced while he hasn't come on: the first cell he plays,
 *  back to front, or the first cell of all for a man with no position yet. The table reads only
 *  totals, which those points never reach, and the Squad tab prices them at his best position
 *  (scoredMatches.ts). */
function benchCell(positions: readonly Position[]): Cell {
  return ALL_CELLS.find((cell) => playsCell(positions, cell)) ?? ALL_CELLS[0];
}
