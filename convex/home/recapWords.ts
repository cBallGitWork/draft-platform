import type { Words } from "../mail/letterShape";

// What league home's weekly recap says (spec/12, League home; #387), in one place for Craig to
// change: the brief Claude writes it from, how it is told to write, and Mail's letter that it is up.

/** The most top performers, and the most letdowns, the recap names (Craig, 6 Nov 2026). */
export const RECAP_PLAYERS = 3;

/** What the recap is written from: facts only. */
export interface RecapBrief {
  gameweek: number;
  /** Each head-to-head's result; none in total points. */
  results: readonly { team: string; teamPoints: number; opponent: string; opponentPoints: number }[];
  /** Each team's points, most first, and its points left on the bench. */
  teams: readonly { team: string; points: number; benchPoints: number }[];
  /** The league's starters who scored most for their team, most first. */
  topPerformers: readonly RecapPlayer[];
  /** The league's starters who scored least for their team, least first. */
  letdowns: readonly RecapPlayer[];
}

export interface RecapPlayer {
  player: string;
  team: string;
  points: number;
}

/** The longest recap Claude may write, in tokens: room for about 150 words. */
export const RECAP_MAX_TOKENS = 400;

/** How Claude is told to write the recap: facts only, about 150 words (Craig, 6 Nov 2026). */
export const RECAP_SYSTEM = [
  "You write the weekly recap for a Premier League fantasy draft league, read by all its managers.",
  "Write about 150 words of plain prose in UK English, with no headings, lists or markdown.",
  "Cover the results, the top performers and the letdowns from the starting elevens, and the points each team left on its bench.",
  "Use only the facts given: never invent a fact, a quote or a reason.",
].join(" ");

const playerLine = ({ player, team, points }: RecapPlayer) => `${player} (${team}): ${points}`;

/** The brief as Claude reads it. */
export function recapPrompt({ gameweek, results, teams, topPerformers, letdowns }: RecapBrief): string {
  return [
    `Gameweek ${gameweek}, every match final.`,
    ...(results.length === 0
      ? []
      : ["Results:", ...results.map(({ team, teamPoints, opponent, opponentPoints }) => `${team} ${teamPoints}, ${opponent} ${opponentPoints}`)]),
    "Teams' points, and points left on the bench:",
    ...teams.map(({ team, points, benchPoints }) => `${team}: ${points}, bench ${benchPoints}`),
    "Top performers, points for their team:",
    ...topPerformers.map(playerLine),
    "Letdowns, points for their team:",
    ...letdowns.map(playerLine),
  ].join("\n");
}

/** To the whole league, once the recap is written: that it is up (spec/16). */
export function recapUpLetter(gameweek: number): Words {
  return { subject: `The gameweek ${gameweek} recap is up`, body: `Gameweek ${gameweek} is final, and its recap is on League home.` };
}
