// What My team's Squad tab says (#364; its approved picture, docs/design/approved/team-squad), in
// one place for Craig to change in the pull request.

import { LANE_WORDS } from "../../../convex/lineup/pitchWords";
import type { Lane } from "../../../convex/lineup/pitch";
import { menuWords } from "../../frame/words";
import { failedWords } from "../../shared/words";
import { benchShort } from "../words";

export { figureWords, signedWords, gameweekWords, noFigureWords, shortThenLongName, whenWords, nextGlyph, closeGlyph, playerCardWords } from "../../shared/words";
export { goneWords } from "../../squads/words";
export {
  awayWords,
  benchShort,
  difficultyNotRatedWords,
  homeWords,
  nextFixtureLong,
  nextFixtureShort,
  noKickoffWords,
  noNextFixtureWords,
  noPointsWords,
  noTeamWords,
  statusNotSettledLabel,
} from "../words";

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

/** The Schedule view (#1006): his club's matches in each of the next six gameweeks. */
export const scheduleTableLabel = (teamName: string) => `${teamName}'s schedule`;
/** A gameweek's head: "GW10", named in full in its tooltip. */
export const scheduleGameweekWords = (gameweek: number) => ({ short: `GW${gameweek}`, long: `Gameweek ${gameweek}` });
/** A blank week's cell: his club has no match in it. */
export const blankWeekWords = "No match this gameweek";
export const noScheduleWords = "No gameweek left to set: the season is over, or the league has no rules yet.";

/** The Rules view (#1006): one row per limit, each naming the players it counts. */
export const rulesTableLabel = (teamName: string) => `${teamName}'s squad against the league's limits`;
export const rulesColumns = {
  limit: { short: "Limit", long: "The league's limit" },
  held: { short: "Held", long: "How many of your squad it counts" },
  allowed: { short: "Allowed", long: "What the league allows" },
  status: { short: "Out", long: "How far outside the limit" },
  players: { short: "Players", long: "The players it counts" },
} as const;
export const squadSizeWords = "Squad size";
export const clubLimitWords = (club: string) => `From ${club}`;
export const betweenWords = (minimum: number, maximum: number) => `${minimum} to ${maximum}`;
export const atLeastWords = (minimum: number) => `at least ${minimum}`;
export const atMostWords = (maximum: number) => `at most ${maximum}`;
/** How far outside a limit the squad is: "1 over", "2 short". */
export const overWords = (by: number) => `${by} over`;
export const shortWords = (by: number) => `${by} short`;
/** Players the football sync no longer holds: counted, with no name to show. */
export const unnamedWords = (count: number) => `and ${count} not held`;
export const noLimitsWords = "The league sets no squad limits.";

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

/** A stat cell while no season's stats are held. */
export const noStatsWords = "No stats held yet.";

/** His season panel (the README's interaction notes). */
export const closePanelLabel = (name: string) => `Close ${name}'s season`;
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
export const bestRoleNotRatedLabel = "Best role: not rated yet";
export const roleLastGameweekNotSettledLabel = "Role last gameweek: what it counts isn't settled yet";
/** The panel's link to Tactics, with him selected there (#1008). */
export const setRoleWords = "Set his role";
/** Where he stands in the gameweek being set: "Starting, W right"; "Bench, S3". */
export const gameweekRowWords = (gameweek: number) => `GW${gameweek}`;
export const startingInWords = (slot: string, lane: Lane) => `Starting, ${slot} ${LANE_WORDS[lane]}`;
export const benchedInWords = (place: number) => `Bench, ${benchShort(place)}`;

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
