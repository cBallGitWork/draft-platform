// The squads screen in the preview (src/preview.ts): two teams, one over the league's most, and a
// search that finds two men, one free.

import { previewSays } from "../preview";
import type { SquadsSeam, TeamSquad } from "./seam";

const player = (code: number, name: string, clubShortName: string, gone = false) => ({ code, name, clubShortName, gone });

const squads: TeamSquad[] = [
  {
    teamId: "preview-team-1" as TeamSquad["teamId"],
    teamName: "Team 1",
    players: [player(1, "Saka", "ARS"), player(2, "Palmer", "CHE"), player(3, "Salah", "LIV"), player(4, "Gone", "BRE", true)],
    warnings: [],
  },
  {
    teamId: "preview-team-2" as TeamSquad["teamId"],
    teamName: "Saka Potatoes",
    players: Array.from({ length: 15 }, (_, i) => player(100 + i, `Player ${i + 1}`, ["ARS", "CHE", "LIV"][i % 3])),
    warnings: [{ kind: "overMaximum", players: 15, maximum: 14 }],
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
};
