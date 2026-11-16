// The matchup in the preview (src/app/preview.ts): My team's first lineup against the draw's
// opponent for the gameweek, his men Scouting's, each side ending on the table's score, so League
// home and the matchup agree (#2450). It opens with both matches over and the result provisional.
// `?minute=replay` replays it: two made-up Premier League matches, the second kicking off half an
// hour into the first, play out a minute every half second, so every man moves from yet to play,
// through his minute, to finished; the manager's keeper doesn't play and the bench keeper comes on
// once his match is over; then the result is final, and the replay starts again. `?minute=N` holds
// it at minute N of the replay, `?minute=final` at the end, for screenshots.

import { useEffect, useMemo, useState } from "react";
import { areasOf, positionOfSlot, type Area, type Cell, type Lane } from "../../convex/lineup/pitch";
import { namedRole, roleIn } from "../../convex/lineup/roles";
import type { MatchBreakdown, TeamsCommentary, MatchupSide, MatchupBenchSlot, MatchupSlot, MatchupStarter } from "../../convex/matchup/matchupShape";
import { MINUTE_MS } from "../../convex/shared/time";
import { previewFixtureCode } from "../premierLeague/preview";
import { FIRST_RUNS } from "../../convex/scoring/draftedRoleRuns";
import { previewDone, previewGameMode, previewGameweek, previewTeamNames } from "../shared/preview";
import { previewIdOf, previewOpponent, previewOpponentOf, previewPointsOf, previewSeason } from "../table/preview";
import { previewFirstLineup, previewSquad } from "../myTeam/tactics/preview";
import { previewPlayers } from "../scouting/preview";
import { matchOf, MY_BALANCER, MY_MATCHES, THEIR_AREAS, THEIR_BALANCER, THEIR_MATCHES, type Man, type Men } from "./previewMen";
import type { Matchup, MatchupSeam } from "./seam";

/** How long a man's match runs, stoppage time in, and when the second match kicks off. */
const MATCH_MINUTES = 95;
const SECOND_KICKOFF = 30;
/** The replay's last minute of play, then a minute at full time before the result is final. */
const LAST_MINUTE = SECOND_KICKOFF + MATCH_MINUTES;
const FINAL_MINUTE = LAST_MINUTE + 2;
/** The minute both matches are over and the result still provisional. */
const FULL_TIME_MINUTE = LAST_MINUTE + 1;
const TICK_MS = 500;
const startedAt = Date.now();

const [MINE] = previewTeamNames;

/** The manager's men: My team's first lineup (../myTeam/tactics/preview.ts), each in his cell. */
function myMan(playerCode: number, cell: Cell | null): Man {
  const { name, clubCode, number, positions } = previewSquad.find((each) => each.playerCode === playerCode)!;
  const [match, points] = matchOf(MY_MATCHES, name);
  return { code: playerCode, name, clubCode, number, area: cell?.area ?? areasOf(positions)[0], cell, match, points };
}
const MY_MEN: Men = {
  starters: previewFirstLineup.starters.map(({ playerCode, area, lane }) => myMan(playerCode, { area, lane })),
  bench: previewFirstLineup.bench.map((playerCode) => myMan(playerCode, null)),
};
/** The opponent's men: Scouting's for his team (../scouting/preview.ts), so each is owned by him there. */
const THEIR_MEN: Men = (() => {
  const men = previewPlayers
    .filter(({ ownerTeamName }) => ownerTeamName === previewOpponent)
    .map(({ code, name, club, positions }, index): Man => {
      const [match, points] = matchOf(THEIR_MATCHES, name);
      return { code, name, clubCode: club.code, number: index + 1, area: THEIR_AREAS[index] ?? areasOf(positions)[0], cell: null, match, points };
    });
  return { starters: men.slice(0, THEIR_AREAS.length), bench: men.slice(THEIR_AREAS.length) };
})();

/** The manager's keeper, who doesn't play, and the bench keeper who comes on for him. */
const UNUSED_KEEPER = MY_MEN.starters.find(({ area }) => area === "goalkeeper")!;
const BENCH_KEEPER = MY_MEN.bench.find(({ area }) => area === "goalkeeper")!;

/** `men` with the balancer's points making the total that counts at full time `total`, as the
 *  table has it for the gameweek; as they stand in one to come. */
function totalling(men: Men, balancer: string, total: number | null): Men {
  if (total === null) return men;
  const counting = [...men.starters.filter((man) => man !== UNUSED_KEEPER), ...men.bench.filter((man) => man === BENCH_KEEPER)];
  const others = counting.filter(({ name }) => name !== balancer).reduce((sum, { points }) => sum + points, 0);
  const balanced = (man: Man) => (man.name === balancer ? { ...man, points: Math.max(0, total - others) } : man);
  return { starters: men.starters.map(balanced), bench: men.bench.map(balanced) };
}

/** Every man's code, by his name, for the lines that name him. */
const codeOf = (name: string) => [...MY_MEN.starters, ...MY_MEN.bench, ...THEIR_MEN.starters, ...THEIR_MEN.bench].find((man) => man.name === name)!.code;

/** A man `minute` minutes into the replay. */
function slotAt({ code, name, area, clubCode, number, match, points: finalPoints }: Man, minute: number, onBench: boolean): MatchupSlot {
  const played = minute - match * SECOND_KICKOFF;
  // The Premier League preview's code for the gameweek's match, whose page it opens.
  const fixtureCode = previewFixtureCode(previewGameweek, match);
  const kickoff = startedAt + match * SECOND_KICKOFF * MINUTE_MS;
  const status: MatchupSlot["status"] =
    played < 0
      ? { kind: "yetToPlay", fixtureCode, kickoff }
      : played <= MATCH_MINUTES
        ? { kind: "playing", fixtureCode, state: "live", minute: Math.min(played, MATCH_MINUTES), clockLabel: null }
        : { kind: "finished", fixtureCode };
  const points = played < 0 ? null : Math.floor((finalPoints * Math.min(played, MATCH_MINUTES)) / MATCH_MINUTES);
  const autoSub = code === UNUSED_KEEPER.code && status.kind === "finished" ? { kind: "off" as const, playerCode: BENCH_KEEPER.code, playerName: BENCH_KEEPER.name } : null;
  return { playerCode: code, name, area, clubCode, number, points, counts: !onBench, provisional: true, status, autoSub, breakdown: [breakdownOf(fixtureCode, kickoff, points, namedAt(match, played))] };
}

/** Each match's clubs, as its lines name them, and the minutes each club scores in (the lines' goals). */
const MATCHES = [
  { home: "ARS", away: "LIV", homeGoals: [23], awayGoals: [77] },
  { home: "CHE", away: "MCI", homeGoals: [58], awayGoals: [17] },
] as const;

/** Match `match`'s clubs and its score `played` minutes in: none before kickoff. */
function namedAt(match: 0 | 1, played: number): Pick<MatchBreakdown, "home" | "away" | "score"> {
  const { home, away, homeGoals, awayGoals } = MATCHES[match];
  const goals = (minutes: readonly number[]) => minutes.filter((at) => at <= played).length;
  const state = played < 0 ? null : played <= MATCH_MINUTES ? ("live" as const) : ("fullTime" as const);
  return {
    home,
    away,
    score: state === null ? null : { state, homeGoals: goals(homeGoals), awayGoals: goals(awayGoals), minutes: Math.min(played, MATCH_MINUTES), clockLabel: null },
  };
}

/** A made-up man's match broken down: a point for appearing, the rest goals at 1 each. */
function breakdownOf(fixtureCode: number, kickoff: number, points: number | null, named: Pick<MatchBreakdown, "home" | "away" | "score">): MatchBreakdown {
  const all = { by: "all" } as const;
  const categories =
    points === null
      ? [{ stat: "minutes", name: "Minutes played", points: null }, { stat: "goalsScored", name: "Goals scored", points: null }]
      : [
          { stat: "minutes", name: "Minutes played", points: Math.min(points, 1), why: { actions: 1, value: { shape: "perAction", points: 1 }, pricedBy: all, cut: null } },
          { stat: "goalsScored", name: "Goals scored", points: Math.max(points - 1, 0), why: { actions: Math.max(points - 1, 0), value: { shape: "perAction", points: 1 }, pricedBy: all, cut: null } },
        ] as const;
  return { fixtureCode, kickoff, ...named, points, counted: true, categories: [...categories], override: null };
}

/** A man in `cell`, in its first role. */
const slotOf = (cell: Cell): Pick<MatchupStarter, "role" | "place"> => ({
  role: namedRole(roleIn(cell, undefined)),
  place: { lane: cell.lane, label: positionOfSlot(cell) },
});

/** A man playing his area's centre slot. */
export const centreSlotOf = (area: Area) => slotOf({ area, lane: "centre" });

/** The lanes an area's men stand in, left to right, by how many there are, so each has his own slot
 *  on the pitch (#850). */
const LANES_BY_COUNT: Record<number, readonly Lane[]> = {
  1: ["centre"],
  2: ["leftCentre", "rightCentre"],
  3: ["leftCentre", "centre", "rightCentre"],
  4: ["left", "leftCentre", "rightCentre", "right"],
};

/** A side's starters `minute` minutes in, each in his cell, or one of his area's own, in its
 *  first role. */
function startersAt(men: Man[], minute: number): MatchupStarter[] {
  return men.map((man) => {
    const inArea = men.filter(({ area }) => area === man.area);
    const cell = man.cell ?? { area: man.area, lane: LANES_BY_COUNT[inArea.length][inArea.indexOf(man)] };
    return { ...slotAt(man, minute, false), ...slotOf(cell) };
  });
}

/** A side `minute` minutes in: the keeper's auto-sub once his match is over, in his slot, then the
 *  total. */
function sideAt(teamName: string, men: Men, minute: number): MatchupSide {
  const starters = startersAt(men.starters, minute);
  const bench: MatchupBenchSlot[] = men.bench.map((man) => ({ ...slotAt(man, minute, true), role: null, place: null }));
  const slots = [...starters, ...bench];
  const off = starters.find((slot) => slot.autoSub?.kind === "off");
  if (off !== undefined) {
    off.counts = false;
    const on = bench.find((slot) => slot.playerCode === BENCH_KEEPER.code)!;
    Object.assign(on, { counts: true, autoSub: { kind: "on", playerCode: off.playerCode, playerName: off.name }, ...slotOf({ area: off.area, lane: off.place.lane }) });
  }
  const final = minute >= FINAL_MINUTE;
  const counting = slots.filter((slot) => slot.counts);
  for (const slot of slots) slot.provisional = !final;
  return {
    kind: "team",
    teamId: previewIdOf(teamName),
    teamName,
    points: counting.reduce((total, slot) => total + (slot.points ?? 0), 0),
    provisional: !final,
    overridden: false,
    autoTeam: false,
    lineup: { starters, bench },
    formation: null,
    runs: [...FIRST_RUNS],
  };
}

/** Each match's made-up lines: which match, its minute, the line, and its worth to either team.
 *  The second match's minutes count from its own kickoff. */
const LINES: [0 | 1, number, string, string | null, about: string[], columns: [string | null, string | null]][] = [
  [0, 0, "KO ARS v LIV", null, [], [null, null]],
  [0, 12, "12' YELLOW Cucurella", "-1", ["Cucurella"], [null, "-1"]],
  [0, 23, "23' GOAL Saka, assist Rice", "Saka +5, Rice +3", ["Saka", "Rice"], ["+8", null]],
  [1, 0, "KO CHE v MCI", null, [], [null, null]],
  [0, 38, "38' Corner, conceded by Konaté", null, ["Konaté"], [null, null]],
  [1, 17, "17' GOAL Haaland", "+4", ["Haaland"], ["+4", null]],
  [0, 45, "45+2' HT", null, [], [null, null]],
  [0, 61, "~61' Saka: 60 minutes", "+1", ["Saka"], ["+1", null]],
  [1, 40, "40' SHOT Mateta, saved", null, ["Mateta"], [null, null]],
  [0, 77, "77' GOAL Bruno Fernandes, penalty", "+5", ["Bruno Fernandes"], [null, "+5"]],
  [1, 58, "58' GOAL Mateta, assist Ødegaard", "Mateta +4, Ødegaard +3", ["Mateta", "Ødegaard"], [null, "+7"]],
  [0, MATCH_MINUTES, "FT ARS 1–1 LIV", null, [], [null, null]],
  [1, MATCH_MINUTES, "FT CHE 1–1 MCI", null, [], [null, null]],
];
/** The replay's minutes the commentary is delayed for, so the note shows. */
const DELAYED_FROM = 70;
const DELAYED_UNTIL = 75;

/** The lines `minute` minutes into the replay, newest first. */
function commentaryAt(minute: number): TeamsCommentary {
  const lines = LINES.map(([match, at, text, points, about, columns], index) => ({
    when: at + match * SECOND_KICKOFF,
    line: { key: `${index}`, text, points, about: about.map(codeOf), columns },
  }))
    .filter(({ when }) => when <= minute)
    .sort((one, other) => other.when - one.when)
    .map(({ line }) => line);
  return { kind: "read", lines, delayed: minute >= DELAYED_FROM && minute < DELAYED_UNTIL };
}

/** The gameweek's matchup `minute` minutes in: the manager against the draw's opponent, each
 *  side's full-time total the table's for the gameweek (#2450). His opponent's men are Scouting's
 *  for this gameweek's opponent, whichever week is asked. */
function matchupAt(minute: number, gameweek: number): Matchup {
  const opponent = previewOpponentOf(gameweek) ?? previewOpponent;
  return {
    kind: "headToHead",
    teamId: previewIdOf(MINE),
    teamName: MINE,
    gameweeks: [...previewSeason.gameweeks],
    gameweek,
    deadline: previewSeason.deadlineOf(gameweek),
    gameNumber: 1,
    games: [{ kind: "team", teamName: opponent }],
    game: {
      kind: "scored",
      team: sideAt(MINE, totalling(MY_MEN, MY_BALANCER, previewPointsOf(gameweek, MINE)), minute),
      opponent: sideAt(opponent, totalling(THEIR_MEN, THEIR_BALANCER, previewPointsOf(gameweek, opponent)), minute),
      commentary: commentaryAt(minute),
      pointsDelayed: false,
      version: null,
    },
    mode: previewGameMode,
  };
}

/** The minute `?minute=` holds the replay at, or null to let it run (`?minute=replay`); with
 *  none, every match over and the result not yet final, so its score is League home's (#2450). */
function heldMinute(): number | null {
  const asked = new URLSearchParams(window.location.search).get("minute");
  if (asked === null) return FULL_TIME_MINUTE;
  if (asked === "final") return FINAL_MINUTE;
  return /^\d+$/.test(asked) ? Number(asked) : null;
}

/** The replay's minute, a minute a tick, from the first kickoff to the final result and round again. */
function useReplayMinute(): number {
  const [held] = useState(heldMinute);
  const [minute, setMinute] = useState(held ?? 0);
  useEffect(() => {
    if (held !== null) return;
    const timer = setInterval(() => setMinute((current) => (current >= FINAL_MINUTE + 4 ? 0 : current + 1)), TICK_MS);
    return () => clearInterval(timer);
  }, [held]);
  return minute;
}

/** The replay's matchup, the same object until the minute or the gameweek moves, as Convex's
 *  live query holds its result: the screen keeps the last one it was given. */
function usePreviewMatchup(gameweek: number): Matchup {
  const minute = useReplayMinute();
  return useMemo(() => matchupAt(minute, gameweek), [minute, gameweek]);
}

/** The preview saves nothing: a team override is taken and forgotten. */
const overrideNothing = previewDone;

export const previewMatchup: MatchupSeam = {
  useMatchup: (_leagueId, _now, asked) => usePreviewMatchup(asked.gameweek ?? previewGameweek),
  useOverrideTeam: () => overrideNothing,
  useRemoveTeamOverride: () => overrideNothing,
};
