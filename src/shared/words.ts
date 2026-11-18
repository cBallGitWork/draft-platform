// What every screen says alike, in one place for Craig to change in the pull request. Its
// neighbours hold the rest by job: when things happen (when/words.ts), a match and its points
// (match/words.ts), and the controls' buttons, glyphs and heads (controls/words.ts).

import { AREA_PLAYER_WORDS, AREA_WORDS } from "../../convex/lineup/pitchWords";
import type { Position } from "../../convex/positions/positionTables";
import type { TradedSide } from "../../convex/schema";
import { LOCALE } from "../../convex/shared/moments";
import { countInWords, figureWords } from "../../convex/shared/numberWords";
import type { SquadWarning } from "../../convex/squads/squads";
import { FEWEST_TO_DRAW } from "../../convex/table/roundRobin";
import { gameweekWords, seasonShortWords } from "./when/words";

/** A squad's row whose player the football sync doesn't hold, in place of his name: the Tactics
 *  tab has it from the server, which words it. */
export { unheldPlayerWords } from "../../convex/shared/players";
/** Above a screen holding such a row (Craig, 31 Oct 2026, #323). */
export const unheldNoticeWords = "Some football data is missing, and the rows it affects say so. Tell the admin.";

/** The pitch's areas, as the rules screens name them: the server's refusals name them too. */
export { AREA_PLAYER_WORDS, AREA_WORDS };

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

/** The bar a tab shows once a release is out that its code can't work with, and its button
 *  (spec/12, S12.13); a save the tab no longer sends, or that failed for it, says the same. */
export const newVersionWords = "A new version is out.";
export const reloadWords = "Reload";

/** What the live app shows when it was built with no Convex deployment to reach (liveApp.tsx). */
export const NO_CONVEX_URL = "VITE_CONVEX_URL isn't set, so the app can't reach Convex: `npm run setup` writes it to .env.local (docs/setup.md).";

/** A setting nobody has made yet. */
export const notSetWords = "Not set";

/** The link from a player's panel to his card (Squad and Tactics). */
export const playerCardWords = "Player card";
/** A stat, as a column of stats or the choice of one is headed. */
export const STAT_WORD = "Stat";
/** The season stats' column heads the draft list and My team's squad table both show. */
export const statColumns = {
  appearances: { short: "MP", long: "Matches played" },
  goals: { short: "G", long: "Goals" },
  assists: { short: "A", long: "Assists" },
  cleanSheets: { short: "CS", long: "Clean sheets" },
} as const;
/** Stats' names Scouting, My team's squad and the match page's Player stats share. */
export const statNames = { minutes: "Minutes played", keyPasses: "Key passes", goalsConceded: "Goals conceded" } as const;
/** A squad table's name, as My team's and a trade's say it. */
export const squadTableLabel = (teamName: string) => `${teamName}'s squad`;
/** A count of players: "1 player", "12 players". */
export const playersCount = (count: number) => (count === 1 ? "1 player" : `${count} players`);
/** The players list, as Scouting and the draft room both title it and say it loading. */
export const PLAYERS_TITLE = "Players";
export const loadingPlayersWords = "Loading the players…";
/** The button that puts a player in the draft queue, in Scouting's shortlist and the draft room. */
export const addToQueueWords = "Add to queue";
/** Last season's points' head, named by the season they are from; with none priced, "last season"
 *  (the draft list and Scouting). */
export const lastSeasonPointsColumn = (season: number | null) =>
  season === null
    ? { short: "Pts last season", long: `Points last season ${underSiteScoringWords}` }
    : { short: `Pts ${seasonShortWords(season)}`, long: `Points in ${seasonShortWords(season)} ${underSiteScoringWords}` };
/** A player's points, split as the Glossary names them on screen (Craig, 18 Nov 2026): what he
 *  earned for what he did, what his role added or took, and the two together in a match. */
export const STAT_POINTS_WORDS = "Stat points";
export const ROLE_POINTS_WORDS = "Role points";
export const TOTAL_WORDS = "Total";
export const SEASON_POINTS_WORDS = "Season points";
/** A breakdown's role line, on the player card and the matchup: "Role points, Attacking full-back". */
export const roleLineLabel = (name: string) => `${ROLE_POINTS_WORDS}, ${name}`;
/** Why a figure isn't there yet: none of his matches is priced, or, before the first match, he
 *  wasn't in last season's data (Scouting and a club's Squad tab). */
export const noPointsYetWords = "No points yet: none of his matches is scored.";
export const notLastSeasonWords = "No points: he isn't in last season's data.";
/** Why a player's season points are "—": none priced yet, or not in last season's data. */
export const noSeasonPointsWords = (pointsSeason: number | null) => (pointsSeason === null ? noPointsYetWords : notLastSeasonWords);
/** The stat box's groups (src/ui/StatBox.tsx; spec/19, `S19.5`): first the stats the site's set
 *  scores, then any own stat it doesn't (spec/14, Own stats; #910), then the feeds' others by kind
 *  (src/ui/statKinds.ts), in this order. */
export const scoredGroupWords = "Scored";
export const ownStatsGroupWords = "The site's own stats";
export const statKindWords = {
  attacking: "Attacking",
  passing: "Passing",
  defending: "Defending",
  goalkeeping: "Goalkeeping",
  discipline: "Discipline",
  other: "Other",
};

/** Every number a screen shows, with the one minus sign: "−3", and signed, "+4". */
export { figureWords, signedWords } from "../../convex/shared/numberWords";

/** A count with its thousands marked: "3,012". */
export const thousandsWords = (count: number) => count.toLocaleString(LOCALE);

/** A figure not there yet, such as points before a match's record has arrived. */
export const noFigureWords = "—";
/** A figure, or the dash while there is none. */
export const figureOrNone = (points: number | null) => (points === null ? noFigureWords : figureWords(points));
/** What a screen reader and the hover say of data not held yet (Craig, 18 Nov 2026). */
export const notYetWords = "not yet available";
/** A placeholder's name, for screen readers and the hover: "News notes: not yet available". */
export const notHeldLabel = (what: string) => `${what}: ${notYetWords}`;
/** What a placeholder writes inside it: its heading and the empty-figure mark, "News notes —". */
export const notHeldShown = (what: string) => `${what} ${noFigureWords}`;
/** A player no team in the league owns. */
export const freeAgentWords = "Free agent";
/** The waiver order and the runs, as My team, League settings and the league's home say them
 *  (SPEC.md Glossary: bid order, settle; Craig, 18 Nov 2026). */
export const BID_ORDER_TITLE = "Bid order";
export const BIDS_SETTLE_TITLE = "Bids settle";
/** Between the items of a short list in a line: a player's positions, "CDM, CM". */
export const listSeparator = ", ";

/** The bench's title, on Tactics and under a matchup's lineup alike. */
export const BENCH_TITLE = "Bench";

/** The fewest teams a league's fixtures are drawn for, as a sentence says it: "two teams". */
export const fewestTeamsWords = `${countInWords(FEWEST_TO_DRAW)} teams`;
/** Why a league playing total points has no head-to-heads, on the matchup and league home alike. */
export const noHeadToHeadsTotalPointsWords = "The league plays total points, so it has no head-to-heads.";

const ordinals = new Intl.PluralRules(LOCALE, { type: "ordinal" });
const ORDINAL_ENDS: Record<Intl.LDMLPluralRule, string> = { zero: "th", one: "st", two: "nd", few: "rd", many: "th", other: "th" };
/** A place in a table or an order: "1st", "22nd", "13th" (My team, league home, the draft). */
export const placeWords = (place: number) => `${place}${ORDINAL_ENDS[ordinals.select(place)]}`;

/** Said to someone who runs no team in the league, such as a commissioner who doesn't play, on
 *  My team's tabs, the trade pages and the matchup alike. */
export const noTeamWords = "You don't run a team in this league.";

/** Where a team has no manager, on the squads page and the commissioner's teams panel alike. */
export const noManagerWords = "No manager";

/** The "Find a player" panel, on the admin's dashboard and the squads page alike; each says its own hint. */
export const findTitle = "Find a player";
export const findLabel = "Name";
export const searchingWords = "Searching…";
export const noneFoundWords = "No player of that name in the Premier League.";
export const foundListLabel = "Players found";

/** The auto team on screen is "Away mode" (Glossary, Craig, 18 Nov 2026: testers read "Auto team"
 *  as the draft's auto-pick): the switch's name on My team and Squads. */
export const awayModeWords = "Away mode";
/** A team in Away mode (spec/09, The auto team): its chip on the table and the matchup. */
export const autoTeamWords = "Away";
/** What Away mode does, in one line: the hover on its chip and on My team's switch (Craig, 18 Nov 2026). */
export const awayModeHoverWords = "Picks your line-up each gameweek while you're away.";
/** What Away mode does (spec/09), in full, in My team's Away mode panel. */
export const autoTeamWhatWords = "Keeps your last line-up, swapping anyone in your XI who is out for the first bench player who fits. No bids, drops or trades.";

/** A traded draft pick, named by the team whose pick it is: "Pickford Pirates' round 4 pick"
 *  (docs/design/approved/team-transactions/). */
export const tradedPickWords = (round: number, teamName: string) => `${possessive(teamName)} round ${round} pick`;
/** A team's name owning something: "Hull Hearts'", "Lions'", "Bob's" as it is, "Ann's XI's". */
const possessive = (name: string) => (name.endsWith("'s") ? name : name.endsWith("s") ? `${name}'` : `${name}'s`);
/** One side of a trade that went through, each of its players and picks by name (#1491). */
export const tradedNames = ({ players, picks }: TradedSide): string[] => [
  ...players.map(({ playerName }) => playerName),
  ...picks.map(({ round, teamName }) => tradedPickWords(round, teamName)),
];
/** The other side of a trade: "With Hull Hearts". */
export const withTeamWords = (teamName: string) => `With ${teamName}`;
/** A traded pick made by the team it was traded to: "via Bale Out" (the draft and the trades). */
export const viaWords = (team: string) => `via ${team}`;

/** The top menu's sections and Home's, My team's and Trades' tabs (src/frame/menu.ts), and the
 *  titles of the pages other screens name: the table, Mail and the draft. */
export const menuWords = {
  home: "Home",
  overview: "Overview",
  news: "News",
  myTeam: "My team",
  tactics: "Tactics",
  squad: "Squad",
  /** My team's tab of its matchups (Craig, 18 Nov 2026); its key and route keep "fixtures". */
  fixtures: "Matchups",
  transactions: "Signings",
  matchup: "Matchup",
  table: "Table",
  scouting: "Scouting",
  trades: "Trades",
  offers: "Offers",
  newOffer: "New offer",
  football: "Football",
  mail: "Mail",
  draft: "Draft",
} as const;
export const TABLE_TITLE = menuWords.table;
export const MAIL_TITLE = menuWords.mail;
export const DRAFT_TITLE = menuWords.draft;

/** The league's table, on the table screen, league home, My team and the matchup alike: said
 *  while every team has played nothing, the row of the viewer's team, and the league average. */
export const noResultsWords = "No results yet.";
export const yourTeamWords = "Your team";
/** Two of the table's columns, which League settings' tie-breaks name too (spec/03, S03.2). */
export const pointsForWords = "Points for";
export const pointsAgainstWords = "Points against";
export const leagueAverageWords = "League average";
/** A gameweek that can't be scored (the table and My team). */
export const unscoredWords = (gameweek: number, reason: string) =>
  `${gameweekWords(gameweek)} doesn't count in the table. It couldn't be scored: ${reason}.`;

/** After a points column's hover: whose scoring adds them up (Scouting, the draft's list, the
 *  player card). */
export const underSiteScoringWords = "under the site's scoring";

/** A trade review rule by name, as League settings offers it and a trade's Review fact says it. */
export const commissionerVetoWords = "Commissioner can stop trades";
export const leagueVoteWords = "League can stop trades";
/** Trades' Offers group of accepted trades under review, and League settings' widget of them. */
export const inReviewWords = "In review";

/** A player who has left the Premier League: on a squad (Squads, My team's Squad tab), and on his
 *  card and a shortlist. */
export const leftLeagueWords = "He has left the Premier League.";
export const noLongerInLeagueWords = "No longer in the Premier League.";

/** Each squad limit the league's rules set that a squad breaks: they warn, never block (spec/15),
 *  on Squads and the trades alike. */
export function warningWords(warning: SquadWarning): string {
  switch (warning.kind) {
    case "overMaximum":
      return `${warning.players} players. The league allows ${warning.maximum} at most.`;
    case "underMinimum":
      return `${warning.players} players. The league needs at least ${warning.minimum}.`;
    case "overClubMaximum":
      return `${warning.players} from ${warning.clubShortName}. The league allows ${warning.maximum} from one club.`;
    case "underAreaMinimum":
      return `${AREA_WORDS[warning.area]}: ${warning.minimum - warning.players} short. The league needs at least ${warning.minimum}.`;
  }
}

/** The link to the Tactics tab to set a line-up: League home's matchup panel and the top bar's next job. */
export const setLineupLink = "Set line-up";
