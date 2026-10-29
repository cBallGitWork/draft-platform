import { expect, test } from "vitest";
import { plTeamStats } from "../../../../convex/football/premierLeague/plTeamStats";
import { COMMENTARY_MATCH, recordedTeamStats, UPCOMING_MATCH } from "../../../support/recorded/commentary.payloads";
import { HULL_EVERTON_TEAM_STATS } from "../../../support/convex/matchStats.harness";
import { LIVE_TEAM_STATS, recordedLiveTeamStats } from "../../../support/recorded/live.payloads";

// spec/10's five team stats (shots, shots on target, possession, corners, cards), mapped from the
// recorded `/stats/match/{id}` reads by Opta's names (docs/pl-commentary.md, Team stats).

test("Brentford v Liverpool's five, as docs/pl-commentary.md's table has them, the second yellow in the reds", () => {
  expect(plTeamStats(recordedTeamStats(COMMENTARY_MATCH.brentfordLiverpool))).toEqual({
    home: { shots: 10, shotsOnTarget: 2, possession: 40, corners: 3, yellowCards: 2, redCards: 2 },
    away: { shots: 21, shotsOnTarget: 5, possession: 60, corners: 9, yellowCards: 3, redCards: 0 },
  });
});

test("each side is placed by the match's own teams, not by the order the read keys them in", () => {
  const read = recordedTeamStats(COMMENTARY_MATCH.hullEverton);
  // Everton's totals come first in the read; Hull are at home.
  const [hull, everton] = read.entity.teams!.map(({ team }) => String(team.id));
  expect(Object.keys(read.data!)).toEqual([everton, hull]);
  expect(plTeamStats(read)).toEqual(HULL_EVERTON_TEAM_STATS);
});

test("days before kickoff there is no data, so there are no stats", () => {
  expect(plTeamStats(recordedTeamStats(UPCOMING_MATCH))).toBeNull();
});

test("before the first minutes' stats come, each side is noughts with no possession; then they move", () => {
  const nothingYet = { shots: 0, shotsOnTarget: 0, possession: null, corners: 0, yellowCards: 0, redCards: 0 };
  expect(plTeamStats(recordedLiveTeamStats(LIVE_TEAM_STATS.beforeKickoff))).toEqual({ home: nothingYet, away: nothingYet });
  expect(plTeamStats(recordedLiveTeamStats(LIVE_TEAM_STATS.firstMoved))).toEqual({
    home: { ...nothingYet, shots: 1, possession: 23 },
    away: { ...nothingYet, possession: 77 },
  });
  expect(plTeamStats(recordedLiveTeamStats(LIVE_TEAM_STATS.final))).toEqual({
    home: { shots: 7, shotsOnTarget: 3, possession: 49.4, corners: 0, yellowCards: 1, redCards: 0 },
    away: { shots: 17, shotsOnTarget: 5, possession: 50.6, corners: 5, yellowCards: 1, redCards: 0 },
  });
});

test("a read keyed by a team the match doesn't have, or missing one of its two, throws rather than guess", () => {
  const read = recordedTeamStats(COMMENTARY_MATCH.brentfordLiverpool);
  const [home, away] = read.entity.teams!.map(({ team }) => String(team.id));
  const stranger = structuredClone(read);
  stranger.data = { [home]: read.data![home], 999: read.data![away] };
  expect(() => plTeamStats(stranger)).toThrow(`PL fixture ${read.entity.id}'s team stats are for teams ${home}, 999, not ${home} and ${away}`);

  const oneSide = structuredClone(read);
  oneSide.data = { [home]: read.data![home] };
  expect(() => plTeamStats(oneSide)).toThrow(`team stats are for teams ${home}, not ${home} and ${away}`);

  const noTeams = structuredClone(read);
  delete noTeams.entity.teams;
  expect(() => plTeamStats(noTeams)).toThrow(`PL fixture ${read.entity.id}'s team stats name no two teams`);
});
