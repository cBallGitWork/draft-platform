// What every screen says alike, in one place for Craig to change in the pull request. Its
// neighbours hold the rest by job: when things happen (when/words.ts), a match and its points
// (match/words.ts), and the controls' buttons, glyphs and heads (controls/words.ts).

import { AREA_WORDS } from "../../convex/lineup/pitchWords";
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
export const unheldNoticeWords = "Some football data is missing: a player's row says so in place of his name. Tell the admin.";

/** The pitch's areas, as the rules screens name them: the server's refusals name them too. */
export { AREA_WORDS };

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

/** Words that start a line, their first letter a capital. */
export const firstUpper = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
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
/** Why a figure isn't there yet: none of his matches is priced, or, before the first match, he
 *  wasn't in last season's data (Scouting and a club's Squad tab). */
export const noPointsYetWords = "No points yet: none of his matches is scored.";
export const notLastSeasonWords = "No points: he isn't in last season's data.";
/** Why a player's season points are "—": none priced yet, or not in last season's data. */
export const noSeasonPointsWords = (pointsSeason: number | null) => (pointsSeason === null ? noPointsYetWords : notLastSeasonWords);
/** The stat box's two groups (src/ui/StatBox.tsx), once the site's set has own stats of its own
 *  (spec/14, Own stats; #910). */
export const ownStatsGroupWords = "The site's own stats";
export const catalogueGroupWords = "The feeds' stats";

/** Every number a screen shows, with the one minus sign: "−3", and signed, "+4". */
export { figureWords, signedWords } from "../../convex/shared/numberWords";

/** A count with its thousands marked: "3,012". */
export const thousandsWords = (count: number) => count.toLocaleString(LOCALE);

/** A figure not there yet, such as points before a match's record has arrived. */
export const noFigureWords = "—";
/** A figure, or the dash while there is none. */
export const figureOrNone = (points: number | null) => (points === null ? noFigureWords : figureWords(points));
/** A player no team in the league owns. */
export const freeAgentWords = "Free agent";
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

/** A team on the auto team (spec/09, The auto team): its chip on the table and the matchup, and
 *  the switch's name on My team and Squads. */
export const autoTeamWords = "Auto team";
/** What the auto team does (spec/09), as its chip's hover and My team's switch say it. */
export const autoTeamWhatWords = "Keeps your last line-up, swapping a starter who is out for the first bench player who fits. No claims, drops or trades.";

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
  fixtures: "Fixtures",
  transactions: "Transactions",
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
  `${gameweekWords(gameweek)} can't be scored, so it counts for nothing in the table: ${reason}.`;

/** After a points column's hover: whose scoring adds them up (Scouting, the draft's list, the
 *  player card). */
export const underSiteScoringWords = "under the site's scoring";

/** A trade review rule by name, as League settings offers it and a trade's Review fact says it. */
export const commissionerVetoWords = "Commissioner veto";
export const leagueVoteWords = "League vote";

/** A player who has left the Premier League: on a squad (Squads, My team's Squad tab), and on his
 *  card and a shortlist. */
export const leftLeagueWords = "Not available: he has left the Premier League.";
export const noLongerInLeagueWords = "No longer in the Premier League.";

/** Each squad limit the league's rules set that a squad breaks: they warn, never block (spec/15),
 *  on Squads and the trades alike. */
export function warningWords(warning: SquadWarning): string {
  switch (warning.kind) {
    case "overMaximum":
      return `${warning.players} players, over the league's most of ${warning.maximum}.`;
    case "underMinimum":
      return `${warning.players} players, under the league's least of ${warning.minimum}.`;
    case "overClubMaximum":
      return `${warning.players} from ${warning.clubShortName}, over the league's most of ${warning.maximum} from one club.`;
    case "underAreaMinimum":
      return `${AREA_WORDS[warning.area]}: ${warning.minimum - warning.players} short of the league's least of ${warning.minimum}.`;
  }
}
