// The matchup's and the match page's commentary (spec/10, The matchup, as a live match; The
// commentary; #44, #835): every stored line of every match with the men in it, newest first across
// the matches, with what each line is worth to the men it is priced for: the two lineups' men,
// bench included, on the matchup; every man in the match on the match page, owned or not. A goal,
// an assist, a card or an own goal shows the points it moves; a threshold line shows any other
// movement of his points, up or down ("~58' Rice: 3 key passes, +1", "~71' Saliba: 2 goals
// conceded, −1"; thresholdSteps.ts); a move of his team's instructions has its own line, just
// above the one that moved it ("~71' Rice: Get stuck in", +1; instructionLines.ts), so a goal
// gets one more line per instruction it moves, uncapped: each man has at most his team's two; the
// full-time line lists the lineups' men who played, with their points in the match. Priced by the
// slot and role each man is priced at, under the site's
// set in force in the gameweek, which never changes once the gameweek has begun (spec/14), so a
// past matchup's lines keep the points they showed. Pure: matchup.ts and matchPage.ts read what
// it needs.
//
// No line for an auto-sub: whether a man played is known only after his match (spec/10).

import type { Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { FEED_TYPE, withFullTimePoints } from "../football/commentary";
import type { InMatch } from "../gameweekScorer/teamGameweek";
import type { Instruction } from "../lineup/instructions";
import type { Cell } from "../lineup/pitch";
import { roleTotal, scoreMatch, type TeamScoring } from "../scoring/scoring";
import { instructionLines, instructionStep } from "./instructionLines";
import type { ScoringSet } from "../scoring/scoringSet";
import { inTenths, type MatchStats } from "../scoring/values";
import { categoryName } from "../scoring/categories";
import { CATALOGUE_STATS } from "../scoring/statCatalogue";
import { EVENT_STATS } from "../stats/matchRecords";
import { stepPoints } from "../stats/thresholdSteps";
import { signedWords } from "../shared/numberWords";
import { LINEUPS_OUT_BEFORE_KICKOFF_MS, MINUTE_MS } from "../shared/time";
import type { commentaryLine } from "../schema";

type PlayerCode = number;

type StoredLine = Infer<typeof commentaryLine>;
export type StoredStep = Pick<Doc<"thresholdSteps">, "playerCode" | "stat" | "from" | "to" | "minutes" | "minute">;

export interface VidiprinterMatch {
  fixtureCode: number;
  kickoff: number | null;
  /** Newest first, as stored. */
  lines: readonly StoredLine[];
  /** Oldest first, as stored. */
  steps: readonly StoredStep[];
}

/** One man a line is priced for: his name, the cell and role he is priced at, whether a lineup
 *  holds him, and each match he has a record in. */
export interface VidiprinterPlayer {
  name: string;
  cell: Cell;
  /** His slot's role, so a line's points carry its adjustment as his slot's do (spec/14). Not
   *  optional, so a caller can't leave it out and price his lines without it. */
  role: string | undefined;
  /** Whether one of the league's lineups holds him: only they are named on the full-time line. A
   *  man in none is priced as his player card opens on him (match/unownedPoints.ts). */
  inLineup: boolean;
  inMatch: InMatch;
  /** His team's instructions, each move of which has its own line; undefined for a man in no
   *  lineup, or a team with none. Not optional, for the same reason as `role`. */
  team: VidiprinterTeam | undefined;
}

/** A lineup's team instructions as its lines price them, with the league's, which name them. */
export interface VidiprinterTeam {
  scoring: TeamScoring;
  instructions: readonly Instruction[];
}

export interface VidiprinterLine {
  /** Unique across the matchup's lines. */
  key: string;
  text: string;
  /** What it is worth to the men it is priced for: "+4" where the line names one man, else "Saka +4,
   *  Ødegaard +3"; null when it moves none of them. */
  points: string | null;
}

/** What a line moves one man's points by, in tenths' arithmetic (inTenths). */
export interface LineMove {
  playerCode: PlayerCode;
  points: number;
}

/** A line as priced, with whom it is about and what it moves each of them by, for a caller that
 *  adds them up its own way: the matchup's column per team (readCommentary.ts). Never sent as it
 *  is: `shownLine` keeps what a screen shows. */
export interface PricedLine extends VidiprinterLine {
  priced: {
    fixtureCode: number;
    /** The men it is priced for that it names, or lists at full time: the tapped man's lines on
     *  the matchup (the approved picture's cyan bar). */
    about: PlayerCode[];
    /** What it moves each of them by; none where it moves no one's points. */
    moves: LineMove[];
  };
}

/** A line as a screen shows it, without what a caller added to it. */
export const shownLine = ({ key, text, points }: VidiprinterLine): VidiprinterLine => ({ key, text, points });

/** Which stat each man a line names moves, by the feed's type, in the order the line names them. */
const STATS_MOVED: Readonly<Record<string, readonly string[]>> = {
  [FEED_TYPE.goal]: [EVENT_STATS.goals, EVENT_STATS.assists],
  [FEED_TYPE.penaltyGoal]: [EVENT_STATS.goals],
  [FEED_TYPE.yellowCard]: [EVENT_STATS.yellowCards],
  [FEED_TYPE.secondYellow]: [EVENT_STATS.redCards],
  [FEED_TYPE.redCard]: [EVENT_STATS.redCards],
  [FEED_TYPE.ownGoal]: [EVENT_STATS.ownGoals],
};

/** A half's minutes, and the break after the first, so a second-half line sorts after the first
 *  half's added time. */
const HALF_MINUTES = 45;
const HALF_TIME_MINUTES = 15;

interface Placed {
  line: PricedLine;
  /** About when it happened, which sorts the matches' lines among each other. */
  at: number;
  kickoff: number;
  /** Its place in its own match, newest first. */
  order: number;
}

/** Every line of the `matches`, newest first, each with its worth to the `players`. */
export function vidiprinter(
  matches: readonly VidiprinterMatch[],
  players: ReadonlyMap<PlayerCode, VidiprinterPlayer>,
  set: ScoringSet,
): PricedLine[] {
  const placed = matches.flatMap((match) => placedOf(match, players, set));
  return placed.toSorted((one, other) => other.at - one.at || other.kickoff - one.kickoff || one.order - other.order).map(({ line }) => line);
}

function placedOf(match: VidiprinterMatch, players: ReadonlyMap<PlayerCode, VidiprinterPlayer>, set: ScoringSet): Placed[] {
  const kickoff = match.kickoff ?? 0;
  const placed: Placed[] = [];
  // Oldest first, so each goal or card is counted in turn, and each line sorts no earlier than the
  // one before it: the full-time line's minute is always 1, and an untimed line has none.
  const counted = new Map<string, number>();
  // An untimed line sorts from when the lineups are out.
  let at = kickoff - LINEUPS_OUT_BEFORE_KICKOFF_MS;
  match.lines.toReversed().forEach((stored, index) => {
    at = Math.max(at, atMinute(kickoff, stored.minute ?? null, stored.addedMinute ?? null));
    const key = `${match.fixtureCode}:${stored.sourceId}`;
    const instructed: PricedLine[] = [];
    const line = { key, ...priced(stored, match.fixtureCode, players, set, counted, instructed) };
    const order = match.lines.length - index;
    // Each instruction it moved has its own line just above it: what it led to.
    for (const each of instructed) placed.push({ line: { ...each, key: `${key}${each.key}` }, at, kickoff, order: order - 0.5 });
    placed.push({ line, at, kickoff, order });
  });
  for (const line of thresholdLines(match, players, set)) {
    // A step with no clock read sorts at its match's kickoff, never before the lineups.
    placed.push({ line: line.line, at: line.minute === null ? kickoff : atMinute(kickoff, line.minute, null), kickoff, order: 0 });
  }
  return placed;
}

/** A stored line with its worth: the full-time line with the lineups' men's points in the match,
 *  a goal, an assist, a card or an own goal with the points it moves, its team instructions' moves
 *  apart, each put in `instructed` with a key to follow the line's. */
function priced(
  stored: StoredLine,
  fixtureCode: number,
  players: ReadonlyMap<PlayerCode, VidiprinterPlayer>,
  set: ScoringSet,
  counted: Map<string, number>,
  instructed: PricedLine[],
): Omit<PricedLine, "key"> {
  if (stored.type === FEED_TYPE.matchEnds) {
    const played = fullTimePoints(fixtureCode, players);
    return { text: withFullTimePoints(stored.text, played), points: null, priced: { fixtureCode, about: played.map(({ playerCode }) => playerCode), moves: [] } };
  }
  const codes = stored.playerCodes ?? [];
  const about = [...new Set(codes.filter((code): code is PlayerCode => code !== null && code !== undefined && players.has(code)))];
  const moves = (STATS_MOVED[stored.type ?? ""] ?? []).flatMap((stat, index) => {
    const code = codes[index];
    if (code === undefined || code === null) return [];
    const nth = (counted.get(tallyKey(code, stat)) ?? 0) + 1;
    counted.set(tallyKey(code, stat), nth);
    const player = players.get(code);
    const stats = player?.inMatch.get(fixtureCode)?.stats ?? null;
    // Not a man it is priced for, or his record not yet whole: nothing to price him by yet. The
    // line shows unpriced until a read brings it, as his slot shows "—".
    if (player === undefined || stats === null) return [];
    const when = stored.minute == null ? "" : `${stored.minute}${stored.addedMinute ? `+${stored.addedMinute}` : ""}' `;
    const moved = { before: { ...stats, [stat]: nth - 1 }, after: { ...stats, [stat]: nth } };
    instructed.push(...instructionLines(moved, { key: `:${stat}:${nth}`, when, fixtureCode, playerCode: code }, player, set));
    const points = inTenths(totalWith(stats, stat, nth, player, set) - totalWith(stats, stat, nth - 1, player, set));
    return points === 0 ? [] : [{ playerCode: code, name: player.name, points }];
  });
  return { text: stored.text, points: worth(moves, codes.length), priced: { fixtureCode, about, moves } };
}

/** One man's count of one stat, as a match's lines and steps tally them. */
const tallyKey = (playerCode: PlayerCode, stat: string) => `${playerCode}/${stat}`;

/** His match's total with `stat` at `actions`, the rest of his record as it stands, at his cell and
 *  in his role. */
function totalWith(stats: MatchStats, stat: string, actions: number, { cell, role }: VidiprinterPlayer, set: ScoringSet): number {
  return scoreMatch({ ...stats, [stat]: actions }, set, cell, role).total ?? 0;
}

/** The lineups' men who played in the match, most points first. */
function fullTimePoints(fixtureCode: number, players: ReadonlyMap<PlayerCode, VidiprinterPlayer>) {
  return [...players]
    .flatMap(([playerCode, { name, inLineup, inMatch }]) => {
      const his = inMatch.get(fixtureCode);
      return inLineup && his?.played && his.points !== null ? [{ playerCode, name, points: his.points }] : [];
    })
    .sort((one, other) => other.points - one.points || one.name.localeCompare(other.name));
}

/** Each step a man it is priced for made, priced at his cell, by his team's back line and in his
 *  role: a line where it moves his points, up or down. A step the same as the last shown for him
 *  and its stat (a feed's count put back and sent again, stored before falling steps were) is not
 *  shown twice. */
function thresholdLines(match: VidiprinterMatch, players: ReadonlyMap<PlayerCode, VidiprinterPlayer>, set: ScoringSet) {
  const lastShown = new Map<string, StoredStep>();
  return match.steps.flatMap((step, index) => {
    const player = players.get(step.playerCode);
    const key = tallyKey(step.playerCode, step.stat);
    const last = lastShown.get(key);
    if (player === undefined || (last !== undefined && last.from === step.from && last.to === step.to)) return [];
    const points = inTenths(stepPoints(step, set, player.cell, player.team?.scoring) + roleStep(step, match.fixtureCode, player, set));
    const when = step.minute === null ? "" : `~${step.minute}' `;
    const lineKey = `${match.fixtureCode}:step:${index}`;
    const instructed = instructionStep(step, { key: lineKey, when, fixtureCode: match.fixtureCode, playerCode: step.playerCode }, player, set);
    if (points === 0 && instructed.length === 0) return [];
    lastShown.set(key, step);
    const text = `${when}${player.name}: ${step.to} ${statWords(step.stat, set)}`;
    const line: PricedLine = {
      key: lineKey,
      text,
      points: worth([{ name: player.name, points }], 1),
      priced: { fixtureCode: match.fixtureCode, about: [step.playerCode], moves: [{ playerCode: step.playerCode, points }] },
    };
    // The step's own line only where it moved his points by its rules or role; each instruction it
    // moved just above it, as a goal's or a card's are.
    return [...instructed, ...(points === 0 ? [] : [line])].map((each) => ({ line: each, minute: step.minute }));
  });
}

/** What a step moves his role's points by (spec/05 Roles: whole points by bars): his role's points
 *  with the step's stat at its after, less at its before, the rest of his record as it stands, as
 *  a goal's line is priced. Nothing while his record isn't whole. */
function roleStep(step: StoredStep, fixtureCode: number, player: VidiprinterPlayer, set: ScoringSet): number {
  const stats = player.inMatch.get(fixtureCode)?.stats ?? null;
  if (stats === null) return 0;
  return roleTotal({ ...stats, [step.stat]: step.to }, set, player.role) - roleTotal({ ...stats, [step.stat]: step.from }, set, player.role);
}

/** "+4" for a line naming one man; "Saka +4, Ødegaard +3" for one naming more. */
function worth(moves: readonly { name: string; points: number }[], named: number): string | null {
  if (moves.length === 0) return null;
  if (named === 1) return signedWords(moves[0].points);
  return moves.map((move) => `${move.name} ${signedWords(move.points)}`).join(", ");
}

/** A stat as a threshold line says it: its name, lower-cased, an own stat's from the set. */
function statWords(stat: string, set: ScoringSet): string {
  if (!CATALOGUE_STATS.has(stat) && !set.ownStats?.some((own) => own.stat === stat)) {
    throw new Error(`no stat ${JSON.stringify(stat)} in the catalogue or the set's own stats`);
  }
  return categoryName(stat, set.ownStats).toLowerCase();
}

/** About when a minute of the match fell, as a line or the clock counts it: the second half's
 *  minutes past the break. An untimed line falls before any. */
function atMinute(kickoff: number, minute: number | null, addedMinute: number | null): number {
  if (minute === null) return Number.NEGATIVE_INFINITY;
  const elapsed = minute + (addedMinute ?? 0) + (minute > HALF_MINUTES ? HALF_TIME_MINUTES : 0);
  return kickoff + elapsed * MINUTE_MS;
}
