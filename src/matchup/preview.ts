// The matchup in the preview (src/app/preview.ts): the preview manager's team against Kroos Control,
// replayed. Two made-up Premier League matches, the second kicking off half an hour into the
// first, play out a minute every half second, so every man moves from yet to play, through his
// minute, to finished; Saka Potatoes' keeper doesn't play and the bench keeper comes on once his
// match is over; then the result is final, and the replay starts again. `?minute=N` holds it at
// minute N of the replay, `?minute=final` at the end, for screenshots.

import { useEffect, useMemo, useState } from "react";
import { positionOfSlot, type Area, type Cell, type Lane } from "../../convex/lineup/pitch";
import { namedRole, roleIn } from "../../convex/lineup/roles";
import type { MatchBreakdown, TeamsCommentary, MatchupSide, MatchupBenchSlot, MatchupSlot, MatchupStarter } from "../../convex/matchup/matchupShape";
import { MINUTE_MS } from "../../convex/shared/time";
import { previewFixtureCode } from "../premierLeague/preview";
import { previewIdOf, previewSeason, previewTeams } from "../table/preview";
import type { Matchup, MatchupSeam } from "./seam";

/** How long a man's match runs, stoppage time in, and when the second match kicks off. */
const MATCH_MINUTES = 95;
const SECOND_KICKOFF = 30;
/** The replay's last minute of play, then a minute at full time before the result is final. */
const LAST_MINUTE = SECOND_KICKOFF + MATCH_MINUTES;
const FINAL_MINUTE = LAST_MINUTE + 2;
const TICK_MS = 500;
const GAMEWEEK = 8;
const startedAt = Date.now();

/** A made-up man: where he stands, his name, which match he plays (0 first, 1 second), and his
 *  points at full time; a keeper with no match minutes didn't play. */
type Man = [Area, string, 0 | 1, number];
const [MINE, OPPONENT] = [previewTeams[0], previewTeams[2]];
const SAKA_POTATOES: { starters: Man[]; bench: Man[] } = {
  starters: [
    ["goalkeeper", "Raya", 0, 0],
    ["defence", "White", 0, 6],
    ["defence", "Saliba", 0, 2],
    ["defence", "Gabriel", 1, 8],
    ["defence", "Timber", 1, 1],
    ["midfield", "Rice", 0, 3],
    ["midfield", "Ødegaard", 1, 5],
    ["midfield", "Saka", 0, 11],
    ["attack", "Palmer", 1, 7],
    ["attack", "Isak", 0, 2],
    ["attack", "Watkins", 1, 1],
  ],
  bench: [
    ["goalkeeper", "Pickford", 1, 3],
    ["defence", "Gvardiol", 0, 2],
    ["midfield", "Mbeumo", 1, 6],
    ["attack", "Wissa", 0, 1],
  ],
};
const KROOS_CONTROL: { starters: Man[]; bench: Man[] } = {
  starters: [
    ["goalkeeper", "Sánchez", 1, 2],
    ["defence", "Van Dijk", 0, 6],
    ["defence", "Konaté", 0, 6],
    ["defence", "Cucurella", 1, 1],
    ["midfield", "Caicedo", 1, 3],
    ["midfield", "Mac Allister", 0, 2],
    ["midfield", "Szoboszlai", 0, 9],
    ["midfield", "Semenyo", 1, 2],
    ["attack", "Haaland", 1, 13],
    ["attack", "Ekitiké", 0, 2],
    ["attack", "Wood", 1, 0],
  ],
  bench: [
    ["goalkeeper", "Pope", 0, 2],
    ["defence", "Muñoz", 1, 1],
    ["midfield", "Kudus", 0, 3],
    ["attack", "Thiago", 1, 2],
  ],
};
/** Each side's clubs by match, as the made-up lines name them: ARS v LIV, then CHE v MCI. */
const CLUBS: Record<string, readonly [number, number]> = { [MINE]: [3, 8], [OPPONENT]: [14, 43] };

/** Saka Potatoes' keeper and the bench keeper who comes on for him. */
const [UNUSED_KEEPER, BENCH_KEEPER] = ["Raya", "Pickford"];

const codeOf = (name: string) => [...name].reduce((code, letter) => code * 31 + letter.charCodeAt(0), 7);

/** A man `minute` minutes into the replay. */
function slotAt([area, name, match, finalPoints]: Man, minute: number, onBench: boolean): MatchupSlot {
  const played = minute - match * SECOND_KICKOFF;
  // The Premier League preview's code for the match, whose page every fixture there opens.
  const fixtureCode = previewFixtureCode(GAMEWEEK, match);
  const kickoff = startedAt + match * SECOND_KICKOFF * MINUTE_MS;
  const status: MatchupSlot["status"] =
    played < 0
      ? { kind: "yetToPlay", fixtureCode, kickoff }
      : played <= MATCH_MINUTES
        ? { kind: "playing", fixtureCode, state: "live", minute: Math.min(played, MATCH_MINUTES), clockLabel: null }
        : { kind: "finished", fixtureCode };
  const points = played < 0 ? null : Math.floor((finalPoints * Math.min(played, MATCH_MINUTES)) / MATCH_MINUTES);
  const autoSub = name === UNUSED_KEEPER && status.kind === "finished" ? { kind: "off" as const, playerName: BENCH_KEEPER } : null;
  // His shirt is the side's to dress (sideAt).
  return { playerCode: codeOf(name), name, area, clubCode: null, number: null, points, counts: !onBench, provisional: true, status, autoSub, breakdown: [breakdownOf(fixtureCode, kickoff, points, namedAt(match, played))] };
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

/** A side's starters `minute` minutes in, each in his own slot of his area, in its first role. */
function startersAt(men: Man[], minute: number): MatchupStarter[] {
  return men.map((man) => {
    const inArea = men.filter(([area]) => area === man[0]);
    const lane = LANES_BY_COUNT[inArea.length][inArea.indexOf(man)];
    return { ...slotAt(man, minute, false), ...slotOf({ area: man[0], lane }) };
  });
}

/** A side `minute` minutes in: the keeper's auto-sub once his match is over, in his slot, then the
 *  total. */
function sideAt(teamName: string, men: typeof SAKA_POTATOES, minute: number): MatchupSide {
  const starters = startersAt(men.starters, minute);
  const bench: MatchupBenchSlot[] = men.bench.map((man) => ({ ...slotAt(man, minute, true), role: null, place: null }));
  const slots = [...starters, ...bench];
  // Each man in his match's club's shirt, numbered in squad order.
  [...men.starters, ...men.bench].forEach(([, , match], index) => Object.assign(slots[index], { clubCode: CLUBS[teamName][match], number: index + 1 }));
  const off = starters.find((slot) => slot.autoSub?.kind === "off");
  if (off !== undefined) {
    off.counts = false;
    const on = bench.find((slot) => slot.name === BENCH_KEEPER)!;
    Object.assign(on, { counts: true, autoSub: { kind: "on", playerName: off.name }, ...slotOf({ area: off.area, lane: off.place.lane }) });
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
  };
}

/** Each match's made-up lines: which match, its minute, the line, and its worth to either team.
 *  The second match's minutes count from its own kickoff. */
const LINES: [0 | 1, number, string, string | null, about: string[], columns: [string | null, string | null]][] = [
  [0, 0, "KO ARS v LIV", null, [], [null, null]],
  [0, 12, "12' YELLOW Van Dijk", "-1", ["Van Dijk"], [null, "-1"]],
  [0, 23, "23' GOAL Saka, assist Rice", "Saka +5, Rice +3", ["Saka", "Rice"], ["+8", null]],
  [1, 0, "KO CHE v MCI", null, [], [null, null]],
  [0, 38, "38' Corner, conceded by Konaté", null, ["Konaté"], [null, null]],
  [1, 17, "17' GOAL Haaland", "+4", ["Haaland"], [null, "+4"]],
  [0, 45, "45+2' HT", null, [], [null, null]],
  [0, 61, "~61' Saka: 60 minutes", "+1", ["Saka"], ["+1", null]],
  [1, 40, "40' SHOT Palmer, saved", null, ["Palmer"], [null, null]],
  [0, 77, "77' GOAL Szoboszlai, penalty", "+5", ["Szoboszlai"], [null, "+5"]],
  [1, 58, "58' GOAL Palmer, assist Ødegaard", "Palmer +4, Ødegaard +3", ["Palmer", "Ødegaard"], ["+7", null]],
  [0, MATCH_MINUTES, "FT ARS 1–1 LIV: Saka 11, Szoboszlai 9, Van Dijk 6, Rice 3, Isak 2", null, ["Saka", "Szoboszlai", "Van Dijk", "Rice", "Isak"], [null, null]],
  [1, 88, "88' RED Cucurella", "-3", ["Cucurella"], [null, "-3"]],
  [1, MATCH_MINUTES, "FT CHE 1–1 MCI: Haaland 13, Gabriel 8, Palmer 7, Ødegaard 5", null, ["Haaland", "Gabriel", "Palmer", "Ødegaard"], [null, null]],
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

function matchupAt(minute: number, gameweek: number): Matchup {
  return {
    kind: "headToHead",
    teamId: previewIdOf(MINE),
    teamName: MINE,
    gameweeks: [...previewSeason.gameweeks],
    gameweek,
    deadline: previewSeason.deadlineOf(gameweek),
    gameNumber: 1,
    games: [{ kind: "team", teamName: OPPONENT }],
    game: {
      kind: "scored",
      team: sideAt(MINE, SAKA_POTATOES, minute),
      opponent: sideAt(OPPONENT, KROOS_CONTROL, minute),
      commentary: commentaryAt(minute),
      version: null,
    },
  };
}

/** The minute `?minute=` holds the replay at, or null to let it run. */
function heldMinute(): number | null {
  const asked = new URLSearchParams(window.location.search).get("minute");
  if (asked === "final") return FINAL_MINUTE;
  return asked !== null && /^\d+$/.test(asked) ? Number(asked) : null;
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
const overrideNothing = () => Promise.resolve(null);

export const previewMatchup: MatchupSeam = {
  useMatchup: (_leagueId, _now, asked) => usePreviewMatchup(asked.gameweek ?? GAMEWEEK),
  useOverrideTeam: () => overrideNothing,
  useRemoveTeamOverride: () => overrideNothing,
};
