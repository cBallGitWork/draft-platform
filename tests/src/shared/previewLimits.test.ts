// The preview at the league limits (#2136): `?limits` beside `?preview=` puts the made-up league at
// leagueLimits.ts's most teams, every name at the longest, and a squad at the most players, so a
// screen can be looked at full. Each test loads the preview afresh, as the switch is read on load.

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LEAGUE_NAME_MAX, MOST_IN_SQUAD, MOST_TEAMS, TEAM_NAME_MAX } from "../../../convex/leagues/leagueLimits";
import { PREVIEW_LIMITS_KEY } from "../../../src/shared/preview";

/** The preview's modules, loaded with the address at `search`. */
async function previewAt(search: string) {
  window.history.replaceState(null, "", `/${search}`);
  vi.resetModules();
  const [shared, table, myTeam, squads] = await Promise.all([
    import("../../../src/shared/preview"),
    import("../../../src/table/preview"),
    import("../../../src/myTeam/preview"),
    import("../../../src/squads/preview"),
  ]);
  return { ...shared, ...table, ...myTeam, ...squads };
}

const leagueId = "preview-pro-league" as never;

beforeEach(() => vi.resetModules());
afterEach(() => window.history.replaceState(null, "", "/"));

it("puts the league at the most teams, each name, the league's too, at the longest", async () => {
  const preview = await previewAt(`?preview=manager&${PREVIEW_LIMITS_KEY}`);

  expect(preview.previewAtLimits).toBe(true);
  expect(preview.previewTeamNames).toHaveLength(MOST_TEAMS);
  expect(new Set(preview.previewTeamNames).size).toBe(MOST_TEAMS);
  expect(preview.previewTeamNames.filter((name) => name.length !== TEAM_NAME_MAX)).toEqual([]);
  expect(preview.proLeague.name).toHaveLength(LEAGUE_NAME_MAX);
  expect(preview.proLeague.teams).toBe(MOST_TEAMS);
  expect(preview.proLeague.maxTeams).toBe(MOST_TEAMS);
  expect(preview.previewTable.useLeagueTable(leagueId)!.table).toHaveLength(MOST_TEAMS);
});

it("holds a squad at the most players, on My team and on Squads", async () => {
  const preview = await previewAt(`?preview=manager&${PREVIEW_LIMITS_KEY}`);

  expect(preview.previewMyTeam.useTeamSquad(leagueId)!.players).toHaveLength(MOST_IN_SQUAD);
  expect(Math.max(...preview.previewSquads.useSquads(leagueId)!.map((squad) => squad.players.length))).toBe(MOST_IN_SQUAD);
});

it("without the switch, keeps the preview's own nine teams and fifteen-man squad", async () => {
  const preview = await previewAt("?preview=manager");

  expect(preview.previewAtLimits).toBe(false);
  expect(preview.previewTeamNames).toHaveLength(9);
  expect(preview.previewMyTeam.useTeamSquad(leagueId)!.players).toHaveLength(15);
});
