import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import { isLocked } from "../gameweeks/deadline";
import { deadlineOf, leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { recordEvent } from "../mail/letters";
import { seasonRules } from "../rules/rulesHistory";
import { refuse, runnerOf, teamsOf } from "../shared/leagueAccess";
import { drawnGameweek, scheduleOf } from "./playedFixtures";
import { LEAGUE_AVERAGE, namedFixture, type Fixture } from "./roundRobin";

// A commissioner edits a gameweek's fixtures (spec/09, Fixture edits; #1208): two games in one
// gameweek are picked and a side swapped between them, so every team still plays the same number
// of games. With an odd number of teams, the league's average swaps like a team. Only a gameweek
// whose deadline hasn't passed can be edited: once it begins its fixtures are fixed (spec/13). The
// edit is a row playedFixtures.ts reads over the draw, so it moves that gameweek alone, and every
// other is as drawn. The whole league is told in one letter (spec/15: nothing changes quietly).

type TeamId = Id<"teams">;
type Side = TeamId | typeof LEAGUE_AVERAGE;
type Game = Fixture<TeamId>;

/** Why an edit was refused, as the commissioner is told it. */
export const fixtureEditRefusals = {
  notHeadToHead: (gameweek: number) => `Gameweek ${gameweek} has no head-to-head fixtures to edit.`,
  begun: (gameweek: number) => `Gameweek ${gameweek} has begun: its fixtures are fixed.`,
  noGame: (gameweek: number) => `That game isn't in gameweek ${gameweek}.`,
  sameGame: "Pick two different games to swap between.",
  playsItself: "That swap would have a side play itself.",
} as const;

/** A side in one game of the gameweek, picked to move: `moves`, now playing `against`. */
const pickedSide = v.object({
  moves: v.union(v.id("teams"), v.literal(LEAGUE_AVERAGE)),
  against: v.union(v.id("teams"), v.literal(LEAGUE_AVERAGE)),
});
type PickedSide = { moves: Side; against: Side };

/** Where `picked`'s game is in `games`, skipping the game at `skip`: -1 when there is none. */
const gameOf = (games: readonly Game[], { moves, against }: PickedSide, skip = -1) =>
  games.findIndex(
    ({ team, opponent }, index) => index !== skip && ((team === moves && opponent === against) || (team === against && opponent === moves)),
  );

/** A game between two sides, a team first when the other is the league's average, as the draw
 *  holds it; null when it would have a side play itself. */
function gameBetween(one: Side, other: Side): Game | null {
  if (one === other) return null;
  if (one === LEAGUE_AVERAGE) return { team: other as TeamId, opponent: one };
  return { team: one, opponent: other };
}

/** `games` with `one`'s and `other`'s moving sides swapped between their two games, or why it
 *  can't be. Pure. */
export function swapSides(
  games: readonly Game[],
  one: PickedSide,
  other: PickedSide,
): { games: Game[]; at: [number, number] } | { refused: "noGame" | "sameGame" | "playsItself" } {
  const first = gameOf(games, one);
  if (first === -1) return { refused: "noGame" };
  const second = gameOf(games, other, first);
  if (second === -1) return { refused: gameOf(games, other) === first ? "sameGame" : "noGame" };
  const [firstAfter, secondAfter] = [gameBetween(other.moves, one.against), gameBetween(one.moves, other.against)];
  if (firstAfter === null || secondAfter === null) return { refused: "playsItself" };
  const swapped = [...games];
  swapped[first] = firstAfter;
  swapped[second] = secondAfter;
  return { games: swapped, at: [first, second] };
}

/** The league's commissioner, co-commissioner or the admin swaps two sides between their games
 *  in a gameweek not yet begun. */
export const swap = mutation({
  args: { leagueId: v.id("leagues"), gameweek: v.number(), one: pickedSide, other: pickedSide },
  returns: v.null(),
  handler: async (ctx, { leagueId, gameweek, one, other }) => {
    const { email: by, league } = await runnerOf(ctx, leagueId);
    const season = await seasonRules(ctx, leagueId);
    const now = Date.now();
    if (isLocked(deadlineOf(await leagueDeadlines(ctx, leagueId))(gameweek), now)) refuse(fixtureEditRefusals.begun(gameweek));
    const drawn = await drawnGameweek(ctx, league, season, gameweek);
    const current = (await scheduleOf(ctx, league, season)).find((each) => each.gameweek === gameweek);
    if (drawn === undefined || current === undefined || season.inGameweek(gameweek).format !== "headToHead") {
      refuse(fixtureEditRefusals.notHeadToHead(gameweek));
    }
    const result = swapSides(current.fixtures, one, other);
    if ("refused" in result) {
      const why = fixtureEditRefusals[result.refused];
      refuse(typeof why === "function" ? why(gameweek) : why);
    }

    const row = { leagueId, gameweek, fixtures: result.games, byes: current.byes, drawn: { fixtures: drawn.fixtures, byes: drawn.byes }, editedAt: now };
    const held = await ctx.db
      .query("fixtureEdits")
      .withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId).eq("gameweek", gameweek))
      .unique();
    if (held === null) await ctx.db.insert("fixtureEdits", row);
    else await ctx.db.replace("fixtureEdits", held._id, row);

    const names = new Map((await teamsOf(ctx, leagueId)).map((team) => [team._id, team.name]));
    const named = (team: TeamId) => names.get(team)!;
    const nameOf = (side: Side) => (side === LEAGUE_AVERAGE ? null : named(side));
    await recordEvent(ctx, leagueId, by, {
      kind: "fixturesSwapped",
      gameweek,
      swapped: [nameOf(one.moves), nameOf(other.moves)],
      games: result.at.map((index) => namedFixture(result.games[index], named)),
    });
    return null;
  },
});
