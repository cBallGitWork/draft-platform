// My team's tabs in the preview (src/app/preview.ts): the preview manager's team in the table
// preview's league, so the Fixtures tab and the table and fixtures screen show the same draw and
// scores, the approved picture's history on its Transactions tab, and on its Squad tab
// the Tactics tab's squad, each player's season his card's, and Mail's preview letters.

import { seasonGameweeks } from "../../convex/gameweeks/usedGameweeks";
import { adminByline } from "../../convex/mail/letterWords";
import { DAY_MS, HOUR_MS } from "../../convex/shared/time";
import { ASSISTS, CLEAN_SHEETS, GOALS, MINUTES_STAT, RED_CARDS, SAVES, YELLOW_CARDS } from "../../convex/stats/matchRecords";
import type { GameweekMatch } from "../premierLeague/seam";
import { previewClubMatch, previewClubUpcoming } from "../premierLeague/preview";
import { previewSeasonOf } from "../playerCard/preview";
import type { PlayedMatch } from "../playerCard/seam";
import { FORM_GAMEWEEKS, NEXT_MATCHES_SHOWN, SCHEDULE_GAMEWEEKS } from "../../convex/squads/squadLimits";
import { squadLimits } from "../../convex/squads/squadRulesView";
import { previewLatestMail } from "../mail/preview";
import { MOST_IN_SQUAD } from "../../convex/leagues/leagueLimits";
import { previewAtLimits, previewDone, previewGameweek, previewSeasonGameweeks, previewTeamNames } from "../shared/preview";
import { teamFixturesOf } from "../table/drawnTable";
import { previewScored, previewTable } from "../table/preview";
import { previewIdOf } from "../shared/previewDraw";
import { PREVIEW_GAMEWEEK, previewChanceOf, previewSquad, previewTactics } from "./tactics/preview";
import { previewClaims } from "./claims/preview";
import type { MyAutoTeam, MyTeamSeam, TeamSquad, TeamTransactions } from "./seam";

const [previewTeam, otherTeam] = previewTeamNames;
const fixtures = teamFixturesOf(previewTeamNames, previewTeam, previewScored);

const commissioner = "commish@example.com";
const transactions: TeamTransactions = {
  transactions: [
    {
      at: Date.now() - 2 * HOUR_MS,
      kind: "traded",
      in: { players: [{ playerCode: 4, playerName: "Palmer" }], picks: [] },
      out: { players: [{ playerCode: 48, playerName: "Kerkez" }, { playerCode: 49, playerName: "Martínez" }], picks: [] },
      otherTeamName: otherTeam,
      by: commissioner,
      yours: false,
    },
    { at: Date.now() - 26 * HOUR_MS, kind: "movedOut", playerCode: 47, playerName: "Wan-Bissaka", otherTeamName: otherTeam, dropped: null, by: commissioner, yours: false },
    { at: Date.now() - 50 * HOUR_MS, kind: "claimed", playerCode: 17, playerName: "Mbeumo", otherTeamName: null, dropped: { playerCode: 9, playerName: "Livramento" }, by: commissioner, yours: true },
    { at: Date.now() - 4 * DAY_MS, kind: "dropped", playerCode: 10, playerName: "Konsa", otherTeamName: null, dropped: null, by: commissioner, yours: true },
    { at: Date.now() - 6 * DAY_MS, kind: "pickedUp", playerCode: 4, playerName: "Calvert-Lewin", otherTeamName: null, dropped: { playerCode: 11, playerName: "Kamara" }, by: commissioner, yours: true },
    { at: Date.now() - 8 * DAY_MS, kind: "assigned", playerCode: 3, playerName: "Martinelli", otherTeamName: null, dropped: null, by: adminByline, yours: false },
    {
      at: Date.now() - 10 * DAY_MS,
      kind: "traded",
      in: { players: [], picks: [{ round: 4, teamId: previewIdOf(otherTeam), teamName: otherTeam }] },
      out: { players: [], picks: [{ round: 6, teamId: previewIdOf(previewTeam), teamName: previewTeam }] },
      otherTeamName: otherTeam,
      by: commissioner,
      yours: false,
    },
  ],
  cut: false,
};

/** A match of his club's in Football's preview as a squad row reads it: its opponent and whether
 *  at home. */
const fromHisSide = (clubCode: number, { gameweek, kickoff, home, away }: Pick<GameweekMatch, "kickoff" | "home" | "away"> & { gameweek: number }) => ({
  gameweek,
  kickoff: kickoff ?? 0,
  opponent: home.code === clubCode ? away : home,
  home: home.code === clubCode,
});
/** His club's next three matches in Football's preview, as his card has them (#2455). */
const nextMatches = (clubCode: number) => previewClubUpcoming(clubCode).slice(0, NEXT_MATCHES_SHOWN).map((match) => fromHisSide(clubCode, match));

/** The Schedule view's gameweeks, from the one being set (squadSchedule.ts's six). */
const scheduleGameweeks = Array.from({ length: SCHEDULE_GAMEWEEKS }, (_, week) => PREVIEW_GAMEWEEK + week);
/** His club's matches in those gameweeks, Football's preview's: one in each. */
const scheduleOf = (clubCode: number) =>
  scheduleGameweeks.flatMap((gameweek) => {
    const match = previewClubMatch(gameweek, clubCode);
    return match === undefined ? [] : [fromHisSide(clubCode, { ...match, gameweek })];
  });

/** His season's totals from his card's matches. */
const totalOf = (matches: readonly PlayedMatch[], stat: string) => matches.reduce((sum, { stats }) => sum + (stats?.[stat] ?? 0), 0);
/** The preview league's squad limits, for the Rules view: at the league limits, its squads hold a
 *  Premier League squad's most. */
const PREVIEW_SQUAD_RULES = {
  size: { minimum: 13, maximum: previewAtLimits ? MOST_IN_SQUAD : 20 },
  minimumByArea: { goalkeeper: 2, defence: 5, defensiveMidfield: 0, midfield: 4, attackingMidfield: 0, attack: 2 },
  maxPerClub: 3,
};


/** Each of the Tactics tab's players' season, his card's (../playerCard/preview.ts) added up, so
 *  the card and this tab tell the same minutes, points and next matches (#2455); the last one has
 *  played nothing yet, and two carry FPL news. */
const LAST_GAMEWEEK = previewGameweek - 1;
const players: TeamSquad["players"] = previewSquad.map(({ playerCode: code, name, clubCode, clubShortName, positions, number, news }) => {
  const { matches, seasonPoints, pointsIn } = previewSeasonOf(code);
  return {
    code,
    name,
    fullName: name,
    positions,
    club: { code: clubCode, name: clubShortName, shortName: clubShortName },
    gone: false,
    number,
    nextFixtures: nextMatches(clubCode),
    schedule: scheduleOf(clubCode),
    seasonPoints,
    lastGameweekPoints: pointsIn(LAST_GAMEWEEK),
    form: Array.from({ length: FORM_GAMEWEEKS }, (_, week) => pointsIn(LAST_GAMEWEEK - FORM_GAMEWEEKS + 1 + week)),
    started: matches.filter(({ minutes }) => (minutes ?? 0) >= 60).length,
    rolePoints: matches.length > 0 ? (code % 7) - 2 : null,
    // One who hasn't played has nothing counted, as his totals row would hold (seasonStats.ts).
    stats: {
      appearances: matches.length,
      minutes: totalOf(matches, MINUTES_STAT),
      goals: totalOf(matches, GOALS),
      assists: totalOf(matches, ASSISTS),
      cleanSheets: totalOf(matches, CLEAN_SHEETS),
      saves: totalOf(matches, SAVES),
      yellowCards: totalOf(matches, YELLOW_CARDS),
      redCards: totalOf(matches, RED_CARDS),
    },
    news,
    chanceOfPlaying: previewChanceOf(code),
  };
});
const squad: TeamSquad = {
  teamName: previewTeam,
  lastGameweek: LAST_GAMEWEEK,
  unheld: [],
  squadMaximum: PREVIEW_SQUAD_RULES.size.maximum,
  players,
  scheduleGameweeks,
  limits: squadLimits(players, 0, PREVIEW_SQUAD_RULES),
};

/** The preview holds no server: a number changed there is taken, and goes when the page reloads. */
const previewNumbers = { set: previewDone };
const previewAutoTeam: MyAutoTeam = {
  teamId: previewIdOf(previewTeam),
  on: false,
  endsAfter: null,
  endGameweeks: seasonGameweeks(previewSeasonGameweeks).filter((gameweek) => gameweek >= scheduleGameweeks[0]!),
};
const previewAutoTeamChanges = { set: previewDone };
const PREVIEW_AWARDS = ["2026-09"];

export const previewMyTeam: MyTeamSeam = {
  ...previewTactics,
  ...previewTable,
  ...previewClaims,
  useTeamFixtures: () => fixtures,
  useTeamTransactions: () => transactions,
  useTeamSquad: () => squad,
  // Any team's squad, read-only, is the preview manager's own players under the asked team's name.
  useOtherSquad: (_leagueId, teamId) => ({
    teamName: previewTeamNames.find((team) => previewIdOf(team) === teamId) ?? otherTeam,
    players: players.map(({ code, name, fullName, positions, club, gone, seasonPoints }) => ({ code, name, fullName, positions, club, gone, seasonPoints })),
  }),
  // Every team was Manager of the Month once in the preview, so each page shows where awards sit.
  useTeamAwards: () => PREVIEW_AWARDS,
  useSquadNumbers: () => previewNumbers,
  useLatestMail: () => previewLatestMail,
  // Off, as the approved picture draws it; the preview holds no server, so a switch goes nowhere.
  useMyAutoTeam: () => previewAutoTeam,
  useAutoTeamChanges: () => previewAutoTeamChanges,
};
