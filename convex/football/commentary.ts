// Our own commentary: one match's Premier League lines, as `commentaryLines` maps them, written as
// short CM-terse lines ("62' GOAL Saka, assist Ødegaard") with a kick-off and a full-time line
// (spec/10, The commentary; #43). Pure: the live tick reads the stream and stores the lines
// (matchCommentary.ts).
// Championship Manager's and Football Manager's commentary is a style reference only; none of it
// is copied.

import type { CommentaryLine } from "./plCommentary";

/** The match as the full-time line shows it: each club's short name ("ARS") and its goals. */
export interface MatchHeader {
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
}

/** A man's points in the match, for the full-time line. Taken as given: the caller scores them. */
export interface PlayerPoints {
  code: number;
  points: number;
}

export interface WrittenLine {
  /** The feed line it was written from, so a later read can replace it. */
  sourceId: number;
  text: string;
  /** The feed line's minute, type and men, as `commentaryLines` gives them: what the matchup sorts
   *  its matches' lines by, prices a goal, an assist or a card by, and finds the full-time line by (#44). */
  minute: number | null;
  addedMinute: number | null;
  type: string;
  playerCodes: (number | null)[];
}

export interface WrittenCommentary {
  /** Newest first, as the feed's: a vidiprinter. */
  lines: WrittenLine[];
  /** Lines of a type with no wording here: kept out of `lines`, and reported, never dropped
   *  unseen. docs/pl-commentary.md lists the types seen. */
  unworded: CommentaryLine[];
}

/** What the writer needs from outside the stream. */
export interface CommentaryInput {
  header: MatchHeader;
  /** Each man the lines name, by FPL code, as FPL shows him (`web_name`: "Saka"). */
  nameByCode: ReadonlyMap<number, string>;
  /** The full-time line's points, in the order the line lists them. */
  fullTimePoints: readonly PlayerPoints[];
}

/** For a man the feed names but FPL does not list (`commentaryLines` reports him as unmatched). */
export const UNLISTED_NAME = "unknown";

const SCORE_DASH = "–";

/** The feed's types this file words or deliberately leaves out. */
export const FEED_TYPE = {
  lineup: "lineup",
  start: "start",
  end1: "end 1",
  end2: "end 2",
  matchEnds: "end 14",
  addedTime: "added time",
  startDelay: "start delay",
  endDelay: "end delay",
  goal: "goal",
  penaltyGoal: "penalty goal",
  ownGoal: "own goal",
  varCancelledGoal: "VAR cancelled goal",
  miss: "miss",
  attemptSaved: "attempt saved",
  attemptBlocked: "attempt blocked",
  post: "post",
  yellowCard: "yellow card",
  secondYellow: "secondyellow card",
  redCard: "red card",
  substitution: "substitution",
  corner: "corner",
  offside: "offside",
  freeKickLost: "free kick lost",
  freeKickWon: "free kick won",
  penaltyWon: "penalty won",
  penaltyLost: "penalty lost",
  refereeDecision: "contentious referee decisions",
  playerRetired: "player retired",
} as const;

/** One line's names, by the part the feed's order gives each man (docs/pl-commentary.md). */
type Named = (index: number) => string;

/** Each worded type's line after its minute. Kick-off and full time are written apart. */
const WORDING: Readonly<Record<string, (man: Named, line: CommentaryLine) => string>> = {
  [FEED_TYPE.lineup]: () => "Lineups out",
  [FEED_TYPE.end1]: () => "HT",
  [FEED_TYPE.start]: () => "Second half",
  [FEED_TYPE.addedTime]: () => "Added time",
  [FEED_TYPE.startDelay]: () => "Delay",
  [FEED_TYPE.endDelay]: () => "Play on",
  [FEED_TYPE.goal]: (man, line) => withAssist(`GOAL ${man(0)}`, man, line),
  [FEED_TYPE.penaltyGoal]: (man) => `GOAL ${man(0)}, penalty`,
  [FEED_TYPE.ownGoal]: (man) => `OWN GOAL ${man(0)}`,
  [FEED_TYPE.varCancelledGoal]: (man) => `NO GOAL ${man(0)}, VAR`,
  [FEED_TYPE.miss]: (man) => `SHOT ${man(0)}, off target`,
  [FEED_TYPE.attemptSaved]: (man) => `SHOT ${man(0)}, saved`,
  [FEED_TYPE.attemptBlocked]: (man) => `SHOT ${man(0)}, blocked`,
  [FEED_TYPE.post]: (man) => `SHOT ${man(0)}, off the woodwork`,
  [FEED_TYPE.yellowCard]: (man) => `YELLOW ${man(0)}`,
  [FEED_TYPE.secondYellow]: (man) => `RED ${man(0)}, second yellow`,
  [FEED_TYPE.redCard]: (man) => `RED ${man(0)}`,
  [FEED_TYPE.substitution]: (man) => `SUB ${man(0)} on, ${man(1)} off`,
  [FEED_TYPE.corner]: (man) => `Corner, conceded by ${man(0)}`,
  [FEED_TYPE.offside]: (man) => `Offside ${man(1)}`,
  [FEED_TYPE.freeKickLost]: (man) => `Foul ${man(0)}`,
  [FEED_TYPE.freeKickWon]: (man) => `Free kick ${man(0)}`,
  [FEED_TYPE.penaltyWon]: (man) => `PENALTY won by ${man(0)}`,
  [FEED_TYPE.penaltyLost]: (man) => `PENALTY conceded by ${man(0)}`,
  [FEED_TYPE.refereeDecision]: (man, line) => (line.playerCodes.length === 0 ? "VAR" : `VAR ${man(0)}`),
  [FEED_TYPE.playerRetired]: (man) => `OFF INJURED ${man(0)}`,
};

/** The match's lines written, in the feed's order. The oldest "start" is the kick-off; a man the
 *  input has no name for is a caller's mistake and throws. */
export function writeCommentary(stream: readonly CommentaryLine[], input: CommentaryInput): WrittenCommentary {
  const kickOff = stream.findLast((line) => line.type === FEED_TYPE.start);
  const lines: WrittenLine[] = [];
  const unworded: CommentaryLine[] = [];
  for (const line of stream) {
    // The second half ends one line before the match does; full time is written once, from "Match ends".
    if (line.type === FEED_TYPE.end2) continue;
    const text = textOf(line, line === kickOff, input);
    if (text === null) unworded.push(line);
    else lines.push({ sourceId: line.id, text, minute: line.minute, addedMinute: line.addedMinute, type: line.type, playerCodes: line.playerCodes });
  }
  return { lines, unworded };
}

function textOf(line: CommentaryLine, isKickOff: boolean, input: CommentaryInput): string | null {
  const { header } = input;
  if (isKickOff) return `KO ${header.home} v ${header.away}`;
  if (line.type === FEED_TYPE.matchEnds) return fullTime(input);
  const wording = WORDING[line.type];
  if (wording === undefined) return null;
  const words = wording((index) => nameOf(line, index, input.nameByCode), line);
  return line.minute === null ? words : `${minuteOf(line.minute, line.addedMinute)} ${words}`;
}

/** "FT ARS 2–1 CHE: Saka 11, Palmer 6"; with no one to list, the score alone. */
function fullTime({ header, nameByCode, fullTimePoints }: CommentaryInput): string {
  const score = `FT ${header.home} ${header.homeGoals}${SCORE_DASH}${header.awayGoals} ${header.away}`;
  return withFullTimePoints(score, fullTimePoints.map((each) => ({ name: named(each.code, nameByCode), points: each.points })));
}

/** The full-time line's score with each man's points after it, in the order given: the writer's,
 *  and the matchup's, which adds its own lineups' men to the stored line (#44). */
export function withFullTimePoints(score: string, points: readonly { name: string; points: number }[]): string {
  if (points.length === 0) return score;
  return `${score}: ${points.map((each) => `${each.name} ${each.points}`).join(", ")}`;
}

/** "62'", "45+2'". */
function minuteOf(minute: number, addedMinute: number | null): string {
  return addedMinute ? `${minute}+${addedMinute}'` : `${minute}'`;
}

/** A goal's assister is the second man it names; a first read can name only the scorer. */
function withAssist(words: string, man: Named, line: CommentaryLine): string {
  return line.playerCodes.length > 1 ? `${words}, assist ${man(1)}` : words;
}

function nameOf(line: CommentaryLine, index: number, nameByCode: ReadonlyMap<number, string>): string {
  if (index >= line.playerCodes.length) {
    throw new Error(`commentary line ${line.id} (${line.type}) names ${line.playerCodes.length} men, not a man ${index + 1}`);
  }
  const code = line.playerCodes[index];
  return code === null ? UNLISTED_NAME : named(code, nameByCode);
}

function named(code: number, nameByCode: ReadonlyMap<number, string>): string {
  const name = nameByCode.get(code);
  if (name === undefined) throw new Error(`no name given for FPL code ${code}`);
  return name;
}
