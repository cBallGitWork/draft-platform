// What every screen says alike, in one place for Craig to change in the pull request.

import type { PlayingState } from "../../convex/football/matchScores";
import { AREA_WORDS } from "../../convex/lineup/pitchWords";
import type { Position } from "../../convex/positions/positionTables";
import type { TradedSide } from "../../convex/schema";
import { LOCALE } from "../../convex/shared/moments";
import { countInWords, figureWords } from "../../convex/shared/numberWords";
import type { SquadWarning } from "../../convex/squads/squads";
import { FEWEST_TO_DRAW } from "../../convex/table/roundRobin";
import type { Result } from "../../convex/table/standings";

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
/** Closes what was opened to change something, changing nothing. */
export const cancelWords = "Cancel";
/** When a change failed before the server could say why: the connection, or the server itself. */
export const changeFailedWords = failedWords("nothing changed");

/** What the live app shows when it was built with no Convex deployment to reach (liveApp.tsx). */
export const NO_CONVEX_URL = "VITE_CONVEX_URL isn't set, so the app can't reach Convex: `npm run setup` writes it to .env.local (docs/setup.md).";

/** A gameweek by name, as its tick box and the fixtures' stepper say it. */
export const gameweekWords = (gameweek: number) => `Gameweek ${gameweek}`;
/** A gameweek, short, as a head says it: "GW9" (My team's header band, the player card). */
export const gameweekShort = (gameweek: number) => `GW${gameweek}`;
/** A table's Gameweek column head (the player card, My team's fixtures, Gameweeks). */
export const gameweekColumn = { short: "GW", long: "Gameweek" } as const;
/** When a waiver run or an offer's close falls in `gameweek`'s lock: after its last match, whose
 *  time isn't known ahead (Craig, 11 Nov 2026, on #1467 and #1492): "after GW12's last match". A
 *  line starting with it takes `firstUpper`. */
export const afterLastMatchWords = (gameweek: number) => `after ${gameweekShort(gameweek)}'s last match`;
/** Words that start a line, their first letter a capital. */
export const firstUpper = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
/** The fixtures' stepper (src/ui/GameweekStepper.tsx): each arrow's label, and CM's arrows,
 *  decoration, as each button carries its label. */
export const previousGameweekLabel = "Previous gameweek";
export const nextGameweekLabel = "Next gameweek";
export const previousGlyph = "◄";
export const nextGlyph = "►";
/** A panel's or a window's cross, decoration, as its button carries its label. */
export const closeGlyph = "✕";
/** A control drawn as a button that opens a list of choices, decoration, as its label says it. */
export const menuGlyph = "▾";
/** A folding panel's mark, open or folded, decoration, as its button carries its label; the folded
 *  one also ends a link onwards ("Run the league ▸"). */
export const openGlyph = menuGlyph;
export const foldedGlyph = "▸";
/** The link from a player's panel to his card (Squad and Tactics). */
export const playerCardWords = "Player card";
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
/** The stat box's two groups (src/ui/StatBox.tsx), once the site's set has own stats of its own
 *  (spec/14, Own stats; #910). */
export const ownStatsGroupWords = "The site's own stats";
export const catalogueGroupWords = "The feeds' stats";

const whenFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
/** A time in the viewer's own zone, e.g. "Sat 17 Oct, 13:00": a deadline, a feed's last run. */
export const whenWords = (at: number) => whenFormat.format(at);
const dayFormat = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });
/** A day in the viewer's own zone, e.g. "20 Oct": when a letter was filed, or a report written. */
export const dayWords = (at: number) => dayFormat.format(at);
const dateFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short" });
/** A day with its weekday, in the viewer's own zone, e.g. "Tue 27 Oct": when an invite ends, the
 *  day of a league's game. */
export const dateWords = (at: number) => dateFormat.format(at);
const timeOfDayFormat = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" });
/** The time of day alone, in the viewer's own zone: "15:00", a kickoff or when a letter was filed. */
export const timeOfDayWords = (at: number) => timeOfDayFormat.format(at);

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

/** Between the two sides of a match or a fixture: "Hull City v Everton". */
export const versusWords = "v";
/** Where his club plays a match, after the opponent's code (My team's tables and the player card). */
export const homeWords = "(H)";
export const awayWords = "(A)";
/** A match as its cell shows it: "CHE (H)". */
export const nextFixtureShort = (opponentCode: string, home: boolean) => `${opponentCode} ${home ? homeWords : awayWords}`;
/** A status chip after a name, until it is settled which FPL statuses each chip reads (to-grill:
 *  Status chips' data). Only a player FPL holds a doubt about gets one. */
export const statusNotSettledLabel = "Status chip: which one isn't settled yet";
/** A match cell waits for fixture difficulty (to-grill: Where fixture difficulty comes from). */
export const difficultyNotRatedWords = "difficulty not rated yet";
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

/** A result as form shows it, and as a screen reader says it: league home's table and My team's
 *  header alike. */
export const resultWords: Record<Result, { short: string; long: string }> = {
  won: { short: "W", long: "won" },
  drawn: { short: "D", long: "drawn" },
  lost: { short: "L", long: "lost" },
};
export const formLabel = (results: readonly Result[]) =>
  results.length === 0 ? "No results yet" : `Form: ${results.map((result) => resultWords[result].long).join(", ")}`;
/** Form whose last result is still live: "Form: won, lost, Provisional". */
export const liveFormLabel = (results: readonly Result[]) => `${formLabel(results)}${listSeparator}${provisionalWords}`;
/** A live result's chip, on hover: "won, Provisional". */
export const liveResultWords = (result: Result) => `${resultWords[result].long}${listSeparator}${provisionalWords}`;
/** The heads over a team's form and table place: My team's header and a club's page. */
export const formHead = "Form";
export const tableHead = "Table";

/** The bench's title, on Tactics and under a matchup's lineup alike. */
export const BENCH_TITLE = "Bench";

/** The fewest teams a league's fixtures are drawn for, as a sentence says it: "two teams". */
export const fewestTeamsWords = `${countInWords(FEWEST_TO_DRAW)} teams`;
/** Why a league playing total points has no head-to-heads, on the matchup and league home alike. */
export const noHeadToHeadsTotalPointsWords = "The league plays total points, so it has no head-to-heads.";

const weekdayTimeFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "short", hour: "2-digit", minute: "2-digit" });
/** A time within the week, in the viewer's own zone: "Thu 18:00", a kickoff or a waiver run. */
export const weekdayTimeWords = (at: number) => weekdayTimeFormat.format(at);
const weekdayFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "short" });
/** The day alone, in the viewer's own zone: "Sun", as a matchup tile's badge says a kickoff. */
export const weekdayWords = (at: number) => weekdayFormat.format(at);

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
export const autoTeamWhatWords = "Keeps your last lineup, swapping a starter who is out for the first bench player who fits. No claims, drops or trades.";

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
  premierLeague: "Premier League",
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

/** A season, short: "25/26" (the draft's list, Scouting, the player card, patch notes, a role card). */
export const seasonShortWords = (startYear: number) => `${String(startYear % 100).padStart(2, "0")}/${String((startYear + 1) % 100).padStart(2, "0")}`;

/** A matchup's score head, and a player whose points don't count (the matchup and the Premier
 *  League's match page). */
export const SCORE_LABEL = "Score";
export const notCountingLabel = "not counting";
/** The vidiprinter (the matchup, league home, the Premier League's pages): its title, and when the
 *  stream falls behind or stops; points carry on from FPL (spec/10, The commentary). */
export const VIDIPRINTER_TITLE = "Vidiprinter";
export const commentaryDelayedWords = "Commentary delayed";
export const noCommentaryWords = "No lines yet.";

/** A commissioner's override (spec/14 S14.3 to S14.6; #32, #903), of a player's points on his card
 *  and of a team's total on the matchup alike. */
export const overriddenWords = (points: number, reason: string) => `Overridden to ${figureWords(points)} in this league: ${reason}`;
export const overrideHint = "The whole league gets a letter saying what changed and why.";
export const overrideLabels = { match: "Match", points: "Points", reason: "Why" } as const;
export const overrideWords = "Override";
export const overriddenDoneWords = "Overridden: the league has a letter saying why.";
export const overrideFailedWords = "The override couldn't be saved. Try again.";
/** Taking an override off (#903, spec/14 S14.5): "remove override button". */
export const removeOverrideWords = "Remove override";
export const removeOverrideFailedWords = "The override couldn't be removed. Try again.";
/** A player's points for a match whose record hasn't fully arrived, on hover. */
export const notArrivedWords = "His record for this match hasn't fully arrived yet.";

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
