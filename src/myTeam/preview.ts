// My team's tabs in the preview (src/preview.ts): the preview manager's team in the table
// preview's league, so the Fixtures tab and the table and fixtures screen show the same draw, and
// a few of the commissioner's squad changes on its Transactions tab.

import { adminByline } from "../../convex/mail/letterWords";
import { HOUR_MS } from "../../convex/shared/time";
import { teamFixturesOf } from "../table/drawnTable";
import { previewSeason, previewTeams } from "../table/preview";
import type { MyTeamSeam, TeamTransactions } from "./seam";

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

export const previewMyTeam: MyTeamSeam = { useTeamFixtures: () => fixtures, useTeamTransactions: () => transactions };
