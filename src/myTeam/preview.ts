// My team's tabs in the preview (src/preview.ts): the preview manager's team in the table
// preview's league, so the Fixtures tab and the table and fixtures screen show the same draw, and
// a few of the commissioner's squad changes on its Transactions tab, and a squad on its Squad tab.

import { adminByline } from "../../convex/mail/letterWords";
import { DAY_MS, HOUR_MS } from "../../convex/shared/time";
import { teamFixturesOf } from "../table/drawnTable";
import { previewSeason, previewTeams } from "../table/preview";
import { previewTactics } from "./previewTactics";
import type { MyTeamSeam, TeamSquad, TeamTransactions } from "./seam";

const [previewTeam, otherTeam] = previewTeams;
const fixtures = teamFixturesOf(previewTeams, previewTeam, previewSeason);

const commissioner = "commish@example.com";
const transactions: TeamTransactions = {
  transactions: [
    { at: Date.now() - 2 * HOUR_MS, kind: "released", playerCode: 3, playerName: "Martinelli", otherTeamName: null, by: commissioner },
    { at: Date.now() - 26 * HOUR_MS, kind: "movedIn", playerCode: 2, playerName: "Gabriel", otherTeamName: otherTeam, by: commissioner },
    { at: Date.now() - 50 * HOUR_MS, kind: "assigned", playerCode: 3, playerName: "Martinelli", otherTeamName: null, by: adminByline },
  ],
  cut: false,
};

const arsenal = { code: 3, name: "Arsenal", shortName: "ARS" };
const chelsea = { code: 8, name: "Chelsea", shortName: "CHE" };
const newcastle = { code: 23, name: "Newcastle United", shortName: "NEW" };
const nextMatch = (opponent: typeof arsenal, home: boolean) => ({ gameweek: 9, kickoff: Date.now() + 2 * DAY_MS, opponent, home });
const squadPlayer = (code: number, name: string, positions: TeamSquad["players"][number]["positions"], club: typeof arsenal, points: [number | null, number | null]) => ({
  code,
  name,
  fullName: name,
  positions,
  club,
  gone: false,
  nextFixture: nextMatch(club === arsenal ? chelsea : arsenal, club !== chelsea),
  seasonPoints: points[0],
  lastGameweekPoints: points[1],
});
const squad: TeamSquad = {
  teamName: previewTeam,
  lastGameweek: 8,
  players: [
    squadPlayer(1, "Raya", ["GK"], arsenal, [41, 6]),
    squadPlayer(2, "Gabriel", ["CB"], arsenal, [52, 2]),
    squadPlayer(4, "Trippier", ["FB", "WB"], newcastle, [33, null]),
    squadPlayer(5, "Caicedo", ["CDM", "CM"], chelsea, [38, 5]),
    squadPlayer(6, "Palmer", ["CAM", "W"], chelsea, [71, 13]),
    squadPlayer(3, "Martinelli", ["W"], arsenal, [44, 1]),
    { ...squadPlayer(7, "Isak", ["ST"], newcastle, [null, null]), nextFixture: null },
  ],
};

export const previewMyTeam: MyTeamSeam = { ...previewTactics, useTeamFixtures: () => fixtures, useTeamTransactions: () => transactions, useTeamSquad: () => squad };
