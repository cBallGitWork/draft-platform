import { expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import { MINUTE_MS, HOUR_MS } from "../../../convex/shared/time";
import { recordedGw6 } from "../../support/recorded/gw6.payloads";
import { FULL_TIME_READ, GAMEWEEK, heldMatch } from "../../support/convex/matchStats.harness";
import { actingAs } from "../../support/convex/leagues.harness";
import { elapse } from "../../support/convex/test.harness";
import { DEADLINE, ELEVENS, footballSyncAt, leagueWorld, liveTickAt, miniBetaLeague } from "../../support/convex/miniBeta.harness";

// The whole-gameweek golden (#527): recorded gameweek 6, played by the mini beta's league of four
// under the league's own scoring (the first rules' set) through the entry points the app and the
// crons call, to the lock. Every player's points as each matchup shows them, and every
// head-to-head result, must match golden/gameweek6.scores.json. The file was written by running
// this test on the scorer as it stood (31 Oct 2026); a refactor near scoring owes it unchanged
// (docs/REFACTORING.md, Proving nothing changed). How each number comes about is pinned elsewhere
// (miniBetaGameweek.test.ts, scoring.test.ts); this says none of them moved.

/** One line per row, so a diff of the golden names exactly what moved. */
const rowsJson = (rows: object[]) => `[\n${rows.map((row) => `    ${JSON.stringify(row)}`).join(",\n")}\n  ]`;

test("recorded gameweek 6, every player's points and every head-to-head result, scores as the golden file", async () => {
  const league = await miniBetaLeague(leagueWorld(recordedGw6(), { beforeKickoff: true }));
  const { t, leagueId } = league;
  await footballSyncAt(t, DEADLINE + MINUTE_MS, leagueWorld(recordedGw6(), { beforeKickoff: true }));
  await liveTickAt(t, FULL_TIME_READ, leagueWorld(recordedGw6()));
  await elapse(t, HOUR_MS);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect((await heldMatch(t)).status?.state).toBe("locked");

  const results = [];
  const players = [];
  for (const email of Object.keys(ELEVENS)) {
    const read = await (await actingAs(t, email)).query(api.matchup.matchup.ofTeam, { leagueId, now: Date.now(), gameweek: GAMEWEEK });
    if (read?.kind !== "headToHead" || read.game.kind !== "scored") throw new Error(`${email}'s matchup isn't scored: ${JSON.stringify(read)}`);
    const { team, opponent } = read.game;
    if (team.kind !== "team" || opponent.kind !== "team") throw new Error(`${email}'s matchup isn't against a team: ${JSON.stringify(read.game)}`);
    const result = team.points > opponent.points ? "won" : team.points === opponent.points ? "drawn" : "lost";
    results.push({ team: team.teamName, points: team.points, opponent: opponent.teamName, opponentPoints: opponent.points, result, provisional: team.provisional });
    for (const [place, slots] of [["starter", team.lineup.starters], ["bench", team.lineup.bench]] as const) {
      for (const { playerCode, name, area, points, counts } of slots) players.push({ team: team.teamName, place, playerCode, name, area, points, counts });
    }
  }

  const golden = `{\n  "gameweek": ${GAMEWEEK},\n  "headToHeads": ${rowsJson(results)},\n  "players": ${rowsJson(players)}\n}\n`;
  await expect(golden).toMatchFileSnapshot("../../support/golden/gameweek6.scores.json");
});
