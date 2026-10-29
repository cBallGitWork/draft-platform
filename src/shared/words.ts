// What every screen says alike, in one place for Craig to change in the pull request.

import type { Position } from "../../convex/positions/positionTables";
import { LOCALE } from "../../convex/shared/moments";

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

/** What a screen says when a change or a read failed for any reason but the server's refusal (src/shared/refusal.ts):
 *  `outcome` is what that left, such as "nothing changed". */
export const failedWords = (outcome: string) => `Something went wrong, so ${outcome}. Check your connection and try again.`;
/** When a change failed before the server could say why: the connection, or the server itself. */
export const changeFailedWords = failedWords("nothing changed");

/** What the live app shows when it was built with no Convex deployment to reach (liveApp.tsx). */
export const NO_CONVEX_URL = "VITE_CONVEX_URL isn't set, so the app can't reach Convex: `npm run setup` writes it to .env.local (docs/setup.md).";

/** A gameweek by name, as its tick box and the fixtures' stepper say it. */
export const gameweekWords = (gameweek: number) => `Gameweek ${gameweek}`;
/** The fixtures' stepper (src/frame/GameweekStepper.tsx): each arrow's label, and CM's arrows,
 *  decoration, as each button carries its label. */
export const previousGameweekLabel = "Previous gameweek";
export const nextGameweekLabel = "Next gameweek";
export const previousGlyph = "◄";
export const nextGlyph = "►";

const whenFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
/** A time in the viewer's own zone, e.g. "Sat 17 Oct, 13:00": a deadline, a feed's last run. */
export const whenWords = (at: number) => whenFormat.format(at);

/** A figure not there yet, such as points before a match's record has arrived. */
export const noFigureWords = "—";
/** A player no team in the league owns. */
export const freeAgentWords = "Free agent";
/** Between the items of a short list in a line: a player's positions, "CDM, CM". */
export const listSeparator = ", ";

/** Between the two sides of a match or a fixture: "Hull City v Everton". */
export const versusWords = "v";
/** A match's or a fixture's score, the first side's then the other's: "2–1". */
export const scoreWords = (first: number, second: number) => `${first}–${second}`;
/** Beside what is still being played: a live match's clock before it has a minute, a score that
 *  may still move (spec/07). */
export const liveWords = "Live";

/** The "Find a player" panel, on the admin's dashboard and the squads page alike; each says its own hint. */
export const findTitle = "Find a player";
export const findLabel = "Name";
export const searchingWords = "Searching…";
export const noneFoundWords = "No player of that name in the Premier League.";
export const foundListLabel = "Players found";
