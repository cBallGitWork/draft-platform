// The matchup in the preview (src/app/preview.ts): My team's first lineup against the draw's
// opponent for the gameweek, his men Scouting's. Each man plays his club's match in Football's
// gameweek, so its clubs, score and clock are Football's and his fixture opens its page (#2455), and
// his points and goals in it are his player card's (#2478); the table takes each side's total as
// its score, so League home and the matchup agree (#2450). It opens as Football stands: a match
// over, one live, one at half-time, the rest to come, the result provisional. `?minute=replay`
// replays the gameweek: its matches kick off half an hour apart by Football's kickoff order and play
// out a minute every half second, so every man moves from yet to play, through his minute, to his
// card's figures at full time; the bench keeper comes on for the manager's keeper where his card has
// him sitting his match out; then the result is final, and the replay starts again. `?minute=N`
// holds it at minute N of the replay, `?minute=final` at the end, for screenshots.

import { useEffect, useMemo, useState } from "react";
import { areasOf, positionOfSlot, type Area, type Cell, type Lane } from "../../convex/lineup/pitch";
import { namedRole, roleIn } from "../../convex/lineup/roles";
import { signedWords } from "../../convex/shared/numberWords";
import type { MatchBreakdown, MatchupCommentary, TeamsCommentary, MatchupSide, MatchupBenchSlot, MatchupSlot, MatchupStarter } from "../../convex/matchup/matchupShape";
import type { MatchStats } from "../../convex/scoring/values";
import { GOALS, MINUTES_STAT } from "../../convex/stats/matchRecords";
import { MINUTE_MS } from "../../convex/shared/time";
import { previewClubMatch, previewFullTimeGoals, previewGameweekMatches } from "../premierLeague/preview";
import type { GameweekMatch } from "../premierLeague/seam";
import { FIRST_RUNS } from "../../convex/scoring/draftedRoleRuns";
import { previewDone, previewGameMode, previewGameweek, previewTeamNames } from "../shared/preview";
import { previewIdOf, previewOpponent, previewOpponentOf, previewSeason } from "../shared/previewDraw";
import { previewFirstLineup, previewSquad } from "../myTeam/tactics/preview";
import { previewPlayers } from "../scouting/preview";
import { previewCardMatchIn, previewCardPoints, previewPriced } from "../playerCard/preview";
import { THEIR_AREAS, type Man, type Men } from "./previewMen";
import { goalsOf, goalWorthOf, kickoffsOf, KICKOFF_GAP, linesOf, MATCH_MINUTES, recordAt, scoreAt, type Clock, type ReplayMatch } from "./previewMatches";
import type { Matchup, MatchupSeam } from "./seam";

/** The replay's last minute of play, then a minute at full time before the result is final. */
const LAST_MINUTE = (kickoffsOf(previewGameweekMatches(previewGameweek)).length - 1) * KICKOFF_GAP + MATCH_MINUTES;
const FINAL_MINUTE = LAST_MINUTE + 2;
const TICK_MS = 500;

const [MINE] = previewTeamNames;

/** The manager's men: My team's first lineup (../myTeam/tactics/preview.ts), each in his cell. */
function myMan(playerCode: number, cell: Cell | null): Man {
  const { name, clubCode, number, positions } = previewSquad.find((each) => each.playerCode === playerCode)!;
  return { code: playerCode, name, clubCode, number, positions, area: cell?.area ?? areasOf(positions)[0], cell };
}
const MY_MEN: Men = {
  starters: previewFirstLineup.starters.map(({ playerCode, area, lane }) => myMan(playerCode, { area, lane })),
  bench: previewFirstLineup.bench.map((playerCode) => myMan(playerCode, null)),
};
/** The opponent's men: Scouting's for his team (../scouting/preview.ts), so each is owned by him there. */
const THEIR_MEN: Men = (() => {
  const men = previewPlayers
    .filter(({ ownerTeamName }) => ownerTeamName === previewOpponent)
    .map(({ code, name, club, positions }, index): Man => ({ code, name, clubCode: club.code, number: index + 1, positions, area: THEIR_AREAS[index] ?? areasOf(positions)[0], cell: null }));
  return { starters: men.slice(0, THEIR_AREAS.length), bench: men.slice(THEIR_AREAS.length) };
})();
const EVERY_MAN = [...MY_MEN.starters, ...MY_MEN.bench, ...THEIR_MEN.starters, ...THEIR_MEN.bench];

/** The manager's keeper, and the bench keeper who comes on for him where he sits his match out. */
const STARTING_KEEPER = MY_MEN.starters.find(({ area }) => area === "goalkeeper")!;
const BENCH_KEEPER = MY_MEN.bench.find(({ area }) => area === "goalkeeper")!;

/** The gameweek's matches the men play, each one's minutes played at `clock` (Football's clock now,
 *  past full time once over, below nothing before kickoff; or the replay's), each man's match on
 *  his player card now and at full time, and each match's goals, named for the men his card has
 *  scoring them (#2478). */
function gameweekAt(gameweek: number, clock: Clock) {
  const matches = previewGameweekMatches(gameweek);
  const kickoffs = kickoffsOf(matches);
  const matchOf = (clubCode: number): ReplayMatch => {
    const match = previewClubMatch(gameweek, clubCode)!;
    return { ...match, fullTime: previewFullTimeGoals(match) };
  };
  const playedIn = (match: GameweekMatch): number => {
    if (clock.kind === "replay") return clock.minute - kickoffs.indexOf(match.kickoff) * KICKOFF_GAP;
    const { score } = match;
    if (score === null || score.state === "upcoming") return -1;
    return score.state === "fullTime" ? MATCH_MINUTES + 1 : (score.minutes ?? 0);
  };
  /** When a moment of a match falls, to put the lines in order: the replay's minute, or the time. */
  const when = (match: GameweekMatch, minute: number) =>
    clock.kind === "replay" ? kickoffs.indexOf(match.kickoff) * KICKOFF_GAP + minute : (match.kickoff ?? 0) + minute * MINUTE_MS;
  const cardNow = new Map(EVERY_MAN.map(({ code }) => [code, previewCardMatchIn(code, gameweek)]));
  const cardAtFullTime = new Map(EVERY_MAN.map(({ code }) => [code, previewCardMatchIn(code, gameweek, true)]));
  const played = [...new Map(EVERY_MAN.map(({ clubCode }) => matchOf(clubCode)).map((match) => [match.fixtureCode, match])).values()];
  const goals = new Map(played.map((match) => [match.fixtureCode, goalsOf(match, EVERY_MAN, ({ code }) => cardAtFullTime.get(code)?.stats?.[GOALS] ?? 0)]));
  /** His card's match as it stands at `clock` once his match is over or, now, while it is played. */
  const cardOf = (code: number) => (clock.kind === "now" ? cardNow : cardAtFullTime).get(code) ?? null;
  return { clock, matchOf, playedIn, when, played, goals, cardOf, cardAtFullTime };
}
type GameweekAt = ReturnType<typeof gameweekAt>;

/** His points and breakdown in his match `played` minutes in at `at`: none before kickoff; his card's
 *  as Football stands now, or at the replay's full time; nothing where he sits it out; and in the
 *  replay before then, his card's full-time record so far (#2478). */
function scoredAt({ code, positions }: Man, match: ReplayMatch, played: number, at: GameweekAt): Pick<MatchBreakdown, "points" | "categories" | "override"> {
  const priced = (record: MatchStats | null) => {
    const [first] = previewPriced(record, positions);
    return { points: first.total, categories: first.categories, override: null };
  };
  if (played < 0) return priced(null);
  const card = at.cardOf(code);
  if (at.clock.kind === "now" || played > MATCH_MINUTES) return card === null ? priced({ [MINUTES_STAT]: 0 }) : { points: previewCardPoints(card), categories: card.points[0].categories, override: card.override };
  const fullTime = at.cardAtFullTime.get(code)?.stats ?? { [MINUTES_STAT]: 0 };
  return priced(recordAt(fullTime, played, at.goals.get(match.fixtureCode) ?? [], code));
}

/** A man in his club's match at `at`. */
function slotAt(man: Man, at: GameweekAt, onBench: boolean): MatchupSlot {
  const { code, name, area, clubCode, number } = man;
  const match = at.matchOf(clubCode);
  const { fixtureCode, kickoff } = match;
  const played = at.playedIn(match);
  const score = scoreAt(match, played, at.clock);
  const status: MatchupSlot["status"] =
    played < 0
      ? { kind: "yetToPlay", fixtureCode, kickoff }
      : played <= MATCH_MINUTES
        ? { kind: "playing", fixtureCode, state: score?.state === "halfTime" ? "halfTime" : "live", minute: Math.min(played, MATCH_MINUTES), clockLabel: score?.clockLabel ?? null }
        : { kind: "finished", fixtureCode };
  const scored = scoredAt(man, match, played, at);
  const satOut = code === STARTING_KEEPER.code && status.kind === "finished" && at.cardOf(code) === null;
  const autoSub = satOut ? { kind: "off" as const, playerCode: BENCH_KEEPER.code, playerName: BENCH_KEEPER.name } : null;
  const breakdown: MatchBreakdown = { fixtureCode, kickoff, home: match.home.shortName, away: match.away.shortName, score, counted: true, ...scored };
  return { playerCode: code, name, area, clubCode, number, points: scored.points, counts: !onBench, provisional: true, status, autoSub, breakdown: [breakdown] };
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

/** A side's starters at `at`, each in his cell, or one of his area's own, in its first role. */
function startersAt(men: Man[], at: GameweekAt): MatchupStarter[] {
  return men.map((man) => {
    const inArea = men.filter(({ area }) => area === man.area);
    const cell = man.cell ?? { area: man.area, lane: LANES_BY_COUNT[inArea.length][inArea.indexOf(man)] };
    return { ...slotAt(man, at, false), ...slotOf(cell) };
  });
}

/** A side at `at`: the keeper's auto-sub once his match is over, in his slot, then the total, the
 *  table's for the gameweek now (#2450, #2478). */
function sideAt(teamName: string, men: Men, at: GameweekAt): MatchupSide {
  const starters = startersAt(men.starters, at);
  const bench: MatchupBenchSlot[] = men.bench.map((man) => ({ ...slotAt(man, at, true), role: null, place: null }));
  const slots = [...starters, ...bench];
  const off = starters.find((slot) => slot.autoSub?.kind === "off");
  if (off !== undefined) {
    off.counts = false;
    const on = bench.find((slot) => slot.playerCode === BENCH_KEEPER.code)!;
    Object.assign(on, { counts: true, autoSub: { kind: "on", playerCode: off.playerCode, playerName: off.name }, ...slotOf({ area: off.area, lane: off.place.lane }) });
  }
  const counting = slots.filter((slot) => slot.counts);
  const final = at.clock.kind === "replay" && at.clock.minute >= FINAL_MINUTE;
  for (const slot of slots) slot.provisional = !final;
  return {
    kind: "team",
    teamId: previewIdOf(teamName),
    teamName,
    points: counting.reduce((sum, slot) => sum + (slot.points ?? 0), 0),
    provisional: !final,
    overridden: false,
    autoTeam: false,
    lineup: { starters, bench },
    formation: null,
    runs: [...FIRST_RUNS],
  };
}

/** The replay's minutes the commentary is delayed for, so the note shows. */
const DELAYED_FROM = 70;
const DELAYED_UNTIL = 75;

/** The lines of the men's matches so far at `at`, newest first. A goal line is worth his card's
 *  goal to its scorer (#2478), and moves the column of the side he counts for, team then opponent,
 *  as the server's (readCommentary.ts): a bench man not on moves none (#2466). */
function commentaryAt(at: GameweekAt, sides: readonly MatchupSide[]): TeamsCommentary {
  const counting = sides.map((side) => (side.kind === "team" ? new Set([...side.lineup.starters, ...side.lineup.bench].filter((slot) => slot.counts).map((slot) => slot.playerCode)) : new Set<number>()));
  const priced = (about: readonly number[]) => {
    const worth = about.length === 0 ? null : goalWorthOf(at.cardAtFullTime.get(about[0]) ?? null);
    const words = worth === null ? null : signedWords(worth);
    return { points: words, columns: counting.map((counts) => (words !== null && about.some((code) => counts.has(code)) ? words : null)) };
  };
  const lines = at.played
    .flatMap((match) =>
      linesOf(match, at.goals.get(match.fixtureCode) ?? [])
        .map(({ minute, text, about }, index) => ({ minute, when: at.when(match, minute), line: { key: `${match.fixtureCode}-${index}`, text, about, ...priced(about) } }))
        .filter(({ minute }) => minute <= at.playedIn(match)),
    )
    .sort((one, other) => other.when - one.when)
    .map(({ line }) => line);
  const delayed = at.clock.kind === "replay" && at.clock.minute >= DELAYED_FROM && at.clock.minute < DELAYED_UNTIL;
  return { kind: "read", lines, delayed };
}

/** The gameweek's game at `clock`: the draw's opponent, both sides, the manager's first, and their
 *  commentary. */
function gameAt(clock: Clock, gameweek: number) {
  const opponent = previewOpponentOf(gameweek) ?? previewOpponent;
  const at = gameweekAt(gameweek, clock);
  const sides = [sideAt(MINE, MY_MEN, at), sideAt(opponent, THEIR_MEN, at)] as const;
  return { opponent, sides, commentary: commentaryAt(at, sides) };
}

/** The manager's and his opponent's points in a gameweek as Football stands, the table's for them
 *  (../table/preview.ts), so League home and the matchup agree (#2450): his men's cards' (#2478).
 *  Only the manager's in a gameweek against the league's average. */
export function previewGamePoints(gameweek: number): { teamName: string; points: number }[] {
  const drawn = previewOpponentOf(gameweek);
  const [mine, theirs] = gameAt({ kind: "now" }, gameweek).sides.map((side) => (side.kind === "team" ? side.points : 0));
  return [{ teamName: MINE, points: mine }, ...(drawn === null ? [] : [{ teamName: drawn, points: theirs }])];
}

/** The gameweek's matchup at `clock`: the manager against the draw's opponent, each side's total
 *  the table's for the gameweek now (#2450). His opponent's men are Scouting's for this gameweek's
 *  opponent, whichever week is asked. */
function matchupAt(clock: Clock, gameweek: number): Matchup {
  const { opponent, sides, commentary } = gameAt(clock, gameweek);
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
      team: sides[0],
      opponent: sides[1],
      commentary,
      pointsDelayed: false,
      version: null,
    },
    mode: previewGameMode,
  };
}

/** League home's matchday Vidiprinter (#2466): the matchup's lines as Football's gameweek stands,
 *  each priced only where it moves a man whose points count, as the server's matchday reads only
 *  those men (home/matchday.ts). */
export function previewMatchdayLines(gameweek: number): MatchupCommentary {
  const { commentary } = gameAt({ kind: "now" }, gameweek);
  if (commentary.kind !== "read") return commentary;
  return { ...commentary, lines: commentary.lines.map(({ key, text, points, columns }) => ({ key, text, points: columns.some((column) => column !== null) ? points : null })) };
}

/** Where `?minute=` holds the matchup, or null to run the replay (`?minute=replay`); with none,
 *  as Football stands now, so its matches and League home's score agree (#2450, #2455). */
function heldClock(): Clock | null {
  const asked = new URLSearchParams(window.location.search).get("minute");
  if (asked === null) return { kind: "now" };
  if (asked === "final") return { kind: "replay", minute: FINAL_MINUTE };
  return /^\d+$/.test(asked) ? { kind: "replay", minute: Number(asked) } : null;
}

/** The clock `?minute=` holds, or null while the replay runs, and the replay's minute, a minute a
 *  tick, from the first kickoff to the final result and round again. */
function useClock(): [Clock | null, number] {
  const [held] = useState(heldClock);
  const [minute, setMinute] = useState(0);
  useEffect(() => {
    if (held !== null) return;
    const timer = setInterval(() => setMinute((current) => (current >= FINAL_MINUTE + 4 ? 0 : current + 1)), TICK_MS);
    return () => clearInterval(timer);
  }, [held]);
  return [held, minute];
}

/** The matchup, the same object until the clock or the gameweek moves, as Convex's live query
 *  holds its result: the screen keeps the last one it was given. */
function usePreviewMatchup(gameweek: number): Matchup {
  const [held, minute] = useClock();
  return useMemo(() => matchupAt(held ?? { kind: "replay", minute }, gameweek), [held, minute, gameweek]);
}

/** The preview saves nothing: a team override is taken and forgotten. */
const overrideNothing = previewDone;

export const previewMatchup: MatchupSeam = {
  useMatchup: (_leagueId, _now, asked) => usePreviewMatchup(asked.gameweek ?? previewGameweek),
  useOverrideTeam: () => overrideNothing,
  useRemoveTeamOverride: () => overrideNothing,
};
