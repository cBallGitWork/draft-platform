// What the matchup says, in one place for Craig to change in the pull request.

import type { Area } from "../../convex/lineup/pitch";
import { leagueAverageWords } from "../table/words";
import { overrideLabels, removeOverrideWords } from "../playerCard/words";
import {
  clockWords,
  fewestTeamsWords,
  fullTime,
  gameweekWords,
  halfTime,
  noHeadToHeadsTotalPointsWords,
  versusWords,
  weekdayTimeWords,
  whenWords,
} from "../shared/words";

export { AREA_WORDS, figureWords, gameweekWords, noFigureWords, versusWords } from "../shared/words";
export { leagueAverageWords, scoreWords } from "../table/words";
export { nextGameweekLabel as nextLabel, nextGlyph, previousGameweekLabel as previousLabel, previousGlyph } from "../shared/words";

export const MATCHUP_TITLE = "Matchup";
/** The totals at the top, the score of the matchup (spec/10). */
export const SCORE_LABEL = "Score";
export const loadingWords = "Loading the matchup…";
export const noRulesWords = "This league was made before leagues had rules, so it has no matchups.";
export const totalPointsWords = noHeadToHeadsTotalPointsWords;
export const noTeamWords = "You run no team in this league.";
export const noGamesWords = (teamName: string) => `${teamName} has no head-to-heads: fixtures are drawn once the league has ${fewestTeamsWords}.`;
export const noGameWords = (teamName: string, gameweek: number) => `${teamName} plays no head-to-head in ${gameweekWords(gameweek)}.`;
export const byeWords = (teamName: string) => `${teamName} has a bye this gameweek.`;
/** Before the deadline: no lineup is shown, the manager's own is on My team. */
export const notBegunWords = (deadline: number | null) =>
  `Lineups show at the deadline${deadline === null ? "" : `, ${whenWords(deadline)}`}.`;
export const unscoredWords = (reason: string) => `This matchup can't be scored, so it counts for nothing in the table: ${reason}.`;
export const averageWords = "Every team counted once.";

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

export const lineupLabel = (teamName: string) => `${teamName}'s lineup`;
export { BENCH_TITLE } from "../shared/words";
export const columns = {
  area: { short: "Pos", long: "Area" },
  player: { short: "Player", long: "Player" },
  status: { short: "Match", long: "His match" },
  points: { short: "Pts", long: "Points" },
} as const;

/** Each area's short code, its name on hover. */
export const AREA_CODES: Record<Area, string> = {
  goalkeeper: "GK",
  defence: "DEF",
  defensiveMidfield: "DM",
  midfield: "MID",
  attackingMidfield: "AM",
  attack: "ATT",
};

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
export const notCountingLabel = "not counting";

/** A player's breakdown for the gameweek, opened by tapping his name (spec/10; #798). */
export const openBreakdownLabel = (name: string) => `${name}: why his points`;
export { closeGlyph, playerCardWords } from "../shared/words";
export const closeBreakdownLabel = "Close";
/** One of his matches, named by its kickoff ("Sat 15:00"), opening its page. */
export const breakdownMatchWords = (kickoff: number | null) => (kickoff === null ? "His match" : weekdayTimeWords(kickoff));
/** Under best match, the lower of his double gameweek's two (spec/03; Craig, 6 Nov 2026). */
export const notCountedWords = "Not counted: best match";
export const noMatchBreakdownWords = "No match this gameweek.";
/** The team override under each team's name, for whoever runs the league (spec/14 S14.3 to S14.6;
 *  #903): "set the total". The rest of its words are the player card's override's. */
export const OVERRIDE_TOTAL_TITLE = "Override total";
export const overrideTotalLabel = (teamName: string) => `${OVERRIDE_TOTAL_TITLE}: ${teamName}`;
export const removeTotalOverrideLabel = (teamName: string) => `${removeOverrideWords}: ${teamName}`;
export const overrideTotalLabels = { points: "Total", reason: overrideLabels.reason } as const;
export const totalOverrideRemovedWords = "Override removed: the scored total is back, and the league has a letter.";
export {
  cancelOverrideWords,
  notArrivedWords,
  overriddenDoneWords,
  overriddenWords,
  overrideFailedWords,
  overrideHint,
  overrideWords,
  removeOverrideFailedWords,
  removeOverrideWords,
} from "../playerCard/words";

/** The matchup's commentary (spec/10): every line of every match either team's men play in. */
export const VIDIPRINTER_TITLE = "Vidiprinter";
/** When the stream falls behind or stops; points carry on from FPL (spec/10, The commentary). */
export const commentaryDelayedWords = "Commentary delayed";
export const noCommentaryWords = "No lines yet.";
export const unreadCommentaryWords = (reason: string) => `The commentary can't be shown: ${reason}.`;
