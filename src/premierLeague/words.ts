// What the Premier League section says, in one place for Craig to change in the pull request.

import { LOCALE } from "../../convex/shared/moments";
import { DAY_MS } from "../../convex/shared/time";
import { awayWords, gameweekWords, homeWords, scoreWords, STAT_WORD, timeOfDayWords, versusWords } from "../shared/words";

export { clockWords, fullTime, gameweekWords, halfTime, liveWords, scoreWords, versusWords } from "../shared/words";
/** Goals for less against, signed: "+4", "−3", "0", as the league table signs its difference. */
export { signedWords as goalDifferenceWords } from "../shared/words";

export const PREMIER_LEAGUE_TITLE = "Premier League";
export const FIXTURES_TITLE = "Fixtures and results";
export const loadingWords = "Loading the Premier League's fixtures…";
export const loadingGameweekWords = (gameweek: number) => `Loading ${gameweekWords(gameweek)}'s matches…`;
export const noMatchesWords = (gameweek: number) => `No matches are held for ${gameweekWords(gameweek)} yet.`;
export const matchesListLabel = (gameweek: number) => `${gameweekWords(gameweek)}'s matches`;

const dayFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long" });
/** A day's heading over its matches, in the viewer's own zone: "Saturday 17 October". */
export const dayWords = (at: number) => dayFormat.format(at);
/** A match's kickoff, in the viewer's own zone: "15:00". */
export const kickoffWords = timeOfDayWords;
/** The heading over matches with no kickoff time: postponed, waiting for a new date. */
export const noDateWords = "Date to be confirmed";

/** A match's score as the Premier League pages show it, "2–1", once it has kicked off and both
 *  goals are read; null before kickoff or while a goal is unread, where they show "v". */
export const goalsWords = (score: { state: string; homeGoals: number | null; awayGoals: number | null } | null) =>
  score !== null && score.state !== "upcoming" && score.homeGoals !== null && score.awayGoals !== null
    ? scoreWords(score.homeGoals, score.awayGoals)
    : null;

export const TABLE_TITLE = "Table";
export const loadingTableWords = "Loading the Premier League table…";
/** Said before the football sync has held the season's clubs. */
export const noClubsWords = "No clubs are held yet, so there is no table to show.";
/** Said while a match in the table is being played: its result counts as it stands (spec/18). */
export { provisionalWords } from "../shared/words";

/** The table's columns: a short head, and what it stands for. */
export const tableColumns = {
  position: { short: "Pos", long: "Position" },
  club: { short: "Club", long: "Club" },
  played: { short: "P", long: "Played" },
  won: { short: "W", long: "Won" },
  drawn: { short: "D", long: "Drawn" },
  lost: { short: "L", long: "Lost" },
  goalsFor: { short: "GF", long: "Goals for" },
  goalsAgainst: { short: "GA", long: "Goals against" },
  goalDifference: { short: "GD", long: "Goal difference" },
  points: { short: "Pts", long: "Points" },
} as const;

// The match page (#45; spec/10, The match page), which each fixture opens.

export { figureWords, freeAgentWords, noFigureWords } from "../shared/words";
export { commentaryDelayedWords, notCountingLabel, SCORE_LABEL } from "../shared/words";

/** A fixture's link to its match page, read out for the score or "v" it wraps, which it names:
 *  "Arsenal 2–1 Chelsea: the match". */
export const matchLinkLabel = (home: string, away: string, goals: string | null) => `${home} ${goals ?? versusWords} ${away}: the match`;

export const MATCH_TITLE = "Match";
export const loadingMatchWords = "Loading the match…";
export const noMatchWords = "No match with this code is held.";
/** After where the match stands, the gameweek it is in. */
export const inGameweekWords = (gameweek: number) => ` (${gameweekWords(gameweek)})`;
/** Before kickoff, the day and time it kicks off, in the viewer's own zone. */
export const kickoffDayWords = (at: number) => `${dayWords(at)}, ${kickoffWords(at)}`;
/** When the league's points can't be worked out, while the rest still shows. */
export const pointsProblemWords = (reason: string) => `The league's points can't be worked out for this match: ${reason}.`;

export const sheetLabel = (club: string) => `${club}'s team sheet`;
export const SUBSTITUTES_TITLE = "Substitutes";
export const MOVED_TITLE = "Since left both clubs";
/** Before the sheets are out: spec/10's words for when the live tick starts reading them
 *  (LINEUPS_OUT_BEFORE_KICKOFF_MS, convex/shared/time.ts). */
export const noMenWords = "No team sheets yet.";
export const matchColumns = {
  position: { short: "Pos", long: "Position" },
  player: { short: "Player", long: "Player, and the team that owns him" },
  points: { short: "Pts", long: "Points for his team" },
} as const;
/** A substitute who came on. */
export const cameOnWords = "On";
/** Read out for a substitute who never came on, greyed on screen. */
export const unusedLabel = "unused substitute";

export const COMMENTARY_TITLE = "Commentary";
export { noCommentaryWords as noLinesWords } from "../shared/words";

export const TEAM_STATS_TITLE = "Team stats";
export const teamStatsLabel = (home: string, away: string) => `${home} ${versusWords} ${away}: team stats`;
export const noTeamStatsWords = "No team stats yet.";
/** The five spec/10 names, in its order, the cards as yellow and red. */
export const teamStatRows = {
  shots: "Shots",
  shotsOnTarget: "Shots on target",
  possession: "Possession",
  corners: "Corners",
  yellowCards: "Yellow cards",
  redCards: "Red cards",
} as const;
/** The stats' own column, between the two clubs': its head is read out, not drawn. Each club's
 *  column is headed by its three letters, named by its full name. */
export const STAT_COLUMN = { short: STAT_WORD, long: "What's counted" };
/** A side's possession, to the whole percent: Opta's 49.4 is "49%". */
export const possessionWords = (share: number) => `${Math.round(share)}%`;

// A club's page (#1936; spec/18, Club pages).

export { formHead, tableHead } from "../myTeam/header/words";
export { placeWords } from "../shared/words";
export const loadingClubWords = "Loading the club…";
export const noClubWords = "No club with this code is held.";
/** The club page's tabs on its title plate; the Squad tab comes with #1937. */
export const CLUB_TABS = ["fixtures"] as const;
export type ClubTab = (typeof CLUB_TABS)[number];
export const clubTabWords: Record<ClubTab, string> = { fixtures: "Fixtures" };
export const clubTabsLabel = "The club's tabs";
export const CLUB_TITLE = "Club";
export const NEXT_MATCH_TITLE = "Next match";
export const kickoffHead = "Kick-off";
/** Where a club has no match left to play this season. */
export const noNextMatchWords = "No match to come.";
export const noClubFixturesWords = "No matches are held for this club.";
/** Where a club no longer in the table would show its place. */
export { noFigureWords as notInTableWords } from "../shared/words";
/** Where a match is played, after the opponent's name: "(H)" or "(A)". */
export const venueWords = (atHome: boolean) => (atHome ? homeWords : awayWords);

const dayStart = (at: number) => new Date(at).setHours(0, 0, 0, 0);
/** How many days away a kickoff is, by the viewer's calendar: "Today", "Tomorrow", "In 3 days". */
export function daysAwayWords(kickoff: number, now: number): string {
  const days = Math.round((dayStart(kickoff) - dayStart(now)) / DAY_MS);
  if (days <= 0) return "Today";
  return days === 1 ? "Tomorrow" : `In ${days} days`;
}

/** The Fixtures tab's columns: a short head, and what it stands for. */
export const clubFixtureColumns = {
  gameweek: { short: "GW", long: "Gameweek" },
  opponent: { short: "Opponent", long: "Opponent, home or away" },
  result: { short: "Result", long: "Result or kick-off" },
} as const;
