import { expect, test } from "vitest";
import type { LineupProblem } from "../../../convex/lineup/lineup";
import { problemWords } from "../../../convex/lineup/lineupWords";

// Each of lineup.ts's problems as a manager is told it when a save is refused (#8).

const nameOf = (playerCode: number) => `Player ${playerCode}`;

test.each<[LineupProblem, string]>([
  [{ kind: "wrongStarterCount", starterCount: 10 }, "A lineup starts 11 players; this one starts 10."],
  [{ kind: "playerTwice", playerCode: 7 }, "Player 7 is in the lineup twice."],
  [{ kind: "noSuchCell", playerCode: 7, area: "bench", lane: "middle" }, 'Player 7 is placed at "bench", "middle", which isn\'t a cell on the pitch.'],
  [{ kind: "cellShared", area: "midfield", lane: "rightCentre", playerCodes: [1, 2, 3] }, "Player 1, Player 2 and Player 3 share the right-centre cell in Midfield: one player a cell."],
  [{ kind: "positionsUnknown", playerCode: 7 }, "Player 7 has no positions yet, so he can't start."],
  [
    { kind: "outsideHisAreas", playerCode: 7, area: "attack", lane: "centre", positions: ["CB", "FB"] },
    "Player 7 plays CB, FB, so he can't stand in the centre cell in Attack.",
  ],
  [{ kind: "aboveMaximum", area: "defence", starterCount: 6, maximum: 5 }, "The league starts at most 5 in Defence; this lineup starts 6 there."],
  [{ kind: "belowMinimum", area: "goalkeeper", starterCount: 0, minimum: 1 }, "The league starts at least 1 in Goalkeeper; this lineup starts 0 there."],
])("%o reads %s", (problem, words) => {
  expect(problemWords(problem, nameOf)).toBe(words);
});
