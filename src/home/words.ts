// What league home says, in one place for Craig to change in the pull request.

import { TOP_ROWS } from "../../convex/home/glance";
import { YOUR_LINEUP } from "../../convex/lineup/instructionsWords";
import { wonBidWords } from "../../convex/mail/waiverLetterWords";
import { andListWords } from "../../convex/shared/moments";
import { BIDS_SETTLE_TITLE, fewestTeamsWords, noHeadToHeadsTotalPointsWords, notSetWords, placeWords, TABLE_TITLE, tradedNames } from "../shared/words";
import { foldedGlyph } from "../shared/controls/words";
import { gameweekShort } from "../shared/when/words";
import { columns as tableColumns } from "../table/words";
import type { LeagueHome, NewsMove } from "./seam";

export { figureWords, tradedNames, withTeamWords } from "../shared/words";
export { foldedGlyph, openGlyph } from "../shared/controls/words";
export { scoreWords } from "../shared/match/words";
export { gameweekShort, whenWords } from "../shared/when/words";
export { andListWords };
export { leagueAverageWords, noResultsWords, TABLE_TITLE } from "../shared/words";

export const loadingWords = "Loading league home…";

/** What a placeholder says until its data or its grill comes, written inside it (plate.md, Marks: A
 *  placeholder). */
export const toComeLabel = (what: string) => `${what}: still to come`;

/** The deadline strip's boxes, as the picture has them (Craig, 13 Nov 2026, on #1976). */
export const stripLabel = "This gameweek at a glance";
export const stripBoxes = (gameweek: number) => [`${gameweekShort(gameweek)} deadline`, YOUR_LINEUP, BIDS_SETTLE_TITLE, TABLE_TITLE] as const;
/** Your line-up's box: its first flagged starter, by FPL's chance he plays ("doubtful" at 25 to 75%,
 *  "out" at 0), and how many more are flagged; or whether it is set at all. */
export const lineupSetWords = "Set";
export const lineupNotSetWords = notSetWords;
export const flagOf = (chanceOfPlaying: number | null) =>
  chanceOfPlaying === 0 ? "out" : chanceOfPlaying !== null && chanceOfPlaying >= 25 && chanceOfPlaying <= 75 ? "doubtful" : null;
export const flaggedStarterWords = (name: string, chanceOfPlaying: number | null) => {
  const flag = flagOf(chanceOfPlaying);
  return flag === null ? name : `${name} ${flag}`;
};
export const moreFlaggedWords = (more: number) => ` and ${more} more`;
/** Bids settle's box: when bids next settle, then the bids waiting on it. */
export const claimsWaitingWords = (claims: number) => (claims === 1 ? "bid" : "bids");
/** The Table box: "2nd, 18 pts", then the gap: "1 behind 1st", or "3 ahead of 2nd" on top. */
export const gapWords = (gap: number, onTop: boolean) => (onTop ? `${gap} ahead of 2nd` : `${gap} behind 1st`);
export { listSeparator, noFigureWords, placeWords } from "../shared/words";
export { versusWords } from "../shared/match/words";
export { countdownWords, weekdayTimeWords } from "../shared/when/words";
export const pointsShortWords = "pts";

/** The Mail panel and its Needs you | All switch, Needs you with how many wait on him (S12.15). */
export { MAIL_TITLE } from "../shared/words";
export const mailViewLabel = "Show";
export const mailViews = { needsYou: "Needs you", all: "All" } as const;
export const needsYouCountWords = (count: number) => `${mailViews.needsYou} (${count})`;
export const nothingNeedsYouWords = "Nothing to do.";
/** A doubtful or out starter, a Needs you item opening Tactics (S16.7). */
export const starterNeedsYouWords = (name: string, flag: "doubtful" | "out") => `${name} is ${flag} and starts`;

/** Your matchup: the reader's head-to-head this gameweek. */
export const MATCHUP_PANEL_TITLE = "Your matchup";
export const openMatchupLink = "Open the matchup";
export { setLineupLink } from "../shared/words";
export const standingWords = (place: number, points: number) => `${placeWords(place)}, ${points} ${pointsShortWords}`;
export const scoreToComeLabel = toComeLabel("The score");

export const THIS_GAMEWEEK_TITLE = "This gameweek";

/** The News panel: the commissioner's latest letter pinned on top, then the latest moves. */
export const NEWS_PANEL_TITLE = "News";

/** The right-hand column: the Premier League's gameweek, with whose players are in each match. */
export const premierLeagueTitle = (gameweek: number) => `Premier League, ${gameweekShort(gameweek)}`;
export const matchListLabel = (gameweek: number) => `${premierLeagueTitle(gameweek)}, matches with your players or your opponent's`;
export const youWords = "You";
export const themWords = "Them";
export const noMatchesWords = "Neither your players nor your opponent's play this gameweek.";
export const allFixturesLink = "All fixtures";
/** Your squad news: each player FPL gives a note, the note word for word. */
export const SQUAD_NEWS_TITLE = "Your squad news";
export const noSquadNewsWords = "No news on your squad.";
export const RUN_LEAGUE_TITLE = "Run the league";
export const runLeagueAside = "commissioner";
export const runLeagueLink = `${RUN_LEAGUE_TITLE} ${foldedGlyph}`;
/** The recap's panel before the gameweek is final. */
export const recapToComeWords = (gameweek: number) => `Ready once every ${gameweekShort(gameweek)} match is final.`;
/** The ▾ on a right-hand panel: it folds the panel away, and opens it again. */
export const foldLabel = (title: string) => `Hide ${title}`;
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
export { yourTeamWords } from "../shared/words";
export const wholeTableLink = "Whole table and fixtures";

/** The matchday's Vidiprinter, and its words before any line, the matchup's own. */
export { noCommentaryWords as noMatchdayLinesWords, VIDIPRINTER_TITLE } from "../shared/match/words";

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
/** Read the recap's page with no gameweek named (#1967): the latest recap, before it loads or with none. */
export const latestRecapTitle = "Latest recap";
export const noRecapYetWords = "No recap yet.";
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
  playerAssigned: "Given by commissioner",
  playerMoved: "Moved",
  playerReleased: "Let go",
  playerDropped: "Drop",
  playerClaimed: "Bid",
  playerPickedUp: "Signed",
  tradeMade: "Trade",
} as const satisfies Record<NewsMove["kind"], string>;
export const fromTeamWords = (teamName: string) => `From ${teamName}`;
/** The selected move's detail: who got whom, who let whom go, and where he went. */
export const gotWords = (teamName: string) => `${teamName} got`;
export const letGoWords = (teamName: string) => `${teamName} let go`;
export const leftToWords = (toWaivers: boolean) => (toWaivers ? "Released" : "Back to the free agents");

export const noMovesWords = "No player has joined or left a squad yet.";
type SquadMove = LeagueHome["squadMoves"][number];
/** A squad move in a line: "Saka joined Kroos Control", or a trade as one: "Lions traded Saka to
 *  Tigers for Palmer and Rice" (#1491). */
export function moveWords(move: SquadMove): string {
  if (move.kind === "tradeMade") {
    return `${move.fromTeamName} traded ${andListWords(tradedNames(move.gives))} to ${move.toTeamName} for ${andListWords(tradedNames(move.gets))}`;
  }
  const { kind, playerName, teamName, fromTeamName } = move;
  switch (kind) {
    case "playerAssigned":
      return `${playerName} joined ${teamName}`;
    case "playerMoved":
      return `${playerName} moved from ${fromTeamName} to ${teamName}`;
    case "playerReleased":
      return `${teamName} let ${playerName} go`;
    case "playerDropped":
      return `${teamName} dropped ${playerName}`;
    case "playerClaimed":
      return wonBidWords(teamName, playerName);
    case "playerPickedUp":
      return `${teamName} signed ${playerName}`;
  }
}
