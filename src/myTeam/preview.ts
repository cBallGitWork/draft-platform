// My team's tabs in the preview (src/app/preview.ts): the preview manager's team in the table
// preview's league, so the Fixtures tab and the table and fixtures screen show the same draw and
// scores, a few of the commissioner's squad changes on its Transactions tab, and on its Squad tab
// the Tactics tab's squad, with made-up seasons, and Mail's preview letters.

import { CLUB_COLOURS } from "../../convex/football/clubColours";
import { adminByline } from "../../convex/mail/letterWords";
import { LATEST_LETTERS } from "../../convex/mail/mailLimits";
import { DAY_MS, HOUR_MS, WEEK_MS } from "../../convex/shared/time";
import { previewMail, previewTopBar } from "../mail/preview";
import { teamFixturesOf } from "../table/drawnTable";
import { previewScored, previewTeams } from "../table/preview";
import { previewSquad, previewTactics } from "./tactics/preview";
import type { MyTeamSeam, TeamSquad, TeamTransactions } from "./seam";

const [previewTeam, otherTeam] = previewTeams;
const fixtures = teamFixturesOf(previewTeams, previewTeam, previewScored);

const commissioner = "commish@example.com";
const transactions: TeamTransactions = {
  transactions: [
    { at: Date.now() - 2 * HOUR_MS, kind: "released", playerCode: 3, playerName: "Martinelli", otherTeamName: null, by: commissioner },
    { at: Date.now() - 26 * HOUR_MS, kind: "movedIn", playerCode: 2, playerName: "Gabriel", otherTeamName: otherTeam, by: commissioner },
    { at: Date.now() - 50 * HOUR_MS, kind: "assigned", playerCode: 3, playerName: "Martinelli", otherTeamName: null, by: adminByline },
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

const NOTHING_COUNTED = { appearances: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, saves: 0, yellowCards: 0, redCards: 0 };

/** A made-up season for each of the Tactics tab's players, worked out from his code so a reload
 *  shows the same; the last one has played nothing yet, and two carry FPL news. */
const squad: TeamSquad = {
  teamName: previewTeam,
  lastGameweek: 8,
  unheld: [],
  squadMaximum: 20,
  players: previewSquad.map(({ playerCode: code, name, clubCode, clubShortName, positions, number }) => {
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
      seasonPoints: unplayed ? null : 20 + ((code * 17) % 60),
      lastGameweekPoints: unplayed ? null : (code * 7) % 14,
      form: unplayed ? [null, null, null, null, null] : [0, 1, 2, 3, 4].map((week) => (code * 5 + week * 3) % 13),
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
  }),
};

/** The preview holds no server: a number changed there is taken, and goes when the page reloads. */
const previewNumbers = { set: async () => null };
const latestMail = { letters: previewMail.useLetters()!.slice(0, LATEST_LETTERS), unread: previewTopBar.unreadMail };

export const previewMyTeam: MyTeamSeam = {
  ...previewTactics,
  useTeamFixtures: () => fixtures,
  useTeamTransactions: () => transactions,
  useTeamSquad: () => squad,
  useSquadNumbers: () => previewNumbers,
  useLatestMail: () => latestMail,
};
