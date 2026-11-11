// A link to a team's matchup leaves its first game out of the address, so every link to a first
// game is the same address, a league playing one a gameweek keeps its plain ones (#913, #1771). S10.2

import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIRST_GAME } from "../../../convex/matchup/matchupShape";
import { matchupLink } from "../../../src/matchup/paths";

const team = "team-1" as Id<"teams">;
const gameweek = 6;
const SECOND_GAME = FIRST_GAME + 1;

describe("matchupLink", () => {
  it("gives the first game and no game the same search, with no game in it", () => {
    expect(matchupLink(team, gameweek, FIRST_GAME).search).toEqual({ team, gameweek });
    expect(matchupLink(team, gameweek).search).toEqual({ team, gameweek });
  });

  it("keeps any other game", () => {
    expect(matchupLink(team, gameweek, SECOND_GAME).search).toEqual({ team, gameweek, game: SECOND_GAME });
  });
});
