// The Tactics tab in the preview (src/app/preview.ts): a squad of real players in a 4-2-3-1 with four on
// the bench, under the first rules, the deadline a day and a half off. A save is judged by the
// server's own check (lineup.ts) and said in its words, so a refusal shows as it would live.

import { useSyncExternalStore } from "react";
import { lineupProblems } from "../../../convex/lineup/lineup";
import { problemWords } from "../../../convex/lineup/lineupWords";
import { CLUB_COLOURS } from "../../../convex/football/clubColours";
import { areasOf, cellsOf, LANES, type Cell } from "../../../convex/lineup/pitch";
import { everyRoleOf } from "../../../convex/lineup/roles";
import { NO_DATA, UNSURE, type RoleStars } from "../../../convex/stars/starsShape";
import type { Position } from "../../../convex/positions/positionTables";
import { FIRST_RULES, instructionsOf } from "../../../convex/rules/firstRules";
import { keptOrSwitched } from "../../../convex/lineup/instructions";
import { DAY_MS, HOUR_MS } from "../../../convex/shared/time";
import type { DraftLineup } from "./lineupDraft";
import type { Tactics, TacticsSeam } from "./seam";

const PREVIEW_GAMEWEEK = 9;
const PREVIEW_DEADLINE = Date.now() + DAY_MS + 17 * HOUR_MS;

/** A club's FPL code by its short name, for its shirt's colours. */
const clubCodeOf = (shortName: string) => Number(Object.entries(CLUB_COLOURS).find(([, club]) => club.shortName === shortName)![0]);

/** Each player: his code, name, club and positions, and his cell, or none for the bench. */
const PLAYERS: readonly [number, string, string, Position[], Cell | null][] = [
  [1, "Pickford", "EVE", ["GK"], { area: "goalkeeper", lane: "centre" }],
  [2, "Gvardiol", "MCI", ["CB", "FB"], { area: "defence", lane: "left" }],
  [3, "Gabriel", "ARS", ["CB"], { area: "defence", lane: "leftCentre" }],
  [4, "Van Dijk", "LIV", ["CB"], { area: "defence", lane: "rightCentre" }],
  [5, "Porro", "TOT", ["FB", "WB"], { area: "defence", lane: "right" }],
  [6, "Caicedo", "CHE", ["CDM", "CM"], { area: "defensiveMidfield", lane: "leftCentre" }],
  [7, "Rice", "ARS", ["CDM", "CM"], { area: "defensiveMidfield", lane: "rightCentre" }],
  [8, "Rogers", "AVL", ["W", "CAM"], { area: "attackingMidfield", lane: "left" }],
  [9, "Palmer", "CHE", ["CAM", "W"], { area: "attackingMidfield", lane: "centre" }],
  [10, "Saka", "ARS", ["W"], { area: "attackingMidfield", lane: "right" }],
  [11, "Haaland", "MCI", ["ST"], { area: "attack", lane: "centre" }],
  [12, "Henderson", "CRY", ["GK"], null],
  [13, "Murillo", "NFO", ["CB"], null],
  [14, "Mbeumo", "MUN", ["W", "ST"], null],
  [15, "Watkins", "AVL", ["ST"], null],
];

/** Made-up stars, as the preview's points are: a half-star step from his code and the role's place,
 *  for every role in every area he plays (as convex/stars/stars.ts's ratedRoles). Murillo has no
 *  match yet ("—") and Watkins too few to be sure ("?"). */
function previewStars(playerCode: number, positions: readonly Position[]): RoleStars[] {
  const roles = areasOf(positions).flatMap((area) => [...new Set(cellsOf(area, LANES).flatMap((cell) => everyRoleOf(cell).map(({ key }) => key)))].map((role) => ({ area, role })));
  return roles.map(({ area, role }, index) => ({
    area,
    role,
    stars: playerCode === 13 ? NO_DATA : playerCode === 15 ? UNSURE : 0.5 + ((playerCode * 7 + index * 3) % 10) / 2,
  }));
}

// Squad numbers are made up too: each player wears his code, the last one none yet (#13).
const squad = PLAYERS.map(([playerCode, name, clubShortName, positions]) => ({
  playerCode,
  name,
  clubShortName,
  clubCode: clubCodeOf(clubShortName),
  unheld: false,
  positions,
  flagged: [],
  number: playerCode === 15 ? null : playerCode,
  stars: previewStars(playerCode, positions),
}));
/** The squad, for the Squad tab's preview (../preview.ts), so both tabs show the same players. */
export const previewSquad = squad;
const positionsOf = new Map(squad.map(({ playerCode, positions }) => [playerCode, positions]));
const nameOf = (playerCode: number) => squad.find((member) => member.playerCode === playerCode)!.name;

const instructions = [...instructionsOf(FIRST_RULES)];

const tacticsWith = ({ starters, bench, instructions: picked }: DraftLineup): Tactics => ({
  kind: "open",
  gameweek: PREVIEW_GAMEWEEK,
  deadline: PREVIEW_DEADLINE,
  areaLimits: FIRST_RULES.areaLimits,
  presets: FIRST_RULES.presets,
  instructions,
  picked: keptOrSwitched(picked, starters, FIRST_RULES.presets, instructions).pair,
  squad,
  lineup: { fromGameweek: PREVIEW_GAMEWEEK, starters: [...starters], bench: [...bench], leftSquad: [], joinedBench: [], vacated: [], ...(picked && { instructions: picked }) },
});

// A new object only when it changes, as useSyncExternalStore needs.
let tactics = tacticsWith({
  starters: PLAYERS.flatMap(([playerCode, , , , cell]) => (cell === null ? [] : [{ playerCode, ...cell }])),
  bench: PLAYERS.flatMap(([playerCode, , , , cell]) => (cell === null ? [playerCode] : [])),
});
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

const changes = {
  save: async (_leagueId: unknown, lineup: DraftLineup) => {
    const problems = lineupProblems(lineup, positionsOf, { areaLimits: FIRST_RULES.areaLimits });
    if (problems.length > 0) return problems.map((problem) => problemWords(problem, nameOf)).join(" ");
    tactics = tacticsWith(lineup);
    for (const listener of listeners) listener();
    return PREVIEW_GAMEWEEK;
  },
};

export const previewTactics: TacticsSeam = {
  useTactics: () => useSyncExternalStore(subscribe, () => tactics),
  useLineupChanges: () => changes,
  useTacticsOpened: () => {},
};
