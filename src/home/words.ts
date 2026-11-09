// What league home says, in one place for Craig to change in the pull request.

import { TOP_ROWS } from "../../convex/home/glance";
import { fewestTeamsWords, gameweekShort, noHeadToHeadsTotalPointsWords } from "../shared/words";
import { placeWords } from "../myTeam/header/words";
import { columns as tableColumns } from "../table/words";
import type { LeagueHome, NewsMove } from "./seam";

export { figureWords, gameweekShort, gameweekWords, versusWords, whenWords } from "../shared/words";
export { leagueAverageWords, noResultsWords, TABLE_TITLE } from "../table/words";

export const loadingWords = "Loading league home…";

/** What a placeholder holds until its data or its grill comes (plate.md, Marks: A placeholder). */
export const toComeLabel = (what: string) => `${what}: still to come`;

/** The deadline strip's boxes (docs/design/approved/home/, Placeholders: which boxes, in which
 *  states, is still to grill). */
export const stripLabel = "This gameweek at a glance";
export const stripBoxes = (gameweek: number) => [`${gameweekShort(gameweek)} locks`, "Your lineup", "Claims close", "Table"] as const;

/** The Mail panel and its Needs you | All switch; which letters need a manager is still to grill. */
export { MAIL_TITLE } from "../mail/words";
export const mailViewLabel = "Show";
export const mailViews = { needsYou: "Needs you", all: "All" } as const;
export const needsYouToComeWords = "Which letters need you is still to come.";

/** Your matchup: the reader's head-to-head this gameweek. */
export const MATCHUP_PANEL_TITLE = "Your matchup";
export const openMatchupLink = "Open the matchup";
export const setLineupLink = "Set lineup";
export const standingWords = (place: number, points: number) => `${placeWords(place)}, ${points} pts`;
export const scoreToComeLabel = toComeLabel("The score");

export const THIS_GAMEWEEK_TITLE = "This gameweek";

/** The News panel: the commissioner's latest letter pinned on top, then the latest moves. */
export const NEWS_PANEL_TITLE = "News";

/** The right-hand column's panels still to come, each in its place. */
export const premierLeagueTitle = (gameweek: number) => `Premier League, ${gameweekShort(gameweek)}`;
export const SQUAD_NEWS_TITLE = "Your squad news";
export const RUN_LEAGUE_TITLE = "Run the league";
export const runLeagueAside = "commissioner";
export const runLeagueLink = "Run the league ▸";
/** The recap's panel before the gameweek is final. */
export const recapToComeWords = (gameweek: number) => `Lands once every ${gameweekShort(gameweek)} match is final.`;
/** The ▾ on a right-hand panel: it folds the panel away, and opens it again. */
export const foldLabel = (title: string) => `Fold ${title}`;
export const unfoldLabel = (title: string) => `Open ${title}`;

export const headToHeadsLabel = (gameweekName: string) => `${gameweekName}'s head-to-heads`;
export const noHeadToHeadsWords = {
  totalPoints: noHeadToHeadsTotalPointsWords,
  headToHead: `Head-to-heads are drawn once the league has ${fewestTeamsWords}.`,
} as const satisfies Record<LeagueHome["format"], string>;
export const byeWords = (teamName: string) => `${teamName}: bye`;

/** Under a table cut to its top rows: how many teams it has, and whether the reader's row is added. */
export const partTableWords = (teams: number, withMine: boolean) =>
  `The top ${TOP_ROWS} of ${teams} teams${withMine ? ", and yours" : ""}.`;
/** The table screen's columns (form among them), with won, drawn and lost in one. */
export const columns = { ...tableColumns, record: { short: "W-D-L", long: "Won, drawn, lost" } } as const;
export const recordWords = ({ won, drawn, lost }: { won: number; drawn: number; lost: number }) => `${won}-${drawn}-${lost}`;
export { yourTeamWords } from "../table/words";
export { formLabel, resultWords } from "../shared/words";
export const noFormWords = "—";
export const wholeTableLink = "Whole table and fixtures";

/** The matchday's Vidiprinter, and its words before any line, the matchup's own. */
export { noCommentaryWords as noMatchdayLinesWords, VIDIPRINTER_TITLE } from "../matchup/words";

/** The chip on the commissioner's latest letter, pinned on top of News. */
export const LETTER_TITLE = "From the commissioner";

/** The weekly recap (spec/12, League home): its panel, Read the recap's page, and the line under it
 *  once a score has changed since it was written (Craig, 6 Nov 2026). */
export const recapTitle = (gameweek: number) => `${gameweekShort(gameweek)} recap`;
export const readRecapLink = "Read the recap";
export const scoreChangedWords = "A score has changed since this recap was written.";
export const changedMatchupLink = "See the matchup";
export const loadingRecapWords = "Loading the recap…";
export const noRecapWords = (gameweek: number) => `No recap of Gameweek ${gameweek} yet.`;
export const backHomeLink = "Back to League home";

export const moreOnNewsLink = "More, on News";

/** League home's News tab (#1356): every team's moves, filtered, and the selected one's detail. */
export const NEWS_TITLE = "League news";
export const newestFirstWords = "Newest first";
export const newsLoadingWords = "Loading the moves…";
export const noNewsWords = "No moves yet.";
export const teamFilterLabel = "Team";
export const everyTeamWords = "Every team";
export const kindFilterLabel = "Kind";
export const everyKindWords = "Every kind";
export const olderMovesWords = "Older moves ›";
export const newsColumns = {
  when: { short: "When", long: "When" },
  kind: { short: "Kind", long: "Kind" },
  team: { short: "Team", long: "Team" },
  joined: { short: "In", long: "In" },
  left: { short: "Out", long: "Out" },
  note: { short: "", long: "Note" },
} as const;
export const newsTableLabel = "Every team's moves";
/** Each kind of move, in the Kind column and filter. */
export const newsKindWords = {
  playerAssigned: "Assigned",
  playerMoved: "Moved",
  playerReleased: "Released",
  playerDropped: "Drop",
  playerClaimed: "Claim",
  playerPickedUp: "Free agent",
} as const satisfies Record<NewsMove["kind"], string>;
export const fromTeamWords = (teamName: string) => `From ${teamName}`;
/** The selected move's detail: who got whom, who let whom go, and where he went. */
export const gotWords = (teamName: string) => `${teamName} got`;
export const letGoWords = (teamName: string) => `${teamName} let go`;
export const leftToWords = (toWaivers: boolean) => (toWaivers ? "Onto waivers" : "Back to the free agents");

export const noMovesWords = "No player has joined or left a squad yet.";
type SquadMove = LeagueHome["squadMoves"][number];
/** A squad move in a line: "Saka joined Kroos Control". */
export function moveWords({ kind, playerName, teamName, fromTeamName }: SquadMove): string {
  switch (kind) {
    case "playerAssigned":
      return `${playerName} joined ${teamName}`;
    case "playerMoved":
      return `${playerName} moved from ${fromTeamName} to ${teamName}`;
    case "playerReleased":
      return `${playerName} was released by ${teamName}`;
    case "playerDropped":
      return `${playerName} was dropped by ${teamName}`;
    case "playerClaimed":
      return `${playerName} was claimed by ${teamName}`;
    case "playerPickedUp":
      return `${playerName} was picked up by ${teamName}`;
  }
}
