// What the matchup says, in one place for Craig to change in the pull request.

import type { Area } from "../../convex/lineup/pitch";
import { leagueAverageWords } from "../table/words";
import { LOCALE } from "../../convex/shared/moments";
import { clockWords, fullTime, gameweekWords, halfTime, versusWords, whenWords } from "../shared/words";

const kickoffFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "short", hour: "2-digit", minute: "2-digit" });

export { AREA_WORDS, figureWords, gameweekWords, noFigureWords, versusWords } from "../shared/words";
export { leagueAverageWords, scoreWords } from "../table/words";
export { nextGameweekLabel as nextLabel, nextGlyph, previousGameweekLabel as previousLabel, previousGlyph } from "../shared/words";

export const MATCHUP_TITLE = "Matchup";
/** The totals at the top, the score of the matchup (spec/10). */
export const SCORE_LABEL = "Score";
export const loadingWords = "Loading the matchup…";
export const noRulesWords = "This league was made before leagues had rules, so it has no matchups.";
export const totalPointsWords = "The league plays total points, so it has no head-to-heads.";
export const noTeamWords = "You run no team in this league.";
export const noGamesWords = (teamName: string) => `${teamName} has no head-to-heads: fixtures are drawn once the league has two teams.`;
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

export const lineupLabel = (teamName: string) => `${teamName}'s lineup`;
export { BENCH_TITLE } from "../myTeam/tactics/words";
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
  yetToPlay: (kickoff: number | null) => (kickoff === null ? "To play" : kickoffFormat.format(kickoff)),
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

/** A side's formation, as managers say it ("4-2-3-1"), on its panel's plate; its name read out. */
export const formationWords = (counts: readonly number[]) => counts.join("-");
export { presetLabel as formationLabel } from "../myTeam/tactics/words";

/** What the auto-subs did with him (spec/05, Auto-subs). */
export const autoSubWords = {
  off: (playerName: string) => `Didn't play: ${playerName} on`,
  on: (playerName: string) => `On for ${playerName}`,
  unreplaced: "Didn't play: no one could come on",
} as const;

/** Read out for a bench player whose points don't count, greyed on screen (spec/14, On screen). */
export const notCountingLabel = "not counting";

/** The matchup's commentary (spec/10): every line of every match either team's men play in. */
export const VIDIPRINTER_TITLE = "Vidiprinter";
/** When the stream falls behind or stops; points carry on from FPL (spec/10, The commentary). */
export const commentaryDelayedWords = "Commentary delayed";
export const noCommentaryWords = "No lines yet.";
export const unreadCommentaryWords = (reason: string) => `The commentary can't be shown: ${reason}.`;
