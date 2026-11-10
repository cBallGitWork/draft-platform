// What the role card says (the approved role card, Role card B1; spec/05 Roles; #848), in one place
// for Craig to change in the pull request.

import { seasonShortWords } from "../../../draft/words";
import { listSeparator, signedWords } from "../../../shared/words";
import { gameweekShort } from "../../header/words";

export { cancelWords } from "../formationWindow/words";
export { figureWords, nextFixtureShort, noFigureWords, signedWords } from "../../../shared/words";

/** The card's plate: "Caicedo CHE, his role", then his slot's chip and its position in words. */
export const cardTitle = (name: string) => `${name}, his role`;
export const closeCardLabel = (name: string) => `Close ${name}'s role card`;

export const ROLES_TITLE = "Roles for this slot";
/** The left panel's plate aside: his base points over the matches the card prices. */
export const basePointsHead = (matches: number) => `Base points, his last ${matches} played`;
export const ROLE_COLUMNS = { role: "Role", fit: "Role fit", rewards: "Rewards", punishes: "Punishes", fromRole: "+/− from role", total: "Total" } as const;
export const inUseWords = "In use";
/** A role no real Sportmonks read has shown the stats of yet (spec/05 `S05.30`). */
export const notTestedWords = "Not tested";
export const pointsHead = "Points";
/** spec/05 Roles: a role moves a match by at most 3 either way (Craig, 5 Nov 2026). */
export const roleLimitWords = "±3 a match at most";
export const rewardsWords = (stats: readonly string[]) => stats.join(listSeparator);

/** What a role's stars mean in a word (the approved role card: "a word beside the stars"; Craig,
 *  9 Nov 2026): 5 Outstanding down to 1 Poor, a half star rounding down. */
const STAR_WORDS = ["Poor", "Poor", "Fair", "Good", "Very good", "Outstanding"] as const;
export const starWords = (stars: number) => STAR_WORDS[Math.floor(stars)];

/** The previewed role's aside: what it would have given against the role in use, over his matches. */
export const againstInUseWords = (difference: number, inUse: string, matches: number) => `${signedWords(difference)} on ${inUse} in his last ${matches}`;

/** His season for the role's stats, per 90 and ranked: who he is ranked against isn't settled yet
 *  (the approved role card's README, Interaction notes). */
export const seasonStatsPlaceholder = "His season for this role's stats, per 90 and ranked, shows here once who he's ranked against is settled";
export const whereHeMovesWords = "Where he moves";

/** His matches under the previewed role. */
export const matchesTitle = (matches: number, role: string) => `His last ${matches} matches played, as ${role.toLowerCase()}`;
export const noMatchesWords = "No matches yet";
export const MATCH_COLUMNS = { gameweek: "GW", opponent: "Opponent", minutes: "Mins", base: "Base", fromRole: "+/− from role", total: "Total" } as const;
export const lastNWords = (matches: number) => `Last ${matches}`;
export { gameweekShort, seasonShortWords };
/** One of last season's matches, whose copy holds no opponent. */
export const lastSeasonWords = "Last season";
export const roleMovedNothingWords = (role: string) => `${role}: nothing either way`;
export const showMatchLabel = (match: string) => `${match}: what earned the role's points`;

export const playAsWords = (role: string) => `Play him as ${role}`;
export const loadingCardWords = "Loading his roles…";
