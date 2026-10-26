// The matchup in the preview (src/preview.ts): the preview manager's team against Kroos Control,
// replayed. Two made-up Premier League matches, the second kicking off half an hour into the
// first, play out a minute every half second, so every man moves from yet to play, through his
// minute, to finished; Saka Potatoes' keeper doesn't play and the bench keeper comes on once his
// match is over; then the result is final, and the replay starts again. `?minute=N` holds it at
// minute N of the replay, `?minute=final` at the end, for screenshots.

import { useEffect, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { Area } from "../../convex/lineup/pitch";
import type { MatchupCommentary, MatchupSide, MatchupSlot } from "../../convex/matchup/matchupShape";
import { MINUTE_MS } from "../../convex/shared/time";
import { previewSeason, previewTeams } from "../table/preview";
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
/** Saka Potatoes' keeper and the bench keeper who comes on for him. */
const [UNUSED_KEEPER, BENCH_KEEPER] = ["Raya", "Pickford"];

const previewIdOf = (teamName: string) => `preview-${teamName}` as Id<"teams">;
const codeOf = (name: string) => [...name].reduce((code, letter) => code * 31 + letter.charCodeAt(0), 7);

/** A man `minute` minutes into the replay. */
function slotAt([area, name, match, finalPoints]: Man, minute: number, onBench: boolean): MatchupSlot {
  const played = minute - match * SECOND_KICKOFF;
  const status: MatchupSlot["status"] =
    played < 0
      ? { kind: "yetToPlay", kickoff: startedAt + match * SECOND_KICKOFF * MINUTE_MS }
      : played <= MATCH_MINUTES
        ? { kind: "playing", minute: Math.min(played, MATCH_MINUTES) }
        : { kind: "finished" };
  const points = played < 0 ? null : Math.floor((finalPoints * Math.min(played, MATCH_MINUTES)) / MATCH_MINUTES);
  const autoSub = name === UNUSED_KEEPER && status.kind === "finished" ? { kind: "off" as const, playerName: BENCH_KEEPER } : null;
  return { playerCode: codeOf(name), name, area, points, counts: !onBench, provisional: true, status, autoSub };
}

/** A side `minute` minutes in: the keeper's auto-sub once his match is over, then the total. */
function sideAt(teamName: string, men: typeof SAKA_POTATOES, minute: number): MatchupSide {
  const starters = men.starters.map((man) => slotAt(man, minute, false));
  const bench = men.bench.map((man) => slotAt(man, minute, true));
  const off = starters.find((slot) => slot.autoSub?.kind === "off");
  if (off !== undefined) {
    off.counts = false;
    const on = bench.find((slot) => slot.name === BENCH_KEEPER)!;
    Object.assign(on, { counts: true, autoSub: { kind: "on", playerName: off.name } });
  }
  const final = minute >= FINAL_MINUTE;
  const counting = [...starters, ...bench].filter((slot) => slot.counts);
  for (const slot of [...starters, ...bench]) slot.provisional = !final;
  return {
    kind: "team",
    teamId: previewIdOf(teamName),
    teamName,
    points: counting.reduce((total, slot) => total + (slot.points ?? 0), 0),
    provisional: !final,
    lineup: { starters, bench },
  };
}

/** Each match's made-up lines: which match, its minute, the line, and its worth to either team.
 *  The second match's minutes count from its own kickoff. */
const LINES: [0 | 1, number, string, string | null][] = [
  [0, 0, "KO ARS v LIV", null],
  [0, 12, "12' YELLOW Van Dijk", "-1"],
  [0, 23, "23' GOAL Saka, assist Rice", "Saka +5, Rice +3"],
  [1, 0, "KO CHE v MCI", null],
  [0, 38, "38' Corner, conceded by Konaté", null],
  [1, 17, "17' GOAL Haaland", "+4"],
  [0, 45, "45+2' HT", null],
  [0, 61, "~61' Saka: 60 minutes", "+1"],
  [1, 40, "40' SHOT Palmer, saved", null],
  [0, 77, "77' GOAL Szoboszlai, penalty", "+5"],
  [1, 58, "58' GOAL Palmer, assist Ødegaard", "Palmer +4, Ødegaard +3"],
  [0, MATCH_MINUTES, "FT ARS 1–1 LIV: Saka 11, Szoboszlai 9, Van Dijk 6, Rice 3, Isak 2", null],
  [1, 88, "88' RED Cucurella", "-3"],
  [1, MATCH_MINUTES, "FT CHE 1–1 MCI: Haaland 13, Gabriel 8, Palmer 7, Ødegaard 5", null],
];
/** The replay's minutes the commentary is delayed for, so the note shows. */
const DELAYED_FROM = 70;
const DELAYED_UNTIL = 75;

/** The lines `minute` minutes into the replay, newest first. */
function commentaryAt(minute: number): MatchupCommentary {
  const lines = LINES.map(([match, at, text, points], index) => ({ when: at + match * SECOND_KICKOFF, line: { key: `${index}`, text, points } }))
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
    game: {
      kind: "scored",
      team: sideAt(MINE, SAKA_POTATOES, minute),
      opponent: sideAt(OPPONENT, KROOS_CONTROL, minute),
      commentary: commentaryAt(minute),
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

export const previewMatchup: MatchupSeam = {
  useMatchup: (_leagueId, _now, asked) => matchupAt(useReplayMinute(), asked.gameweek ?? GAMEWEEK),
};
