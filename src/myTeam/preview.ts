// My team's tabs in the preview (src/app/preview.ts): the preview manager's team in the table
// preview's league, so the Fixtures tab and the table and fixtures screen show the same draw and
// scores, the approved picture's history on its Transactions tab, and on its Squad tab
// the Tactics tab's squad, with made-up seasons, and Mail's preview letters.

import { CLUB_COLOURS } from "../../convex/football/clubColours";
import { adminByline } from "../../convex/mail/letterWords";
import { DAY_MS, HOUR_MS, WEEK_MS } from "../../convex/shared/time";
import { squadLimits } from "../../convex/squads/squadLimits";
import { previewLatestMail } from "../mail/preview";
import { teamFixturesOf } from "../table/drawnTable";
import { previewIdOf, previewScored, previewTable, previewTeams } from "../table/preview";
import { previewSquad, previewTactics } from "./tactics/preview";
import { previewClaims } from "./claims/preview";
import type { MyAutoTeam, MyTeamSeam, TeamSquad, TeamTransactions } from "./seam";

const [previewTeam, otherTeam] = previewTeams;
const fixtures = teamFixturesOf(previewTeams, previewTeam, previewScored);

const commissioner = "commish@example.com";
const transactions: TeamTransactions = {
  transactions: [
    {
      at: Date.now() - 2 * HOUR_MS,
      kind: "traded",
      in: { players: [{ playerCode: 6, playerName: "Palmer" }], picks: [] },
      out: { players: [{ playerCode: 7, playerName: "Watkins" }, { playerCode: 8, playerName: "Gvardiol" }], picks: [] },
      otherTeamName: otherTeam,
      by: commissioner,
      yours: false,
    },
    { at: Date.now() - 26 * HOUR_MS, kind: "movedOut", playerCode: 8, playerName: "Gvardiol", otherTeamName: otherTeam, dropped: null, by: commissioner, yours: false },
    { at: Date.now() - 50 * HOUR_MS, kind: "claimed", playerCode: 5, playerName: "Mbeumo", otherTeamName: null, dropped: { playerCode: 9, playerName: "Livramento" }, by: commissioner, yours: true },
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

/** Every club the preview's players meet, by its colours' table: its code and short name, which
 *  stands in for its name. */
const CLUBS = Object.entries(CLUB_COLOURS).map(([code, { shortName }]) => ({ code: Number(code), name: shortName, shortName }));
const FIRST_KICKOFF = Date.now() + 2 * DAY_MS;
/** Three matches ahead for a player's club, its opponents taken in turn from the clubs. */
const nextMatches = (seed: number) =>
  [0, 1, 2].map((week) => ({ gameweek: 9 + week, kickoff: FIRST_KICKOFF + week * WEEK_MS, opponent: CLUBS[(seed * 3 + week) % CLUBS.length], home: (seed + week) % 2 === 0 }));

/** The Schedule view's gameweeks, from the one being set (squadSchedule.ts's six). */
const scheduleGameweeks = [9, 10, 11, 12, 13, 14];
/** His club's matches in those gameweeks, one a week from its next three's opponents on: one in
 *  three clubs has a blank week, the gameweek after it a double. */
const scheduleOf = (seed: number) =>
  scheduleGameweeks.flatMap((gameweek, week) => {
    const blank = seed % 3 === 0 && week === 2;
    const double = seed % 3 === 0 && week === 3;
    if (blank) return [];
    const match = (extra: number) => ({
      gameweek,
      kickoff: FIRST_KICKOFF + week * WEEK_MS + extra * DAY_MS,
      opponent: CLUBS[(seed * 3 + week + extra) % CLUBS.length],
      home: (seed + week + extra) % 2 === 0,
    });
    return double ? [match(0), match(3)] : [match(0)];
  });
/** The preview league's squad limits, for the Rules view. */
const PREVIEW_SQUAD_RULES = {
  size: { minimum: 13, maximum: 20 },
  minimumByArea: { goalkeeper: 2, defence: 5, defensiveMidfield: 0, midfield: 4, attackingMidfield: 0, attack: 2 },
  maxPerClub: 3,
};

const NOTHING_COUNTED ={ appearances: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, saves: 0, yellowCards: 0, redCards: 0 };

/** A made-up season for each of the Tactics tab's players, worked out from his code so a reload
 *  shows the same; the last one has played nothing yet, and two carry FPL news. */
const players: TeamSquad["players"] = previewSquad.map(({ playerCode: code, name, clubCode, clubShortName, positions, number }) => {
    const unplayed = code === previewSquad.length;
    const keeper = positions.includes("GK");
    return {
      code,
      name,
      fullName: name,
      positions,
      club: { code: clubCode, name: clubShortName, shortName: clubShortName },
      gone: false,
      number,
      nextFixtures: nextMatches(code),
      schedule: scheduleOf(code),
      seasonPoints: unplayed ? null : 20 + ((code * 17) % 60),
      lastGameweekPoints: unplayed ? null : (code * 7) % 14,
      form: unplayed ? [null, null, null, null, null] : [0, 1, 2, 3, 4].map((week) => (code * 5 + week * 3) % 13),
      started: unplayed ? 0 : 3 + (code % 5),
      rolePoints: unplayed ? null : (code % 7) - 2,
      // One who hasn't played has nothing counted, as his totals row would hold (seasonStats.ts).
      stats: unplayed ? NOTHING_COUNTED : {
        appearances: 5 + (code % 4),
        minutes: 400 + ((code * 37) % 320),
        goals: keeper ? 0 : (code * 3) % 8,
        assists: keeper ? 0 : (code * 2) % 5,
        cleanSheets: (code * 5) % 4,
        saves: keeper ? 15 + code : 0,
        yellowCards: code % 3,
        redCards: code === 7 ? 1 : 0,
      },
      news: code === 10 ? "Knock - 75% chance of playing" : code === 15 ? "Hamstring injury - Expected back 22 Nov" : null,
      chanceOfPlaying: code === 10 ? 75 : code === 15 ? 0 : null,
    };
  });
const squad: TeamSquad = {
  teamName: previewTeam,
  lastGameweek: 8,
  unheld: [],
  squadMaximum: PREVIEW_SQUAD_RULES.size.maximum,
  players,
  scheduleGameweeks,
  limits: squadLimits(players, 0, PREVIEW_SQUAD_RULES),
};

/** The preview holds no server: a number changed there is taken, and goes when the page reloads. */
const previewNumbers = { set: async () => null };
const previewAutoTeam: MyAutoTeam = { teamId: previewIdOf(previewTeam), on: false, endsAfter: null };
const previewAutoTeamChanges = { set: async () => null };

export const previewMyTeam: MyTeamSeam = {
  ...previewTactics,
  ...previewTable,
  ...previewClaims,
  useTeamFixtures: () => fixtures,
  useTeamTransactions: () => transactions,
  useTeamSquad: () => squad,
  // Any team's squad, read-only, is the preview manager's own players under the asked team's name.
  useOtherSquad: (_leagueId, teamId) => ({
    teamName: previewTeams.find((team) => previewIdOf(team) === teamId) ?? otherTeam,
    players: players.map(({ code, name, fullName, positions, club, gone, seasonPoints }) => ({ code, name, fullName, positions, club, gone, seasonPoints })),
  }),
  useSquadNumbers: () => previewNumbers,
  useLatestMail: () => previewLatestMail,
  // Off, as the approved picture draws it; the preview holds no server, so a switch goes nowhere.
  useMyAutoTeam: () => previewAutoTeam,
  useAutoTeamChanges: () => previewAutoTeamChanges,
};
