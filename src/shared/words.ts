// What every screen says alike, in one place for Craig to change in the pull request.

import type { PlayingState } from "../../convex/football/matchScores";
import type { Position } from "../../convex/positions/positionTables";
import { LOCALE } from "../../convex/shared/moments";
import { figureWords } from "../../convex/shared/numberWords";

/** A squad's row whose player the football sync doesn't hold, in place of his name: the Tactics
 *  tab has it from the server, which words it. */
export { unheldPlayerWords } from "../../convex/shared/players";
/** Above a screen holding such a row (Craig, 31 Oct 2026, #323). */
export const unheldNoticeWords = "Some football data is missing: a player's row says so in place of his name. Tell the admin.";

/** The pitch's areas, as the rules screens name them: the server's refusals name them too. */
export { AREA_WORDS } from "../../convex/lineup/pitchWords";

/** Each position by name, for a short code's hover (positionTables.ts has the codes). */
export const POSITION_NAMES: Record<Position, string> = {
  GK: "Goalkeeper",
  CB: "Centre-back",
  FB: "Full-back",
  WB: "Wing-back",
  CDM: "Defensive midfielder",
  CM: "Central midfielder",
  WM: "Wide midfielder",
  CAM: "Attacking midfielder",
  W: "Winger",
  SS: "Second striker",
  ST: "Striker",
};
/** A sweeper's slot label, SW, by name: a slot's label but no player's position (spec/05). */
export const sweeperName = "Sweeper";

/** What a screen says when a change or a read failed for any reason but the server's refusal (src/shared/refusal.ts):
 *  `outcome` is what that left, such as "nothing changed". */
export const failedWords = (outcome: string) => `Something went wrong, so ${outcome}. Check your connection and try again.`;
/** When a change failed before the server could say why: the connection, or the server itself. */
export const changeFailedWords = failedWords("nothing changed");

/** What the live app shows when it was built with no Convex deployment to reach (liveApp.tsx). */
export const NO_CONVEX_URL = "VITE_CONVEX_URL isn't set, so the app can't reach Convex: `npm run setup` writes it to .env.local (docs/setup.md).";

/** A gameweek by name, as its tick box and the fixtures' stepper say it. */
export const gameweekWords = (gameweek: number) => `Gameweek ${gameweek}`;
/** The fixtures' stepper (src/ui/GameweekStepper.tsx): each arrow's label, and CM's arrows,
 *  decoration, as each button carries its label. */
export const previousGameweekLabel = "Previous gameweek";
export const nextGameweekLabel = "Next gameweek";
export const previousGlyph = "◄";
export const nextGlyph = "►";
/** A panel's or a window's cross, decoration, as its button carries its label. */
export const closeGlyph = "✕";
/** A sortable table's heads (src/ui/ColumnHeads.tsx): beside the column sorted by, which way, as
 *  decoration, since the head says so to screen readers through aria-sort; and, for screen
 *  readers, what pressing a head does. */
export const ascendingGlyph = "▲";
export const descendingGlyph = "▼";
export const sortByLabel = (column: string) => `Sort by ${column}`;
/** The spoken name of anything showing short words with long ones on hover: the short words it
 *  shows, then its long ones, "GW, Gameweek", or the words once where they're the same, so a
 *  voice-control user can say the words they see (WCAG 2.5.3, label in name; decided 31 Oct 2026,
 *  #775; the Squad's next match, #790). */
export const shortThenLongName = ({ short, long }: { short: string; long: string }) => (short === long ? long : `${short}, ${long}`);
/** A column head's spoken name (src/ui/ColumnHeads.tsx). */
export const columnHeadName = shortThenLongName;
/** A stat, as a column of stats or the choice of one is headed. */
export const STAT_WORD = "Stat";

const whenFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
/** A time in the viewer's own zone, e.g. "Sat 17 Oct, 13:00": a deadline, a feed's last run. */
export const whenWords = (at: number) => whenFormat.format(at);
const timeOfDayFormat = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" });
/** The time of day alone, in the viewer's own zone: "15:00", a kickoff or when a letter was filed. */
export const timeOfDayWords = (at: number) => timeOfDayFormat.format(at);

/** Every number a screen shows, with the one minus sign: "−3", and signed, "+4". */
export { figureWords, signedWords } from "../../convex/shared/numberWords";

/** A figure not there yet, such as points before a match's record has arrived. */
export const noFigureWords = "—";
/** A player no team in the league owns. */
export const freeAgentWords = "Free agent";
/** Between the items of a short list in a line: a player's positions, "CDM, CM". */
export const listSeparator = ", ";

/** Between the two sides of a match or a fixture: "Hull City v Everton". */
export const versusWords = "v";
/** A match's or a fixture's score, the first side's then the other's: "2–1", or a matchup's
 *  points, which can fall below 0: "−2–5". */
export const scoreWords = (first: number, second: number) => `${figureWords(first)}–${figureWords(second)}`;
/** Beside what is still being played: a live match's clock before it has a minute, a score that
 *  may still move (spec/07). */
export const liveWords = "Live";
/** Under points, or a table, that a live match may still move: the state, not how it works. */
export const provisionalWords = "Provisional";
/** A match at half-time and at full time, short as a column says it and in full. */
export const halfTime = { short: "HT", long: "Half-time" } as const;
export const fullTime = { short: "FT", long: "Full time" } as const;
/** A match's one clock while it is played, on the matchup and the Premier League's pages alike:
 *  "HT" at half-time; otherwise the Premier League's label, with stoppage time ("45+1'"), or the
 *  newest read's whole minutes where it has none (FPL's: "46'"); "Live" before either (spec/10,
 *  The matchup, as a live match; #563, #781). */
export const clockWords = (state: PlayingState, clockLabel: string | null, minutes: number | null) => {
  if (state === "halfTime") return halfTime.short;
  const label = clockLabel?.split("'")[0];
  if (label) return `${label}'`;
  return minutes === null ? liveWords : `${minutes}'`;
};

/** The "Find a player" panel, on the admin's dashboard and the squads page alike; each says its own hint. */
export const findTitle = "Find a player";
export const findLabel = "Name";
export const searchingWords = "Searching…";
export const noneFoundWords = "No player of that name in the Premier League.";
export const foundListLabel = "Players found";
