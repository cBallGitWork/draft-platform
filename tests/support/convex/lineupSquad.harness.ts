// The Convex lineup and squad tests' shared setup: a 4-4-2 squad written straight into the
// tables, a commissioner's squad moves, and the next gameweek's deadline passed.

import { vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FPL_DEADLINE_RULE } from "../../../convex/gameweeks/deadline";
import { recordPassedDeadlines } from "../../../convex/gameweeks/deadlineRecorder";
import type { Position } from "../../../convex/positions/positionTables";
import { MINUTE_MS } from "../../../convex/shared/time";
import { KICKS_OFF_IN } from "./leagueRules.harness";
import { actingAs, type TestConvex } from "./leagues.harness";
import { filledLineup, presetNamed } from "./lineup.harness";

export const { lineup: FOUR_FOUR_TWO, positions: STARTER_POSITIONS } = filledLineup(presetNamed("4-4-2"));
export const STARTERS = FOUR_FOUR_TWO.starters.map(({ playerCode }) => playerCode);
export const SQUAD = [...STARTERS, ...FOUR_FOUR_TWO.bench];
/** The position of every player who starts in no slot. */
export const BENCH_POSITION: Position = "CM";
/** The club every test player is at. */
const CLUB_CODE = 1;
/** Each test player is named for his code. */
export const nameOf = (code: number) => `Player ${code}`;

/** Player and position rows for `codes`: a starter plays his slot's positions, anyone else the bench's. */
export const holdPlayers = (t: TestConvex, codes: readonly number[]) =>
  t.run(async (ctx) => {
    for (const code of codes) {
      await ctx.db.insert("players", { code, name: nameOf(code), fullName: nameOf(code), clubCode: CLUB_CODE });
      await ctx.db.insert("playerPositions", { code, starts: [], approved: [], set: [...(STARTER_POSITIONS.get(code) ?? [BENCH_POSITION])], removed: [] });
    }
  });

/**
 * `codes` (SQUAD unless given) held on the team, written straight into the tables, never through
 * squads.assign, so no first lineup is stored: as squads were before #637.
 */
export const holdSquad = async (t: TestConvex, leagueId: Id<"leagues">, teamId: Id<"teams">, codes: readonly number[] = SQUAD) => {
  await holdPlayers(t, codes);
  await t.run(async (ctx) => {
    for (const playerCode of codes) await ctx.db.insert("squadPlayers", { leagueId, teamId, playerCode });
  });
};

/** Past gameweek NEXT's deadline, as holdGameweeks sets it, recorded as the football sync records it. */
export const passNextDeadline = async (t: TestConvex) => {
  vi.advanceTimersByTime(KICKS_OFF_IN - FPL_DEADLINE_RULE.minutesBeforeFirstKickoff * MINUTE_MS);
  await t.run((ctx) => recordPassedDeadlines(ctx));
};

/**
 * `email` assigns, moves and releases players in the league. With `minuteApart`, each change is a
 * minute after the last, so their order is plain: the clock is set, never advanced, so no
 * scheduled timer fires.
 */
export const squadMoves = async (t: TestConvex, leagueId: Id<"leagues">, email: string, { minuteApart = false } = {}) => {
  const person = await actingAs(t, email);
  const later = () => {
    if (minuteApart) vi.setSystemTime(Date.now() + MINUTE_MS);
  };
  return {
    assign: async (playerCode: number, teamId: Id<"teams">) => (later(), person.mutation(api.squads.squads.assign, { leagueId, playerCode, teamId })),
    move: async (playerCode: number, teamId: Id<"teams">) => (later(), person.mutation(api.squads.squads.move, { leagueId, playerCode, teamId })),
    release: async (playerCode: number) => (later(), person.mutation(api.squads.squads.release, { leagueId, playerCode })),
  };
};
