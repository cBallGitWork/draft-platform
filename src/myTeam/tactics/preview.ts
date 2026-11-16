// The Tactics tab in the preview (src/app/preview.ts): a squad of real players in a 4-2-3-1 with
// four on the bench (fourteen at the league limits, a full 25), under the first rules, the deadline
// a day and a half off. A save is judged by the server's own check (lineup.ts) and said in its
// words, so a refusal shows as it would live. Saved plans start none. A role card prices made-up last matches as the server does (roleCardShape.ts).

import { useMemo, useSyncExternalStore } from "react";
import { cardRolesOf, pricedMatch } from "../../../convex/lineup/roleCardShape";
import { FIRST_SCORING_WITH_ROLES } from "../../../convex/scoring/draftedRoleAdjustments";
import { FIRST_RUNS } from "../../../convex/scoring/draftedRoleRuns";
import { lineupProblems } from "../../../convex/lineup/lineup";
import { PLANS_KEPT, planRefusals, problemWords } from "../../../convex/lineup/lineupWords";
import { CLUB_COLOURS } from "../../../convex/football/clubColours";
import { areasOf, cellsOf, LANES, type Cell } from "../../../convex/lineup/pitch";
import { everyRoleOf } from "../../../convex/lineup/roles";
import { NO_DATA, UNSURE, type RoleStars } from "../../../convex/stars/starsShape";
import type { Position } from "../../../convex/positions/positionTables";
import { classicFormationsOf, FIRST_RULES, instructionsOf } from "../../../convex/rules/firstRules";
import { keptOrSwitched } from "../../../convex/lineup/instructions";
import { DAY_MS, HOUR_MS } from "../../../convex/shared/time";
import { previewAtLimits, previewGameMode, previewSaves } from "../../shared/preview";
import type { EditedLineup } from "./lineupEdits";
import type { Plan, PlanChanges, Tactics, TacticsSeam } from "./seam";

export const PREVIEW_GAMEWEEK = 9;
const PREVIEW_DEADLINE = Date.now() + DAY_MS + 17 * HOUR_MS;

/** A club's FPL code by its short name, for its shirt's colours. */
const clubCodeOf = (shortName: string) => Number(Object.entries(CLUB_COLOURS).find(([, club]) => club.shortName === shortName)![0]);

type PreviewPlayer = readonly [number, string, string, Position[], Cell | null];

/** At the league limits (#2136), ten more on the bench, so the squad holds a Premier League
 *  squad's most; still no more than three from a club. */
const LIMITS_BENCH: readonly PreviewPlayer[] = [
  [19, "Verbruggen", "BHA", ["GK"], null],
  [20, "Van de Ven", "TOT", ["CB"], null],
  [21, "Gusto", "CHE", ["FB", "WB"], null],
  [22, "Caicedo", "CHE", ["CDM", "CM"], null],
  [23, "Szoboszlai", "LIV", ["CM", "CAM"], null],
  [24, "Gibbs-White", "NFO", ["CAM", "CM"], null],
  [25, "Kudus", "TOT", ["W"], null],
  [26, "Semenyo", "BOU", ["W", "ST"], null],
  [27, "Isak", "LIV", ["ST"], null],
  [28, "Wood", "NFO", ["ST"], null],
];

/** The player with no match yet, so his role card and his season say so: Watkins. */
export const PREVIEW_UNPLAYED = 18;
/** The player with no match to rate, so his stars all say so: Murillo. */
const PREVIEW_UNRATED = 16;

/** Each player: his code, name, club and positions, and his cell, or none for the bench. One of
 *  Scouting's preview players (../../scouting/preview.ts) keeps his code there, so his Player card
 *  opens his own card (#2406); the rest take codes Scouting's players don't use. */
const PLAYERS: readonly PreviewPlayer[] = [
  [8, "Pickford", "EVE", ["GK"], { area: "goalkeeper", lane: "centre" }],
  [9, "Gvardiol", "MCI", ["CB", "FB", "WB"], { area: "defence", lane: "left" }],
  [10, "Gabriel", "ARS", ["CB"], { area: "defence", lane: "leftCentre" }],
  [7, "Van Dijk", "LIV", ["CB"], { area: "defence", lane: "rightCentre" }],
  [11, "Muñoz", "CRY", ["FB", "WB"], { area: "defence", lane: "right" }],
  [12, "Guimarães", "NEW", ["CDM", "CM"], { area: "defensiveMidfield", lane: "leftCentre" }],
  [2, "Rice", "ARS", ["CDM", "CM"], { area: "defensiveMidfield", lane: "rightCentre" }],
  [13, "Rogers", "AVL", ["W", "CAM"], { area: "attackingMidfield", lane: "left" }],
  [4, "Palmer", "CHE", ["CAM", "CM", "W"], { area: "attackingMidfield", lane: "centre" }],
  [1, "Saka", "ARS", ["W"], { area: "attackingMidfield", lane: "right" }],
  [14, "Haaland", "MCI", ["ST"], { area: "attack", lane: "centre" }],
  [15, "Henderson", "CRY", ["GK"], null],
  [PREVIEW_UNRATED, "Murillo", "NFO", ["CB"], null],
  [17, "Mbeumo", "MUN", ["W", "ST"], null],
  [PREVIEW_UNPLAYED, "Watkins", "AVL", ["ST"], null],
  ...(previewAtLimits ? LIMITS_BENCH : []),
];

/** Made-up stars, as the preview's points are: a half-star step from his code and the role's place,
 *  for every role in every area he plays (as convex/stars/stars.ts's ratedRoles). Murillo has no
 *  match yet ("—") and Watkins too few to be sure ("?"). */
function previewStars(playerCode: number, positions: readonly Position[]): RoleStars[] {
  const roles = areasOf(positions).flatMap((area) => [...new Set(cellsOf(area, LANES).flatMap((cell) => everyRoleOf(cell).map(({ key }) => key)))].map((role) => ({ area, role })));
  return roles.map(({ area, role }, index) => ({
    area,
    role,
    stars: playerCode === PREVIEW_UNRATED ? NO_DATA : playerCode === PREVIEW_UNPLAYED ? UNSURE : 0.5 + ((playerCode * 7 + index * 3) % 10) / 2,
  }));
}

/** Saka's made-up FPL news, which his card's preview (../../playerCard/preview.ts) shows too, as he
 *  is the same player there. */
export const PREVIEW_SAKA_NEWS = "Hamstring injury - 75% chance of playing";
/** FPL's news on two of them, made up: Saka, a starter, doubtful, and Watkins, on the bench, out. */
const NEWS = new Map([
  [1, { news: PREVIEW_SAKA_NEWS, chanceOfPlaying: 75 }],
  [PREVIEW_UNPLAYED, { news: "Hamstring injury - Expected back 22 Nov", chanceOfPlaying: 0 }],
]);
/** The first lineup's starters, in the pitch's order, for League home's preview. */
export const previewStarterCodes = PLAYERS.flatMap(([playerCode, , , , cell]) => (cell === null ? [] : [playerCode]));
/** FPL's chance he plays next round, null with no news on him. */
export const previewChanceOf = (playerCode: number) => NEWS.get(playerCode)?.chanceOfPlaying ?? null;

// Squad numbers are made up too: each player wears his place in the list, Watkins none yet (#13).
const squad = PLAYERS.map(([playerCode, name, clubShortName, positions], index) => ({
  playerCode,
  name,
  clubShortName,
  clubCode: clubCodeOf(clubShortName),
  unheld: false,
  positions,
  flagged: [],
  number: playerCode === PREVIEW_UNPLAYED ? null : index + 1,
  stars: previewStars(playerCode, positions),
  availability: "available" as const,
  news: NEWS.get(playerCode)?.news ?? null,
}));
/** The squad, for the Squad tab's preview (../preview.ts), so both tabs show the same players. */
export const previewSquad = squad;
const positionsOf = new Map(squad.map(({ playerCode, positions }) => [playerCode, positions]));
const nameOf = (playerCode: number) => squad.find((member) => member.playerCode === playerCode)!.name;

const instructions = [...instructionsOf(FIRST_RULES)];

const tacticsWith = ({ starters, bench, classicFormation, instructions: picked }: EditedLineup): Tactics => ({
  kind: "open",
  gameweek: PREVIEW_GAMEWEEK,
  deadline: PREVIEW_DEADLINE,
  areaLimits: FIRST_RULES.areaLimits,
  presets: FIRST_RULES.presets,
  classicFormations: classicFormationsOf(FIRST_RULES),
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
    ...(classicFormation && { classic: classicFormation }),
    ...(picked && { instructions: picked }),
  },
  mode: previewGameMode,
  runs: [...FIRST_RUNS],
});

/** The first lineup, each starter in his cell, then the bench: the matchup's preview plays it. */
export const previewFirstLineup = {
  starters: PLAYERS.flatMap(([playerCode, , , , cell]) => (cell === null ? [] : [{ playerCode, ...cell }])),
  bench: PLAYERS.flatMap(([playerCode, , , , cell]) => (cell === null ? [playerCode] : [])),
};

// A new object only when it changes, as useSyncExternalStore needs.
let tactics = tacticsWith(previewFirstLineup);
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

const changes = {
  save: previewSaves(async (_leagueId: unknown, lineup: EditedLineup) => {
    const problems = lineupProblems(lineup, positionsOf, { areaLimits: FIRST_RULES.areaLimits });
    if (problems.length > 0) return problems.map((problem) => problemWords(problem, nameOf)).join(" ");
    tactics = tacticsWith(lineup);
    for (const listener of listeners) listener();
    return PREVIEW_GAMEWEEK;
  }),
};

/** The preview's saved plans, kept as the server would: up to 5, a name it has replaced. */
let plans: readonly Plan[] = [];
const planChanges: PlanChanges = {
  save: previewSaves(async (...[, name, slots, instructions]: Parameters<PlanChanges["save"]>) => {
    const kept = plans.some((plan) => plan.name === name);
    if (!kept && plans.length >= PLANS_KEPT) return planRefusals.full;
    const saved = { name, slots, instructions };
    plans = kept ? plans.map((plan) => (plan.name === name ? saved : plan)) : [...plans, saved];
    for (const listener of listeners) listener();
    return null;
  }),
  remove: previewSaves(async (...[, name]: Parameters<PlanChanges["remove"]>) => {
    plans = plans.filter((plan) => plan.name !== name);
    for (const listener of listeners) listener();
    return null;
  }),
};

/** The role card prices the preview's made-up matches under the roles' first values. */
const ROLE_SET = FIRST_SCORING_WITH_ROLES;
/** Clubs CLUB_COLOURS holds, for their shirts, and none of the squad's own. */
const OPPONENTS = ["BOU", "SUN", "BHA", "FUL", "BRE"];

/** Made-up last 5 matches for each player, from his code, as the preview's stars are; Watkins has
 *  none yet, so his card says so. */
function previewMatches(playerCode: number) {
  if (playerCode === PREVIEW_UNPLAYED) return [];
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
