import { expect, test } from "vitest";
import type { LineupProblem } from "../../../convex/lineup/lineup";
import { problemWords } from "../../../convex/lineup/lineupWords";

// Each of lineup.ts's problems as a manager is told it when a save is refused (#8).

const nameOf = (playerCode: number) => `Player ${playerCode}`;

test.each<[LineupProblem, string]>([
  [{ kind: "wrongStarterCount", starterCount: 10 }, "A line-up starts 11. This one starts 10."],
  [{ kind: "playerTwice", playerCode: 7 }, "Player 7 is in the line-up twice."],
  [{ kind: "noSuchCell", playerCode: 7, area: "bench", lane: "middle" }, 'Player 7\'s spot ("bench", "middle") isn\'t on the pitch.'],
  [{ kind: "cellShared", area: "midfield", lane: "rightCentre", playerCodes: [1, 2, 3] }, "Player 1, Player 2 and Player 3 are in the same spot, right-centre in midfield. Only one player fits there."], // one-home-ok: pins the exact words a manager reads
  [{ kind: "positionsUnknown", playerCode: 7 }, "Player 7 has no positions yet, so he can't start."],
  [
    { kind: "outsideHisAreas", playerCode: 7, area: "attack", lane: "centre", positions: ["CB", "FB"] },
    "Player 7 plays CB, FB, so he can't play centre in attack.",
  ],
  [
    { kind: "outsideHisAreas", playerCode: 7, area: "midfield", lane: "centre", positions: [] },
    "Player 7 has no positions, so he can't play centre in midfield.",
  ],
  [{ kind: "aboveMaximum", area: "defence", starterCount: 6, maximum: 5 }, "The league allows at most 5 in defence. You have 6."], // one-home-ok: pins the exact words a manager reads
  [{ kind: "belowMinimum", area: "goalkeeper", starterCount: 0, minimum: 1 }, "The league needs at least 1 in goal. You have 0."], // one-home-ok: pins the exact words a manager reads
])("%o reads %s", (problem, words) => {
  expect(problemWords(problem, nameOf)).toBe(words);
});
