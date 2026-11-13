// The matchup's seam's live wiring, with Convex's query and mutations faked by name: what it asks
// the server, that it hands on what comes back as it comes, and that a refused team override comes
// back in the server's words.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { expect, test, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { teamOverrideRefusals } from "../../../convex/table/teamOverrides";
import { liveMatchup } from "../../../src/matchup/liveMatchup";
import { overrideFailedWords } from "../../../src/matchup/words";
import { silenceConsoleError } from "../../support/console.setup";
import { A_LEAGUE_ID } from "../../support/src/convexReact.harness";

const convex = vi.hoisted(() => ({ thisGameweek: vi.fn(), ofTeam: vi.fn(), overrideTeam: vi.fn(), removeTeamOverride: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "matchup/matchupGameweek:thisGameweek": convex.thisGameweek, "matchup/matchup:ofTeam": convex.ofTeam },
    mutations: {
      "table/teamOverrides:overrideTeam": convex.overrideTeam,
      "table/teamOverrides:removeTeamOverride": convex.removeTeamOverride,
    },
  }),
);

const teamId = "team-1" as Id<"teams">;
const NOW = Date.parse("2026-10-27T16:00:00Z");

// Only the small query saying which gameweek it opens on takes the minute (#1550), and only with
// none asked: the matchup itself takes the gameweek.
test("it asks matchup/matchup:ofTeam for the league and the matchup asked for, no minute, and hands on what comes back", () => {
  const matchup = { kind: "totalPoints" };
  convex.ofTeam.mockReturnValue(matchup);
  expect(renderHook(() => liveMatchup.useMatchup(A_LEAGUE_ID, NOW, { teamId, gameweek: 6 })).result.current).toEqual(matchup);
  expect(convex.ofTeam).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, teamId, gameweek: 6 });
  expect(convex.thisGameweek).toHaveBeenCalledWith("skip");
});

test("with no gameweek asked, matchup/matchupGameweek:thisGameweek says which at the minute, and ofTeam is asked for that one", () => {
  convex.thisGameweek.mockReturnValue(4);
  convex.ofTeam.mockReturnValue({ kind: "noTeam" });
  renderHook(() => liveMatchup.useMatchup(A_LEAGUE_ID, NOW, { teamId }));
  expect(convex.thisGameweek).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, now: NOW, teamId });
  expect(convex.ofTeam).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, teamId, gameweek: 4 });
});

test("the commentary says delayed from the moment ofTeam sends", () => {
  const scored = { kind: "scored", team: {}, opponent: {}, version: null, commentary: { kind: "read", lines: [], delayedFrom: NOW + 1 } };
  convex.ofTeam.mockReturnValue({ kind: "headToHead", gameweek: 6, game: scored });
  const { result, rerender } = renderHook(({ minute }) => liveMatchup.useMatchup(A_LEAGUE_ID, minute, { gameweek: 6 }), { initialProps: { minute: NOW } });
  const delayed = () => (result.current?.kind === "headToHead" && result.current.game.kind === "scored" && result.current.game.commentary.kind === "read" ? result.current.game.commentary.delayed : null);
  expect(delayed()).toBe(false);
  rerender({ minute: NOW + 1 });
  expect(delayed()).toBe(true);
});

test("it is undefined while loading", () => {
  convex.thisGameweek.mockReturnValue(undefined);
  convex.ofTeam.mockReturnValue(undefined);
  expect(renderHook(() => liveMatchup.useMatchup(A_LEAGUE_ID, NOW, {})).result.current).toBeUndefined();
  expect(convex.ofTeam).toHaveBeenCalledWith("skip");
});

test("overriding a team's total asks table/teamOverrides:overrideTeam with the league spread in; a refusal comes back in the server's words, any other failure plainly", async () => {
  const overrideOf = () => renderHook(() => liveMatchup.useOverrideTeam()).result.current;
  const change = { gameweek: 6, teamId, points: 60, reason: "Two subs the auto-subs missed" };
  convex.overrideTeam.mockResolvedValue(null);
  expect(await overrideOf()(A_LEAGUE_ID, change)).toBeNull();
  expect(convex.overrideTeam).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, ...change });

  convex.overrideTeam.mockRejectedValue(new ConvexError(teamOverrideRefusals.outOfRange));
  expect(await overrideOf()(A_LEAGUE_ID, change)).toBe(teamOverrideRefusals.outOfRange);
  const consoleError = silenceConsoleError();
  convex.overrideTeam.mockRejectedValue(new Error("offline"));
  expect(await overrideOf()(A_LEAGUE_ID, change)).toBe(overrideFailedWords);
  expect(consoleError).toHaveBeenCalledWith("Overriding a team's total failed:", expect.any(Error));
});

test("removing a team's override asks table/teamOverrides:removeTeamOverride with the league, the gameweek and the team", async () => {
  const removeOf = () => renderHook(() => liveMatchup.useRemoveTeamOverride()).result.current;
  convex.removeTeamOverride.mockResolvedValue(null);
  expect(await removeOf()(A_LEAGUE_ID, { gameweek: 6, teamId })).toBeNull();
  expect(convex.removeTeamOverride).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, gameweek: 6, teamId });

  convex.removeTeamOverride.mockRejectedValue(new ConvexError(teamOverrideRefusals.noOverride("Team 1", 6)));
  expect(await removeOf()(A_LEAGUE_ID, { gameweek: 6, teamId })).toBe(teamOverrideRefusals.noOverride("Team 1", 6));
});
