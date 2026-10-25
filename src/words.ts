// What every screen says alike, in one place for Craig to change in the pull request.

import type { Area } from "../convex/lineup/pitch";
import { LOCALE } from "../convex/shared/londonTime";

/** The pitch's areas, as the rules screens name them. */
export const AREA_WORDS: Record<Area, string> = {
  goalkeeper: "Goalkeeper",
  defence: "Defence",
  defensiveMidfield: "Defensive midfield",
  midfield: "Midfield",
  attackingMidfield: "Attacking midfield",
  attack: "Attack",
};

/** What a screen says when a change or a read failed for any reason but the server's refusal (src/refusal.ts):
 *  `outcome` is what that left, such as "nothing changed". */
export const failedWords = (outcome: string) => `Something went wrong, so ${outcome}. Check your connection and try again.`;
/** When a change failed before the server could say why: the connection, or the server itself. */
export const changeFailedWords = failedWords("nothing changed");

/** What the live app shows when it was built with no Convex deployment to reach (liveApp.tsx). */
export const NO_CONVEX_URL = "VITE_CONVEX_URL isn't set, so the app can't reach Convex: `npm run setup` writes it to .env.local (docs/setup.md).";

/** A gameweek by name, as its tick box and the fixtures' stepper say it. */
export const gameweekWords = (gameweek: number) => `Gameweek ${gameweek}`;

const whenFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
/** A time in the viewer's own zone, e.g. "Sat 17 Oct, 13:00": a deadline, a feed's last run. */
export const whenWords = (at: number) => whenFormat.format(at);

/** Between the two sides of a match or a fixture: "Hull City v Everton". */
export const versusWords = "v";

/** The "Find a player" panel, on the admin's dashboard and the squads page alike; each says its own hint. */
export const findTitle = "Find a player";
export const findLabel = "Name";
export const searchingWords = "Searching…";
export const noneFoundWords = "No player of that name in the Premier League.";
export const foundListLabel = "Players found";
