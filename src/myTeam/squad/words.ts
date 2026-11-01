// What My team's Squad tab says (#364; its approved picture, docs/design/approved/team-squad), in
// one place for Craig to change in the pull request.

import { LANE_WORDS } from "../../../convex/lineup/pitchWords";
import type { Lane } from "../../../convex/lineup/pitch";
import { menuWords } from "../../frame/words";
import { failedWords } from "../../shared/words";

export { figureWords, gameweekWords, noFigureWords, shortThenLongName, whenWords, nextGlyph } from "../../shared/words";
export { goneWords } from "../../squads/words";
export { noTeamWords } from "../words";

export const SQUAD_TITLE = menuWords.squad;
export const squadLoadingWords = "Loading your squad…";
export const noSquadWords = "Your squad is empty.";

/** The table's plate: its views (the README's view picker), and how full the squad is. */
export const squadViews = ["stats", "schedule", "rules"] as const;
export type SquadView = (typeof squadViews)[number];
export const squadViewWords: Record<SquadView, string> = { stats: "Stats", schedule: "Schedule", rules: "Rules" };
export const squadViewLabel = "The table's view";
/** "20 of 20, the league's maximum"; with no maximum, how many he holds. */
export function squadCountWords(players: number, maximum: number | null): string {
  if (maximum === null) return `${players} players`;
  return players === maximum ? `${players} of ${maximum}, the league's maximum` : `${players} of ${maximum}`;
}
/** A view answered but not built yet: its placeholder's name. */
export const viewNotBuiltLabel = (view: SquadView) => `${squadViewWords[view]}: not built yet`;

export const squadTableLabel = (teamName: string) => `${teamName}'s squad`;
export const squadColumns = {
  number: { short: "No", long: "Squad number" },
  positions: { short: "Pos", long: "Positions, his main first" },
  player: { short: "Player", long: "Player and club" },
  season: { short: "Pts", long: "Points this season" },
  last: { short: "Last", long: "Points last gameweek" },
  appearances: { short: "MP", long: "Matches played" },
  minutes: { short: "Mins", long: "Minutes played" },
  goals: { short: "G", long: "Goals" },
  assists: { short: "A", long: "Assists" },
  cleanSheets: { short: "CS", long: "Clean sheets" },
  saves: { short: "Sv", long: "Saves, keepers only" },
  yellowCards: { short: "YC", long: "Yellow cards" },
  redCards: { short: "RC", long: "Red cards" },
  next: { short: "Next 3", long: "His club's next three matches" },
} as const;
/** The Last column's hover, naming the gameweek. */
export const lastGameweekLong = (gameweek: number) => `Points in gameweek ${gameweek}`;
/** A row's button, which opens his season panel. */
export const openPanelLabel = (name: string) => `${name}: his season`;
/** A bench player's row says so to screen readers, as his muted name says it on screen. */
export const benchWords = "on the bench";

/** Where his club plays a match, after the opponent's code. */
export const homeWords = "(H)";
export const awayWords = "(A)";
/** A match as its cell shows it: "CHE (H)". */
export const nextFixtureShort = (opponentCode: string, home: boolean) => `${opponentCode} ${home ? homeWords : awayWords}`;
/** A match's hover: "Chelsea, at home, Sat 5 Sep, 15:00". */
export const nextFixtureLong = (opponent: string, home: boolean, kickoff: string) => `${opponent}, ${home ? "at home" : "away"}, ${kickoff}`;
/** A match cell waits for fixture difficulty (to-grill: Where fixture difficulty comes from). */
export const difficultyNotRatedWords = "difficulty not rated yet";
export const noNextFixtureWords = "No match with a kickoff time yet.";
/** A points cell with no figure: none of his matches is priced yet. */
export const noPointsWords = "No points yet: none of his matches has been priced.";
/** A stat cell while no season's stats are held. */
export const noStatsWords = "No stats held yet.";

/** A status chip after a name, until it is settled which FPL statuses each chip reads (to-grill:
 *  Status chips' data). Only a player FPL holds a doubt about gets one. */
export const statusNotSettledLabel = "Status chip: which one isn't settled yet";

/** His season panel (the README's interaction notes). */
export const closePanelLabel = (name: string) => `Close ${name}'s season`;
export const closeGlyph = "✕";
export const panelPlateWords = (club: string, number: number | null) => (number === null ? club : `${club}, No ${number}`);
export const THIS_SEASON = "This season";
export const panelRows = {
  number: "Squad number",
  points: "Points",
  form: "Form",
  started: "Started",
  rolePoints: "Role points",
  plays: "Plays",
  bestRole: "Best role",
  next: "Next 3",
  roleLastGameweek: "Role last GW",
} as const;
export const seasonWords = "Season";
export const lastWords = "Last";
export const formLabel = (gameweeks: number) => `Points in the league's last ${gameweeks} gameweeks, oldest first`;
/** The panel's placeholders: each says what will show there. */
export const startedNotBuiltLabel = "Started: not counted yet";
export const rolePointsNotBuiltLabel = "Role points: not counted yet";
export const bestRoleNotRatedLabel = "Best role: not rated yet";
export const roleLastGameweekNotSettledLabel = "Role last gameweek: what it counts isn't settled yet";
export const setRoleNotBuiltLabel = "Set his role: waits for Tactics to open with him selected";
export const playerCardWords = "Player card";
/** Where he stands in the gameweek being set: "Starting, W right"; "Bench, S3". */
export const gameweekRowWords = (gameweek: number) => `GW${gameweek}`;
export const startingInWords = (slot: string, lane: Lane) => `Starting, ${slot} ${LANE_WORDS[lane]}`;
export const benchPlaceWords = (place: number) => `Bench, ${benchShort(place)}`;
/** A bench place's short name, first sub S1. */
export const benchShort = (place: number) => `S${place}`;

/** The squad number box's name, for one player (#13). */
export const numberLabel = (name: string) => `${name}'s squad number`;
export const numberFailedWords = failedWords("the squad number wasn't changed");

/** Your eleven: the lineup being set, with each player's season points. */
export const YOUR_ELEVEN_TITLE = "Your eleven";
export const elevenAsideWords = "season pts";
export const elevenPitchLabel = "Your eleven on the pitch, attack at the top, with season points";
export const elevenPlayerLabel = (name: string, points: string) => `${name}, ${points} points this season`;
export const elevenBenchLabel = "The bench, in order";
export const noLineupWords = "No lineup to set: every gameweek has begun, or the league has no rules yet.";
export const setLineupWords = "Set lineup";

/** The Mail widget: the newest letters, each opened in Mail. */
export const MAIL_WIDGET_TITLE = "Mail and news";
export const allMailWords = "All mail";
export const noMailWords = "No mail yet.";
export const mailLoadingWords = "Loading your mail…";
