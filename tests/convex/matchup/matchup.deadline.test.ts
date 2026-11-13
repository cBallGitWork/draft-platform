import { expect, test } from "vitest";
import { positionOfSlot } from "../../../convex/lineup/pitch";
import { everyRoleOf, namedRole, roleIn } from "../../../convex/lineup/roles";
import { FIRST_RUNS } from "../../../convex/scoring/draftedRoleRuns";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { holdSiteScoring } from "../../support/convex/siteScoring.harness";
import {
  annsScoredGame,
  BOBS_TEAM,
  EVERTON_STARTERS,
  GAMEWEEK,
  giveAnnsStarterRole,
  HULL_SCORER,
  HULL_STARTERS,
  lineupOf,
  matchupAs,
  scoresLeague,
} from "../../support/convex/gameweekScores.harness";
import { ADMIN, COMMISSIONER } from "../../support/convex/leagues.harness";

// Who sees a lineup on the matchup, and when (#799; spec/10, The matchup, as a live match): before
// the deadline nobody sees another team's, the commissioner and the admin included ("they just get
// to view what the managers see", Craig, 31 Oct 2026); at it both show, each starter in his role.

test.each([
  ["the commissioner", COMMISSIONER],
  ["the admin", ADMIN],
])("before the deadline %s sees only who meets whom, no lineup, as a manager does", async (_who, email) => {
  const league = await scoresLeague();
  const read = await matchupAs(league, email, { teamId: league.annsTeam, gameweek: GAMEWEEK + 1 });
  expect(read).toMatchObject({ kind: "headToHead", teamId: league.annsTeam, gameweek: GAMEWEEK + 1 });
  // The whole game, so a lineup sent beside it would fail here.
  expect(read?.kind === "headToHead" && read.game).toEqual({ kind: "notBegun", opponent: { kind: "team", teamName: BOBS_TEAM } });
});

test("once the deadline has passed each starter on both sides carries his role: the one he was given, else his slot's first", async () => {
  const league = await scoresLeague();
  const scorer = HULL_STARTERS.find((starter) => starter.playerCode === HULL_SCORER)!;
  const [first, given] = everyRoleOf(scorer);
  await giveAnnsStarterRole(league, HULL_SCORER, given.key);

  const game = await annsScoredGame(league, GAMEWEEK);
  expect(lineupOf(game.team).starters.map((slot) => slot.playerCode)).toEqual(HULL_STARTERS.map((starter) => starter.playerCode));
  const hull = new Map(lineupOf(game.team).starters.map((slot) => [slot.playerCode, slot.role]));
  expect(hull.get(HULL_SCORER)).toEqual(namedRole(given));
  expect(given.key).not.toBe(first.key);
  // The rest of Hull's, and every one of Everton's, plays his slot's first.
  for (const starter of HULL_STARTERS.filter(({ playerCode }) => playerCode !== HULL_SCORER)) {
    expect(hull.get(starter.playerCode)).toEqual(namedRole(roleIn(starter, undefined)));
  }
  const everton = new Map(lineupOf(game.opponent).starters.map((slot) => [slot.playerCode, slot.role]));
  for (const starter of EVERTON_STARTERS) expect(everton.get(starter.playerCode)).toEqual(namedRole(roleIn(starter, undefined)));
  // Nobody has come on, so the bench plays none.
  expect(lineupOf(game.team).bench.map((slot) => slot.role)).toEqual(lineupOf(game.team).bench.map(() => null));
});

// spec/10: "Each starter on the matchup's lineups shows his slot's position label and his role's
// run, as on the Tactics pitch" (#850). The run is the site's scoring set's for his role (`S05.8`).
test("once the deadline has passed each starter on both sides carries his slot's lane and label, and from them his role's run", async () => {
  const league = await scoresLeague();
  await league.t.run((ctx) => holdSiteScoring(ctx, { scoring: { ...FIRST_SCORING, runs: [...FIRST_RUNS] }, kind: "fix" }));
  const game = await annsScoredGame(league, GAMEWEEK);
  for (const [side, starters] of [[game.team, HULL_STARTERS], [game.opponent, EVERTON_STARTERS]] as const) {
    const sent = lineupOf(side).starters;
    expect(sent.map(({ playerCode, area, place }) => ({ playerCode, area, lane: place.lane, label: place.label }))).toEqual(
      starters.map(({ playerCode, area, lane }) => ({ playerCode, area, lane, label: positionOfSlot({ area, lane }) })),
    );
    // Each starter's run is his role's at his cell: the one the Tactics pitch draws.
    for (const { area, place, role } of sent) expect(roleIn({ area, lane: place.lane }, role.key).key).toBe(role.key);
  }
  // Each side carries the gameweek's set's runs, and Hull's lineup holds at least one moving role,
  // so the matchup has a run to draw.
  for (const side of [game.team, game.opponent]) expect(side.kind === "team" && side.runs).toEqual(FIRST_RUNS);
  expect(lineupOf(game.team).starters.some(({ role }) => FIRST_RUNS.some((run) => run.role === role.key))).toBe(true);
  // Nobody has come on, so the bench stands in no slot.
  expect(lineupOf(game.team).bench.map((slot) => slot.place)).toEqual(lineupOf(game.team).bench.map(() => null));
});
