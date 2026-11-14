// The squads screen in the preview (src/app/preview.ts): two teams, one over the league's most and
// one holding a player the football data has lost, and a search that finds two men, one free.

import { MOST_IN_SQUAD } from "../../convex/leagues/leagueLimits";
import { limitsTeamNames, previewAtLimits, previewSays } from "../shared/preview";
import type { SquadsSeam, SquadWithWarnings } from "./seam";

const player = (code: number, name: string, clubShortName: string, gone = false) => ({ code, name, clubShortName, gone });
/** The second team's squad, one over its league's most: at the league limits, a full 25 (#2136). */
const BIG_SQUAD = previewAtLimits ? MOST_IN_SQUAD : 15;

const squads: SquadWithWarnings[] = [
  {
    teamId: "preview-team-1" as SquadWithWarnings["teamId"],
    teamName: previewAtLimits ? limitsTeamNames[4] : "Team 1",
    players: [player(1, "Saka", "ARS"), player(2, "Palmer", "CHE"), player(3, "Salah", "LIV"), player(4, "Gone", "BRE", true)],
    // A squad row the football sync no longer holds a player for (#323).
    unheld: [9999],
    warnings: [],
    // No manager, so on the auto team until it is handed on (the approved picture's Hull Hearts).
    managerEmail: null,
    autoTeam: { on: true, endsAfter: null, byManager: false },
  },
  {
    teamId: "preview-team-2" as SquadWithWarnings["teamId"],
    teamName: previewAtLimits ? limitsTeamNames[0] : "Saka Potatoes",
    players: Array.from({ length: BIG_SQUAD }, (_, i) => player(100 + i, `Player ${i + 1}`, ["ARS", "CHE", "LIV"][i % 3])),
    unheld: [],
    warnings: [{ kind: "overMaximum", players: BIG_SQUAD, maximum: BIG_SQUAD - 1 }],
    // Its manager's own switch, until a gameweek (the approved picture's Rovers XI).
    managerEmail: "sam@example.com",
    autoTeam: { on: true, endsAfter: 12, byManager: true },
  },
];

export const previewSquads: SquadsSeam = {
  useSquads: () => squads,
  useFoundPlayers: (_leagueId, text) =>
    text.trim()
      ? [
          { code: 1, name: "Saka", fullName: "Bukayo Saka", teamName: "Team 1" },
          { code: 9, name: "Isak", fullName: "Alexander Isak", teamName: null },
        ]
      : [],
  assign: previewSays("no player was assigned"),
  move: previewSays("no player was moved"),
  release: previewSays("no player was released"),
  switchAutoTeam: previewSays("no auto team was switched"),
};
