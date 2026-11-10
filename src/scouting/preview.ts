// Scouting in the preview (src/app/preview.ts): a few players at three clubs, two of them owned and one on waivers, a few
// stats added up for each over the season and over the last 6 and 4 gameweeks, filtered and sorted
// by the server's own rule (listOf).

import type { ListedPlayer } from "../../convex/scouting/playersList";
import { mainArea, per90FiguresIn, per90PanelOf, totalOf } from "../../convex/scouting/per90Figures";
import { cardOpensAt } from "../../convex/playerCard/cardPoints";
import { MINUTES_STAT } from "../../convex/stats/matchRecords";
import { proLeague } from "../shared/preview";
import { listFigures, listOf, NO_FIGURES, shownStat } from "../../convex/scouting/playersOrder";
import { raceOrder } from "../../convex/scouting/raceOrder";
import { withOwnStats } from "../../convex/scoring/ownStats";
import { OWN_STAT_PREFIX } from "../../convex/scoring/statCatalogue";
import type { Stats } from "../../convex/stats/statTotals";
import { DAY_MS } from "../../convex/shared/time";
import { listedFromScouting, queueInPreview, setPreviewShortlisted } from "../draft/previewLists";
import { previewClaims } from "../myTeam/claims/preview";
import { previewScouts } from "./scouts/preview";
import { previewShortlistOf } from "./shortlist/preview";
import { previewIdOf, previewTeams } from "../table/preview";
import type { Period, ScoutingSeam, StatRace, WaiverActionSeam } from "./seam";

export const ARSENAL = { code: 3, name: "Arsenal", shortName: "ARS" };
export const CHELSEA = { code: 8, name: "Chelsea", shortName: "CHE" };
export const LIVERPOOL = { code: 14, name: "Liverpool", shortName: "LIV" };

const player = (code: number, name: string, fullName: string, club: ListedPlayer["club"], positions: ListedPlayer["positions"], ownerTeamName: string | null = null): ListedPlayer => ({
  code,
  name,
  fullName,
  club,
  positions,
  ownerTeamName,
  onWaivers: null,
  seasonPoints: null,
  points: null,
  figures: NO_FIGURES,
  stat: null,
});

/** One player on waivers, so the filter and the player card's claim show: a run two days off first
 *  takes him. */
const onWaivers = (listed: ListedPlayer): ListedPlayer => ({ ...listed, onWaivers: { firstRunAt: Date.now() + 2 * DAY_MS } });

export const previewPlayers: readonly ListedPlayer[] = [
  player(1, "Saka", "Bukayo Saka", ARSENAL, ["W"], "Saka Potatoes"),
  player(2, "Rice", "Declan Rice", ARSENAL, ["CDM", "CM"]),
  player(3, "Raya", "David Raya Martín", ARSENAL, ["GK"]),
  player(4, "Palmer", "Cole Palmer", CHELSEA, ["CAM", "W"], "Kroos Control"),
  onWaivers(player(5, "James", "Reece James", CHELSEA, ["FB", "WB"])),
  player(6, "Salah", "Mohamed Salah", LIVERPOOL, ["W", "ST"]),
  player(7, "Van Dijk", "Virgil van Dijk", LIVERPOOL, ["CB"]),
];

/** A few of each player's season totals, by his code; a stat left out is 0. */
const previewTotals: Record<number, Stats> = {
  1: { goals_scored: 4, assists: 3, minutes: 720, expected_goals: 3.41 },
  2: { goals_scored: 1, assists: 2, minutes: 810, expected_goals: 0.92 },
  3: { saves: 21, clean_sheets: 4, minutes: 810 },
  4: { goals_scored: 6, assists: 2, minutes: 765, expected_goals: 4.87 },
  5: { assists: 1, minutes: 430, expected_goals: 0.3 },
  6: { goals_scored: 7, assists: 4, minutes: 800, expected_goals: 6.12 },
  7: { goals_scored: 1, clean_sheets: 4, minutes: 810, expected_goals: 0.65 },
};
/** Their totals over the last 6 and the last 4 gameweeks, for the Period picker; Raya missed two. */
const previewRecentTotals: Record<Exclude<Period, "season">, Record<number, Stats>> = {
  last6: {
    1: { goals_scored: 2, assists: 1, minutes: 480 },
    2: { assists: 1, minutes: 540 },
    3: { saves: 11, clean_sheets: 2, minutes: 360 },
    4: { goals_scored: 3, assists: 1, minutes: 495 },
    5: { minutes: 210 },
    6: { goals_scored: 4, assists: 2, minutes: 520 },
    7: { clean_sheets: 2, minutes: 540 },
  },
  last4: {
    1: { goals_scored: 1, assists: 1, minutes: 300 },
    2: { minutes: 360 },
    3: { saves: 9, clean_sheets: 1, minutes: 180 },
    4: { goals_scored: 2, minutes: 335 },
    5: { minutes: 120 },
    6: { goals_scored: 3, assists: 1, minutes: 350 },
    7: { clean_sheets: 1, minutes: 360 },
  },
};
/** The preview's totals over `period`. */
const totalsOver = (period: Period = "season") => (period === "season" ? previewTotals : previewRecentTotals[period]);
/** The gameweeks each period counts in the preview: 9 have finished. */
const PREVIEW_PERIOD_GAMEWEEKS: Record<Period, number[]> = { season: [], last4: [6, 7, 8, 9], last6: [4, 5, 6, 7, 8, 9] };

/** The site's set in the preview, for its one own stat: goals and assists added up (#910). */
const PREVIEW_SET = {
  rules: [],
  wholePointsOnly: false,
  ownStats: [{ stat: `${OWN_STAT_PREFIX}goal_involvements`, name: "Goal involvements", shortCode: "GI", parts: [{ stat: "goals_scored", weight: 1 }, { stat: "assists", weight: 1 }] }],
};
const previewPlayer = (playerCode: number) => previewPlayers.find(({ code }) => code === playerCode)!;
/** A preview player as the per-90 figures weigh him over `period` (per90Figures.ts). */
const weigher = (period: Period) => (player: ListedPlayer) => ({ area: mainArea(player.positions), totals: withOwnStats(totalsOver(period)[player.code] ?? {}, PREVIEW_SET) });

/** Rice and Salah are on the preview manager's shortlist to begin with, and feed his draft queue. */
const SHORTLISTED = [2, 6];
export const previewShortlist = previewShortlistOf(previewPlayers, SHORTLISTED);
setPreviewShortlisted(previewPlayers.filter(({ code }) => SHORTLISTED.includes(code)));

/** "Add to queue" on a shortlisted player: into the preview's draft queue (../draft/previewLists.ts). */
const addToQueue = async (_leagueId: unknown, playerCode: number) => {
  queueInPreview([listedFromScouting(previewPlayers.find(({ code }) => code === playerCode)!)]);
  return null;
};

/** The stat race's teams (#800): the preview league's, each with made-up season totals in the first
 *  set's categories, a league that began at gameweek 1. */
const RACE_CATEGORIES = ["goals_scored", "assists", "clean_sheets", "goals_conceded", "saves", "penalties_saved", "penalties_missed", "yellow_cards", "red_cards", "own_goals"];
const raceTotals = (teamIndex: number): Stats =>
  Object.fromEntries(RACE_CATEGORIES.map((stat, index) => [stat, (teamIndex * 7 + index * 5) % 23]));
const previewRace = (stat: string): StatRace => ({
  categories: RACE_CATEGORIES,
  since: null,
  teams: raceOrder(
    previewTeams.map((name, index) => {
      const stats = raceTotals(index);
      return { teamId: previewIdOf(name), name, stats, stat: stats[stat] ?? 0 };
    }),
    true,
  ),
});

/** Scouting's own part of the preview; the app adds the player card's pickup and claim
 *  (src/app/previewApp.tsx), whose preview reads these players. */
export const previewScouting: Omit<ScoutingSeam, keyof WaiverActionSeam> = {
  ...previewShortlist,
  ...previewScouts,
  usePendingClaims: previewClaims.usePendingClaims,
  useAddToQueue: () => addToQueue,
  useComparison: (_leagueId, codes, stat, period) => {
    if (codes === null) return undefined;
    const area = mainArea(previewPlayer(codes[0]).positions);
    const weighed = weigher(period);
    return codes.map((code) => {
      const totals = weighed(previewPlayer(code)).totals;
      const figures = area === null ? [] : per90FiguresIn(area, totals, previewPlayers.map(weighed), stat);
      return { ...previewPlayer(code), minutes: totalOf(totals, MINUTES_STAT), figures };
    });
  },
  usePer90: (_leagueId, playerCode, stat, period) => per90PanelOf(weigher(period)(previewPlayer(playerCode)), previewPlayers.map(weigher(period)), stat),
  // The preview manager's player at the same main position, as the server picks him with no lineup to read.
  useYourPlayer: (_leagueId, playerCode) => {
    const main = cardOpensAt(previewPlayer(playerCode).positions);
    const yours = previewPlayers.find((each) => each.ownerTeamName === proLeague.teamName && each.code !== playerCode && main !== null && cardOpensAt(each.positions) === main);
    return { player: yours === undefined || main === null ? null : { position: main, code: yours.code, name: yours.name }, squadFull: false };
  },
  usePlayersList: (_leagueId, filters, sort, stat, period = "season") => ({
    clubs: [ARSENAL, CHELSEA, LIVERPOOL],
    ownStats: PREVIEW_SET.ownStats.map(({ stat, name, shortCode }) => ({ stat, name, shortCode })),
    players: listOf(
      previewPlayers.map((player) => {
        const totals = totalsOver(period)[player.code];
        return { ...player, figures: listFigures(totals), stat: shownStat(withOwnStats(totals ?? {}, PREVIEW_SET), stat) };
      }),
      filters,
      sort,
    ),
    pointsSeason: null,
    periodGameweeks: PREVIEW_PERIOD_GAMEWEEKS[period],
  }),
  useStatRace: (_leagueId, stat) => previewRace(stat),
};
