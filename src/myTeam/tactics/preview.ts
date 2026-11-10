// The Tactics tab in the preview (src/app/preview.ts): a squad of real players in a 4-2-3-1 with four on
// the bench, under the first rules, the deadline a day and a half off. A save is judged by the
// server's own check (lineup.ts) and said in its words, so a refusal shows as it would live. Saved
// plans start none. A role card prices made-up last matches as the server does (roleCardShape.ts).

import { useMemo, useSyncExternalStore } from "react";
import { cardRolesOf, pricedMatch } from "../../../convex/lineup/roleCardShape";
import { FIRST_SCORING_WITH_ROLES } from "../../../convex/scoring/draftedRoleAdjustments";
import { lineupProblems } from "../../../convex/lineup/lineup";
import { PLANS_KEPT, planRefusals, problemWords } from "../../../convex/lineup/lineupWords";
import { CLUB_COLOURS } from "../../../convex/football/clubColours";
import { areasOf, cellsOf, LANES, type Cell } from "../../../convex/lineup/pitch";
import { everyRoleOf } from "../../../convex/lineup/roles";
import { NO_DATA, UNSURE, type RoleStars } from "../../../convex/stars/starsShape";
import type { Position } from "../../../convex/positions/positionTables";
import { classicsOf, FIRST_RULES, instructionsOf } from "../../../convex/rules/firstRules";
import { keptOrSwitched } from "../../../convex/lineup/instructions";
import { DAY_MS, HOUR_MS } from "../../../convex/shared/time";
import type { EditedLineup } from "./lineupEdits";
import type { Plan, PlanChanges, Tactics, TacticsSeam } from "./seam";

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
  [5, "Muñoz", "CRY", ["FB", "WB"], { area: "defence", lane: "right" }],
  [6, "Guimarães", "NEW", ["CDM", "CM"], { area: "defensiveMidfield", lane: "leftCentre" }],
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
  availability: "available" as const,
}));
/** The squad, for the Squad tab's preview (../preview.ts), so both tabs show the same players. */
export const previewSquad = squad;
const positionsOf = new Map(squad.map(({ playerCode, positions }) => [playerCode, positions]));
const nameOf = (playerCode: number) => squad.find((member) => member.playerCode === playerCode)!.name;

const instructions = [...instructionsOf(FIRST_RULES)];

const tacticsWith = ({ starters, bench, classic, instructions: picked }: EditedLineup): Tactics => ({
  kind: "open",
  gameweek: PREVIEW_GAMEWEEK,
  deadline: PREVIEW_DEADLINE,
  areaLimits: FIRST_RULES.areaLimits,
  presets: FIRST_RULES.presets,
  classics: classicsOf(FIRST_RULES),
  instructions,
  picked: keptOrSwitched(picked, starters, FIRST_RULES.presets, instructions).pair,
  squad,
  lineup: {
    fromGameweek: PREVIEW_GAMEWEEK,
    starters: [...starters],
    bench: [...bench],
    leftSquad: [],
    joinedBench: [],
    vacated: [],
    ...(classic && { classic }),
    ...(picked && { instructions: picked }),
  },
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
  save: async (_leagueId: unknown, lineup: EditedLineup) => {
    const problems = lineupProblems(lineup, positionsOf, { areaLimits: FIRST_RULES.areaLimits });
    if (problems.length > 0) return problems.map((problem) => problemWords(problem, nameOf)).join(" ");
    tactics = tacticsWith(lineup);
    for (const listener of listeners) listener();
    return PREVIEW_GAMEWEEK;
  },
};

/** The preview's saved plans, kept as the server would: up to 5, a name it has replaced. */
let plans: readonly Plan[] = [];
const planChanges: PlanChanges = {
  save: async (_leagueId, name, slots) => {
    const kept = plans.some((plan) => plan.name === name);
    if (!kept && plans.length >= PLANS_KEPT) return planRefusals.full;
    plans = kept ? plans.map((plan) => (plan.name === name ? { name, slots } : plan)) : [...plans, { name, slots }];
    for (const listener of listeners) listener();
    return null;
  },
  remove: async (_leagueId, name) => {
    plans = plans.filter((plan) => plan.name !== name);
    for (const listener of listeners) listener();
    return null;
  },
};

/** The role card prices the preview's made-up matches under the roles' first values. */
const ROLE_SET = FIRST_SCORING_WITH_ROLES;
/** Clubs CLUB_COLOURS holds, for their shirts, and none of the squad's own. */
const OPPONENTS = ["BOU", "SUN", "BHA", "FUL", "BRE"];

/** Made-up last 5 matches for each player, from his code, as the preview's stars are; the last
 *  player (Watkins) has none yet, so his card says so. */
function previewMatches(playerCode: number) {
  if (playerCode === PLAYERS.length) return [];
  return OPPONENTS.map((shortName, index) => {
    const step = (playerCode * 5 + index * 3) % 7;
    const stats = { minutes: index === 4 ? 23 : 90, goals_scored: step === 6 ? 1 : 0, assists: step === 5 ? 1 : 0, accurate_pass: 20 + step * 6, fwd_pass: 8 + step * 2, ball_recovery: step, interception: step % 3, aerial_won: step % 4, won_tackle: step % 3 };
    const club = { code: clubCodeOf(shortName), name: shortName, shortName };
    return { stats, set: ROLE_SET, gameweek: PREVIEW_GAMEWEEK - 1 - index - (index >= 2 ? 1 : 0), pastSeason: null, opponent: { club, home: index % 2 === 0 } };
  });
}

export const previewTactics: TacticsSeam = {
  useTactics: () => useSyncExternalStore(subscribe, () => tactics),
  useRoleCard: (_leagueId, playerCode, cell, formation) =>
    useMemo(() => {
      const positions = squad.find((member) => member.playerCode === playerCode)?.positions ?? [];
      const roles = cardRolesOf(cell, formation, positions, ROLE_SET);
      return { roles, matches: previewMatches(playerCode).map((match) => pricedMatch(match, cell, roles.map(({ key }) => key))) };
      // A cell and a formation are new objects each render: their contents say whether the card changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playerCode, JSON.stringify(cell), JSON.stringify(formation)]),
  useLineupChanges: () => changes,
  usePlans: () => useSyncExternalStore(subscribe, () => plans),
  usePlanChanges: () => planChanges,
  useTacticsOpened: () => {},
};
