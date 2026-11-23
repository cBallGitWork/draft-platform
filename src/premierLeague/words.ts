// What the Premier League section says, in one place for Craig to change in the pull request.

import { DAY_MS } from "../../convex/shared/time";
import type { TableLine } from "../../convex/football/tableLines";
import { lastSeasonPointsColumn, listSeparator, menuWords, noFigureWords, signedWords, STAT_WORD, statColumns, statNames } from "../shared/words";
import { ascendingGlyph, backWords, descendingGlyph } from "../shared/controls/words";
import { awayWords, homeWords, versusWords } from "../shared/match/words";
import { dateWords, gameweekColumn, gameweekShort, gameweekWords, seasonShortWords, timeOfDayWords } from "../shared/when/words";

export { goalsWords, liveWords, scoreWords, versusWords } from "../shared/match/words";
export { gameweekWords } from "../shared/when/words";
/** Goals for less against, signed: "+4", "−3", "0", as the league table signs its difference. */
export { signedWords as goalDifferenceWords } from "../shared/words";

/** The section's heading, read out only: its plate is the competitions' tabs (spec/18; the
 *  approved picture). */
export const FOOTBALL_TITLE = menuWords.football;
export const PREMIER_LEAGUE_TITLE = "Premier League";
/** The real competitions a league can play, each a tab on the section's plate (spec/18: "a tab
 *  for each competition it plays"). Only the Premier League feeds the site yet: the Scottish
 *  Premiership's tab comes when its fixtures and table do (#1391). */
export const COMPETITIONS = ["premierLeague"] as const;
export type Competition = (typeof COMPETITIONS)[number];
export const competitionWords: Record<Competition, string> = { premierLeague: PREMIER_LEAGUE_TITLE };
export const competitionsLabel = "Competitions";
export const FIXTURES_TITLE = "Fixtures";
export const loadingWords = "Loading the Premier League's fixtures…";
export const loadingGameweekWords = (gameweek: number) => `Loading ${gameweekWords(gameweek)}'s matches…`;
export const noMatchesWords = (gameweek: number) => `No matches are held for ${gameweekWords(gameweek)} yet.`;
export const matchesListLabel = (gameweek: number) => `${gameweekWords(gameweek)}'s matches`;

/** A day's heading over its matches, in the viewer's own zone: "Sat 21 Nov" (the approved picture). */
export const dayWords = dateWords;
/** A match's kickoff, in the viewer's own zone: "15:00". */
export const kickoffWords = timeOfDayWords;
/** The heading over matches with no kickoff time: postponed, waiting for a new date. */
export const noDateWords = "Date to be confirmed";


export const TABLE_TITLE = "Table";
export const loadingTableWords = "Loading the Premier League table…";
/** Said before the football sync has held the season's clubs. */
export const noClubsWords = "No clubs are held yet, so there is no table to show.";
/** Said while a match in the table is being played: its result counts as it stands (spec/18). */
export { provisionalWords } from "../shared/match/words";

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
/** The live table's column of places moved, after Pos: unheaded on screen (the approved picture). */
export const movedColumn = { short: "", long: "Places moved this gameweek" } as const;

/** A club's places moved since the live gameweek began (spec/18, `S18.4`; the approved picture):
 *  "▲ 2" up, "▼ 1" down, "–" unmoved. */
export const movedWords = (moved: number) => (moved === 0 ? "–" : `${moved > 0 ? ascendingGlyph : descendingGlyph} ${Math.abs(moved)}`);
/** Said on hovering it: "Up 2 since GW11 began", "No change since GW11 began". */
export function movedLabel(moved: number, gameweek: number): string {
  const since = `since ${gameweekShort(gameweek)} began`;
  if (moved === 0) return `No change ${since}`;
  return `${moved > 0 ? "Up" : "Down"} ${Math.abs(moved)} ${since}`;
}

/** What each line across the table says on hovering it (spec/18, `S18.5`; the approved picture). */
export const tableLineWords: Record<TableLine, string> = {
  championsLeague: "Champions League places end here",
  otherEurope: "Europa League and Conference League places end here",
  relegation: "Relegation places start below",
};

// The match page (#45; spec/10, The match page), which each fixture opens.

export { figureOrNone, figureWords, freeAgentWords, noFigureWords } from "../shared/words";
export { commentaryDelayedWords, livePointsDelayedWords, notCountingLabel, SCORE_LABEL } from "../shared/match/words";

/** A fixture's link to its match page, read out for the score or "v" it wraps, which it names:
 *  "Arsenal 2–1 Chelsea: the match". */
export const matchLinkLabel = (home: string, away: string, goals: string | null) => `${home} ${goals ?? versusWords} ${away}: the match`;

export const MATCH_TITLE = "Match";
export { backWords, previousGlyph } from "../shared/controls/words";
/** Back's link, read out: "Back to Premier League GW11's fixtures"; to its fixtures for none. */
export const backLabel = (gameweek: number | null) => `${backWords} to ${PREMIER_LEAGUE_TITLE}${gameweek === null ? "" : ` ${gameweekShort(gameweek)}`}'s fixtures`;
/** Beside Back, where the match is: "Premier League, GW11" (the approved picture). */
export const matchWhereWords = (gameweek: number | null) => (gameweek === null ? PREMIER_LEAGUE_TITLE : `${PREMIER_LEAGUE_TITLE}, ${gameweekShort(gameweek)}`);
/** Beside the sheets' points while they are live, until the gameweek's are final (spec/10 S10.10);
 *  "Provisional" on hovering it. */
export const provWords = "prov.";
/** Under the scoreboard, a side's scorers in the order they scored, a man's goals after his name
 *  once: "Saka 23', 58', Gyökeres 67'"; an own goal counts for the other side and says so (S10.7). */
export const ownGoalWords = "(og)";
export const scorersWords = (goals: readonly { name: string; minute: string; ownGoal: boolean }[]) => {
  const minutesByName = new Map<string, string[]>();
  for (const { name, minute, ownGoal } of goals) {
    const minutes = minutesByName.get(name) ?? [];
    minutes.push(ownGoal ? `${minute} ${ownGoalWords}` : minute);
    minutesByName.set(name, minutes);
  }
  return [...minutesByName].map(([name, minutes]) => `${name} ${minutes.join(listSeparator)}`).join(listSeparator);
};
export const scorersLabel = (club: string) => `${club}'s scorers`;
export const loadingMatchWords = "Loading the match…";
export const noMatchWords = "No match with this code is held.";
/** After where the match stands, the gameweek it is in. */
export const inGameweekWords = (gameweek: number) => ` (${gameweekWords(gameweek)})`;
/** Before kickoff, the day and time it kicks off, in the viewer's own zone. */
export const kickoffDayWords = (at: number) => `${dayWords(at)}, ${kickoffWords(at)}`;
/** The admin's mark on a match (#904; spec/05 S05.46): his button, its confirm, and taking it back. */
export const markAbandonedWords = "Mark abandoned";
export const markAbandonedQuestion =
  "Mark this match abandoned? Its players' stats and every league's overrides in it are deleted, its men are auto-subbed, and each league with a player in it gets a letter.";
export const abandonedWords = "Abandoned";
export const unmarkAbandonedWords = "Take back the mark";
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
  player: { short: "Player", long: "Player" },
  /** "Owner" (Craig, 10 Nov 2026, on #1032; spec/10 S10.7). */
  owner: { short: "Owner", long: "The team his points are for" },
  points: { short: "Pts", long: "Points for his team" },
} as const;
/** Each mark after a man's name, read out (spec/10 S10.9): one a goal, an assist or a card. */
export const markLabels = { goals: "Goal", assists: "Assist", yellowCards: "Yellow card", redCards: "Red card" } as const;
/** A substitute who came on, at his minute ("On 62'") once the commentary holds it. */
export const cameOnWords = (minute: string | null) => (minute === null ? "On" : `On ${minute}`);
/** A man who went off ("Off 62'"; the approved picture `1440-pitch.png`). */
export const wentOffWords = (minute: string) => `Off ${minute}`;
/** Read out for a substitute who never came on, greyed on screen. */
export const unusedLabel = "unused substitute";

export const COMMENTARY_TITLE = "Commentary";
export { noCommentaryWords as noLinesWords } from "../shared/match/words";

export const TEAM_STATS_TITLE = "Team stats";
export const teamStatsLabel = (home: string, away: string) => `${home} ${versusWords} ${away}: team stats`;
export const noTeamStatsWords = "No team stats yet.";
/** The five spec/10 names, in its order, the cards as yellow and red. */
export const teamStatRows = {
  shots: "Shots",
  shotsOnTarget: "Shots on target",
  possession: "Possession",
  corners: "Corners",
  yellowCards: statColumns.yellowCards.long,
  redCards: statColumns.redCards.long,
} as const;
/** The stats' own column, between the two clubs': its head is read out, not drawn. Each club's
 *  column is headed by its three letters, named by its full name. */
export const STAT_COLUMN = { short: STAT_WORD, long: "What's counted" };
/** A side's possession, to the whole percent: Opta's 49.4 is "49%". */
export const possessionWords = (share: number) => `${Math.round(share)}%`;

// The match page's tabs under the scoreboard, and Player stats (#2490; spec/10 S10.8, S10.11).

export const MATCH_TABS = ["overview", "playerStats", "highlights"] as const;
export type MatchTab = (typeof MATCH_TABS)[number];
export const matchTabWords: Record<MatchTab, string> = { overview: "Overview", playerStats: "Player stats", highlights: "Highlights" };
export const matchTabsLabel = "The match's tabs";
/** The Highlights tab, greyed until it is built (S10.11). */
export const highlightsNotHeldLabel = "The match's YouTube highlights: not held yet";
export const playerStatsLabel = (club: string) => `${club}'s player stats`;
/** Player stats' columns, as the approved picture heads them: a short head, and what it stands for. */
export const matchStatColumns = {
  position: { short: "Pos", long: "Position" },
  player: { short: "Player", long: "Player" },
  minutes: { short: "Min", long: statNames.minutes },
  goals: statColumns.goals,
  assists: statColumns.assists,
  shots: { short: "Sh", long: teamStatRows.shots },
  shotsOnTarget: { short: "SoT", long: teamStatRows.shotsOnTarget },
  shotsBlocked: { short: "ShB", long: "Shots blocked" },
  hitWoodwork: { short: "HW", long: "Hit woodwork" },
  bigChancesMissed: { short: "BCM", long: "Big chances missed" },
  keyPasses: { short: "KP", long: statNames.keyPasses },
  tackles: { short: "Tkl", long: "Tackles" },
  cleanSheets: statColumns.cleanSheets,
  goalsConceded: { short: "GC", long: statNames.goalsConceded },
  saves: { short: "Sv", long: "Saves" },
  yellowCards: statColumns.yellowCards,
  redCards: statColumns.redCards,
  points: matchColumns.points,
} as const;
/** The Stats | Points switch at the right of the tabs row (S10.8): Points swaps each stat's count
 *  for the points it earned him. */
export const STAT_VIEWS = ["stats", "points"] as const;
export type StatView = (typeof STAT_VIEWS)[number];
export const statViewWords: Record<StatView, string> = { stats: "Stats", points: "Points" };
export const statViewLabel = "Show each stat's count or its points";
/** A stat's points in the Points view, signed ("+2", "−1"); the dash where it earned none, as the
 *  approved picture draws it. */
export const statPointsWords = (points: number | null) => (points === null || points === 0 ? noFigureWords : signedWords(points));
/** The List | Pitch switch at the right of the tabs row while Overview is open (S10.9): the lineups
 *  as two team sheets or on one pitch. */
export const LINEUP_VIEWS = ["list", "pitch"] as const;
export type LineupView = (typeof LINEUP_VIEWS)[number];
export const lineupViewWords: Record<LineupView, string> = { list: "List", pitch: "Pitch" };
export const lineupViewLabel = "Show the lineups as team sheets or on a pitch";
/** The pitch's head, each side's name and its formation ("Chelsea, 4-2-3-1"); the name alone while
 *  no sheet drawing it is held. */
export const sideFormationWords = (club: string, formation: string | null) => (formation === null ? club : `${club}, ${formation}`);
export const matchPitchLabel = (home: string, away: string) => `${home} and ${away} on the pitch`;
/** A man's panel atop Overview's right column, opened by his name (S10.9): this match's points by stat, then his card. */
export const manPanelLabel = (name: string) => `${name}'s points in this match`;
export const manPanelColumns = { stat: { short: "This match", long: "What he did in this match" }, count: { short: "No.", long: "How many" }, points: { short: "Pts", long: "The points it earned him" } } as const;
export const manPanelWords = { total: "Total", hisCard: "His card" } as const;

// A club's page (#1936; spec/18, Club pages).

export { placeWords } from "../shared/words";
export const loadingClubWords = "Loading the club…";
export const noClubWords = "No club with this code is held.";
/** The club page's tabs on its title plate, the Squad tab first (spec/18). */
export const CLUB_TABS = ["squad", "fixtures"] as const;
export type ClubTab = (typeof CLUB_TABS)[number];
export const clubTabWords: Record<ClubTab, string> = { squad: "Squad", fixtures: "Fixtures" };
export const clubTabsLabel = "The club's tabs";
export const CLUB_TITLE = "Club";
export const NEXT_MATCH_TITLE = "Next match";
/** The club's ground, its capacity and its manager in the header, from Sportmonks (`S18.7`, #1938). */
export const CLUB_DETAIL_HEADS = { stadium: "Stadium", capacity: "Capacity", manager: "Manager" } as const;
export type ClubDetail = keyof typeof CLUB_DETAIL_HEADS;
/** A detail the feed hasn't sent, on its greyed placeholder: "Stadium: not held yet". */
export const detailNotHeldLabel = (detail: ClubDetail) => `${CLUB_DETAIL_HEADS[detail]}: not held yet`;
/** A ground's capacity: "60,704". */
export { thousandsWords as capacityWords } from "../shared/words";
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

// The club page's Squad tab and top scorers (#1937; spec/18 `S18.7`, `S18.8`).

export { statusNotSettledLabel } from "../shared/match/words";
/** The club's top three scorers, under its table place and form: "Saka 42". */
export const topScorersHead = "Top scorers";
export const loadingSquadWords = "Loading the squad…";
export const noSquadWords = "No players are held at this club.";
/** In the Team column, a player on the league's waivers. */
export const waiversWords = "Waivers";
/** Why his season points are "—", as Scouting says it. */
export { noSeasonPointsWords } from "../shared/words";
/** Why a gameweek's cell is "—". */
export const didNotPlayWords = (gameweek: number) => `He didn't play in ${gameweekWords(gameweek)}.`;
/** A row, read out: pressing it opens his player card. */
export const openCardLabel = (name: string) => `${name}'s player card`;

/** The Squad tab's columns, the last five gameweeks' between the points and the starts: a short
 *  head, and what it stands for. The points' head names the season while they are last season's. */
export function squadColumns(gameweeks: readonly number[], pointsSeason: number | null) {
  return {
    positions: { short: "Pos", long: "Positions" },
    player: { short: "Player", long: "Player" },
    owner: { short: "Team", long: "The team that owns him in this league, Free agent or Waivers" },
    points: pointsSeason === null ? { short: "Pts", long: "Season points in this league" } : lastSeasonPointsColumn(pointsSeason),
    ...Object.fromEntries(gameweeks.map((gameweek) => [`gw${gameweek}`, { short: gameweekShort(gameweek), long: `Points in ${gameweekWords(gameweek)}` }])),
    starts: { short: "St", long: pointsSeason === null ? "Starts this season" : `Starts in ${seasonShortWords(pointsSeason)}` },
    minutes: { short: "Mins", long: pointsSeason === null ? "Minutes this season" : `Minutes in ${seasonShortWords(pointsSeason)}` },
  };
}

/** The Fixtures tab's columns: a short head, and what it stands for. */
export const clubFixtureColumns = {
  gameweek: gameweekColumn,
  opponent: { short: "Opponent", long: "Opponent, home or away" },
  result: { short: "Result", long: "Result or kick-off" },
} as const;
