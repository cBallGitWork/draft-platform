// What the matchup says, in one place for Craig to change in the pull request.

import type { MatchBreakdown, MatchupSide, SlotStatus } from "../../convex/matchup/matchupShape";
import {
  clockWords,
  fewestTeamsWords,
  fullTime,
  gameweekWords,
  halfTime,
  leagueAverageWords,
  noHeadToHeadsTotalPointsWords,
  overrideLabels,
  removeOverrideWords,
  scoreWords,
  versusWords,
  weekdayTimeWords,
  weekdayWords,
  whenWords,
} from "../shared/words";

export { figureWords, gameweekShort, gameweekWords, noFigureWords, versusWords } from "../shared/words";
export { leagueAverageWords, scoreWords } from "../shared/words";
export { nextGameweekLabel as nextLabel, nextGlyph, previousGameweekLabel as previousLabel, previousGlyph } from "../shared/words";

export const MATCHUP_TITLE = "Matchup";
/** The totals at the top, the score of the matchup (spec/10). */
export { SCORE_LABEL } from "../shared/words";
export const loadingWords = "Loading the matchup…";
export const totalPointsWords = noHeadToHeadsTotalPointsWords;
export { noTeamWords } from "../shared/words";
export const noGamesWords = (teamName: string) => `${teamName} has no head-to-heads: fixtures are drawn once the league has ${fewestTeamsWords}.`;
export const noGameWords = (teamName: string, gameweek: number) => `${teamName} plays no head-to-head in ${gameweekWords(gameweek)}.`;
export const byeWords = (teamName: string) => `${teamName} has a bye this gameweek.`;
/** Before the deadline: no lineup is shown, the manager's own is on My team. */
export const notBegunWords = (deadline: number | null) =>
  `Line-ups show at the deadline${deadline === null ? "" : `, ${whenWords(deadline)}`}.`;
export const unscoredWords = (reason: string) => `This matchup can't be scored, so it counts for nothing in the table: ${reason}.`;
export const averageWords = "Every team counted once.";
/** A side's or an opponent's name: its team's, or the league's average. */
export const sideName = (side: { kind: "team"; teamName: string } | { kind: Exclude<MatchupSide["kind"], "team"> }) =>
  side.kind === "team" ? side.teamName : leagueAverageWords;

/** Under the score: live and moving, or settled. */
export { provisionalWords } from "../shared/words";
export const finalWords = "Final";

/** A fixture's link to its matchup, from the table's fixtures and league home's head-to-heads. */
export const matchupLinkLabel = (team: string, opponent: string | null, gameweek: number) =>
  `${team} ${versusWords} ${opponent ?? leagueAverageWords}, ${gameweekWords(gameweek)}: the matchup`;

/** The switch between a team's games in a gameweek, in a league playing more than one (#521):
 *  "Game 1 v Dave", or "Game 2 bye". */
export const GAME_SWITCH_LABEL = "Game";
export const gameSwitchWords = (game: number, opponent: string | null) => `${GAME_SWITCH_LABEL} ${game} ${opponent === null ? "bye" : `${versusWords} ${opponent}`}`;

/** A side's pitch (spec/10, The matchup, as a live match; #850), and each man on it: "Haaland, ST
 *  Poacher, 13". */
export const sidePitchLabel = (teamName: string) => `${teamName}'s pitch`;
export const pitchPlayerLabel = (name: string, position: string, role: string, points: string) => `${name}, ${position} ${role}, ${points}`;
export { BENCH_TITLE } from "../shared/words";
/** Each side's panel's title (the approved picture): its team's name, read out, is the panel's. */
export const LINEUP_TITLE = "Line-up";
/** A side's bench, a row of tiles (the approved picture), and each man in it. */
export const benchLabel = (teamName: string) => `${teamName}'s bench`;
/** On a tile's shirt where his match's state goes: a starter who didn't play and was replaced. */
export const offWords = "Off";
/** A side nobody runs, its lineup the auto team's (#1207): the shared chip's words. */
export { autoTeamWords } from "../shared/words";
/** A side's formation once its manager has edited it off every preset (Craig, 1 Nov 2026, #878:
 *  "only preset formations", a changed one "Custom"). */
export const customFormationWords = "Custom";
/** Under each team's name: how many of the men standing for it have played, are on and are still
 *  to play (the approved picture: "2 played, 6 live, 3 to play"). */
export const standingWords = { played: (count: number) => `${count} played`, live: (count: number) => `${count} live`, toPlay: (count: number) => `${count} to play` };
/** The breakdown's head: his slot's role and his team ("Target man, Kroos Control"). */
export const breakdownRoleWords = (role: string | null, teamName: string) => (role === null ? teamName : `${role}, ${teamName}`);

/** His match, as the status column says it. */
export const statusWords = {
  /** His kickoff, short as the column is: "Sat 15:00". */
  yetToPlay: (kickoff: number | null) => (kickoff === null ? "To play" : weekdayTimeWords(kickoff)),
  /** His match's clock, as the Premier League's pages show it: "45+1'", "HT" at half-time, or
   *  "Live" before it has a minute. */
  playing: clockWords,
  finished: fullTime.short,
  noMatch: "No match",
} as const;
/** His match's state, short, as the status column and his tile on the pitch say it. */
export function statusText(status: SlotStatus): string {
  switch (status.kind) {
    case "yetToPlay":
      return statusWords.yetToPlay(status.kickoff);
    case "playing":
      return statusWords.playing(status.state, status.clockLabel, status.minute);
    case "finished":
      return statusWords.finished;
    case "noMatch":
      return statusWords.noMatch;
  }
}
/** His match's state as the badge on his tile's shirt says it (the approved picture): the clock or
 *  "FT" as the status column has them, but before he plays the day alone ("Sun"), his kickoff's time
 *  read out in the tile's label. */
export function badgeText(status: SlotStatus): string {
  return status.kind === "yetToPlay" && status.kickoff !== null ? weekdayWords(status.kickoff) : statusText(status);
}
/** The same, in full for screen readers. */
export const statusLabels = {
  yetToPlay: "Yet to play",
  playing: "Playing now",
  /** His match at half-time, said in full where the column shows "HT". */
  halfTime: halfTime.long,
  finished: "Finished",
  noMatch: "No match this gameweek",
} as const;

/** What the auto-subs did with him (spec/05, Auto-subs). */
export const autoSubWords = {
  off: (playerName: string) => `Didn't play: ${playerName} on`,
  on: (playerName: string) => `On for ${playerName}`,
  unreplaced: "Didn't play: no one could come on",
} as const;

/** Read out for a bench player whose points don't count, greyed on screen (spec/14, On screen). */
export { notCountingLabel } from "../shared/words";

/** A player's breakdown for the gameweek, opened by tapping his name (spec/10; #798). */
export const openBreakdownLabel = (name: string) => `${name}: why his points`;
export { playerCardWords } from "../shared/words";
export const closeBreakdownLabel = "Close";
/** One of his matches, opening its page, named by its clubs and score with its clock (the approved
 *  picture's "NFO 1–0 BRE 67'", "NFO 1–0 BRE FT"); before kickoff, "NFO v BRE Sat 15:00". With a
 *  club the football sync doesn't hold, by its kickoff alone ("Sat 15:00"). */
export const breakdownMatchWords = ({ home, away, kickoff, score }: Pick<MatchBreakdown, "home" | "away" | "kickoff" | "score">) => {
  if (home === null || away === null) return kickoff === null ? "His match" : weekdayTimeWords(kickoff);
  if (score === null || score.state === "upcoming") return [home, versusWords, away, ...(kickoff === null ? [] : [weekdayTimeWords(kickoff)])].join(" ");
  const goals = score.homeGoals !== null && score.awayGoals !== null ? scoreWords(score.homeGoals, score.awayGoals) : versusWords;
  const when = score.state === "fullTime" ? fullTime.short : clockWords(score.state, score.clockLabel, score.minutes);
  return `${home} ${goals} ${away} ${when}`;
};
/** Under best match, the lower of his double gameweek's two (spec/03; Craig, 6 Nov 2026). */
export const notCountedWords = "Not counted: best match";
export const noMatchBreakdownWords = "No match this gameweek.";
/** The team override under each team's name, for whoever runs the league (spec/14 S14.3 to S14.6;
 *  #903): "set the total". The rest of its words are the player card's override's, in shared. */
export const OVERRIDE_TOTAL_TITLE = "Override total";
export const overrideTotalLabel = (teamName: string) => `${OVERRIDE_TOTAL_TITLE}: ${teamName}`;
export const removeTotalOverrideLabel = (teamName: string) => `${removeOverrideWords}: ${teamName}`;
export const overrideTotalLabels = { points: "Total", reason: overrideLabels.reason } as const;
export const totalOverrideRemovedWords = "Override removed: the scored total is back, and the league has a letter.";
export {
  cancelWords as cancelOverrideWords,
  notArrivedWords,
  overriddenDoneWords,
  overriddenWords,
  overrideFailedWords,
  overrideHint,
  overrideWords,
  removeOverrideFailedWords,
  removeOverrideWords,
} from "../shared/words";

/** The matchup's commentary (spec/10): every line of every match either team's men play in; when
 *  the stream falls behind or stops; points carry on from FPL (spec/10, The commentary). */
export { commentaryDelayedWords, noCommentaryWords, VIDIPRINTER_TITLE } from "../shared/words";
export const unreadCommentaryWords = (reason: string) => `The commentary can't be shown: ${reason}.`;
/** Its head row over the lines, and each team's column of what a line moves its score by (the
 *  approved picture's "Commentary", "Saka P", "Kroos C"): a team's first word and the first
 *  letter of its second, read out in full beside each figure. */
export const commentaryColumnWords = "Commentary";
/** The column before it, each line's minute in its own cell (the approved picture's "Min", "67'",
 *  "~61'", "45+1'", "KO", "FT"). */
export const minuteColumnWords = "Min";
/** A line's leading minute, as the commentary writers put it ("67' GOAL…", "~61' Rice: …", "KO ARS
 *  v LIV", "FT ARS 2–1 LIV"), split from the rest; a line with none has an empty minute. */
const LEADING_MINUTE = /^(~?\d+(?:\+\d+)?'|KO|FT)\s+(.*)$/s;
export const splitMinute = (text: string): { minute: string; rest: string } => {
  const found = LEADING_MINUTE.exec(text);
  return found === null ? { minute: "", rest: text } : { minute: found[1], rest: found[2] };
};
export const columnHeadWords = (teamName: string) => {
  const [first = "", second] = teamName.trim().split(/\s+/);
  return second === undefined ? first : `${first} ${[...second][0]}`;
};
/** Read out on each line about the man whose breakdown is open, marked with the cyan edge. */
export const markedLineLabel = (name: string) => `(${name})`;
