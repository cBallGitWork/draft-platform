import { expect, test } from "vitest";
import type { Cell } from "../../../convex/lineup/pitch";
import { everyRoleOf } from "../../../convex/lineup/roles";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { DAY_MS } from "../../../convex/shared/time";
import { fullTimeRecords } from "../../support/convex/gameweekScoresMatch.harness";
import { annsScoredGame, GAMEWEEK, giveAnnsStarterRole, HULL_SCORER, HULL_STARTERS, HULL_STRIKER, PHILLIPS, scoresLeague, slotOf } from "../../support/convex/gameweekScores.harness";
import { pricedRole } from "../../support/convex/scoring.example";
import { holdSiteScoring } from "../../support/convex/siteScoring.harness";

// Tapping a player on the matchup shows his breakdown for the match (#798; spec/10: "the opposition
// manager needs to see why his opponent got the points"), from the table's own scorer, so its lines
// and his points never disagree.

test("a starter with a role, scored in a recorded gameweek, gets breakdown lines adding up to his matchup points, role line included", async () => {
  const league = await scoresLeague();
  const scorersSlot = HULL_STARTERS.find((starter) => starter.playerCode === HULL_SCORER)!;
  const [role] = everyRoleOf(scorersSlot);
  // His role earns a point a goal, so its line is in his points.
  await league.t.run((ctx) =>
    holdSiteScoring(ctx, { scoring: { ...FIRST_SCORING, roles: [pricedRole(role.key, "goals_scored", 1)] }, kind: "patch", at: Date.now() - 365 * DAY_MS }),
  );
  await giveAnnsStarterRole(league, HULL_SCORER, role.key);
  await fullTimeRecords(league);

  const game = await annsScoredGame(league, GAMEWEEK);
  const scorer = slotOf(game.team, HULL_SCORER);
  const [match] = scorer.breakdown;

  expect(scorer.breakdown).toHaveLength(1);
  expect(match).toMatchObject({ counted: true, override: null, role: { name: role.name, points: 1 } });
  expect(match.categories.find((each) => each.stat === "goals_scored")).toMatchObject({ name: "Goals scored", why: { actions: 1 } });
  const lines = match.categories.reduce((total, each) => total + (each.points ?? 0), 0) + (match.role?.points ?? 0);
  expect(lines).toBe(match.points);
  expect(match.points).toBe(scorer.points);
  expect(game.version).not.toBeNull();
});

// spec/05, Team instructions (#990): "It shows as its own line under his role's line on the matchup
// breakdown". Each instruction here earns a point a goal, so the line is in his points.
const GOAL_A_POINT = (instruction: string) => ({ instruction, lines: [{ stats: [{ stat: "goals_scored", weight: 1 }], every: 1, points: 1 }] });

test("his team's picked instructions each get a line under his role's, named as the league names them, in his points", async () => {
  const league = await scoresLeague();
  await league.t.run((ctx) =>
    holdSiteScoring(ctx, {
      scoring: { ...FIRST_SCORING, instructions: [GOAL_A_POINT("shootOnSight"), GOAL_A_POINT("getStuckIn"), GOAL_A_POINT("playOutFromTheBack")] },
      kind: "patch",
      season: 2026,
      number: 1,
      at: Date.now() - 365 * DAY_MS,
    }),
  );
  await picksAnnsInstructions(league, { attacking: "shootOnSight", defensive: "getStuckIn" });
  await fullTimeRecords(league);

  const scorer = slotOf((await annsScoredGame(league, GAMEWEEK)).team, HULL_SCORER);
  const [match] = scorer.breakdown;
  expect(match.instructions).toEqual([
    { name: "Shoot on sight", points: 1, sides: [{ points: 1, lines: [{ stat: "goals_scored", name: "Goals scored", actions: 1 }] }] },
    { name: "Get stuck in", points: 1, sides: [{ points: 1, lines: [{ stat: "goals_scored", name: "Goals scored", actions: 1 }] }] },
  ]);
  const lines = match.categories.reduce((total, each) => total + (each.points ?? 0), 0) + (match.role?.points ?? 0) + 2;
  expect(lines).toBe(match.points);
});

test("a team that hasn't picked plays its formation's default pair", async () => {
  const league = await scoresLeague();
  await league.t.run((ctx) =>
    holdSiteScoring(ctx, { scoring: { ...FIRST_SCORING, instructions: [GOAL_A_POINT("playOutFromTheBack")] }, kind: "patch", at: Date.now() - 365 * DAY_MS }),
  );
  await fullTimeRecords(league);

  const [match] = slotOf((await annsScoredGame(league, GAMEWEEK)).team, HULL_SCORER).breakdown;
  expect(match.instructions?.map(({ name, points }) => [name, points])).toEqual([["Play out from the back", 1]]);
});

/** Ann's lineup as its manager picked these two instructions. */
const picksAnnsInstructions = ({ t, annsTeam }: Awaited<ReturnType<typeof scoresLeague>>, instructions: { attacking: string; defensive: string }) =>
  t.run(async (ctx) => {
    const lineup = (await ctx.db.query("lineups").collect()).find((each) => each.teamId === annsTeam)!;
    await ctx.db.patch("lineups", lineup._id, { instructions });
  });

// spec/05, Team instructions (#990): two at the back's own clean sheet and goals conceded count only
// from the first gameweek whose site set scores instructions (teamGameweek.ts's teamScoring), so a
// gameweek played before them keeps FPL's line.
const HULL_CENTRE_BACK = 193278;

test("two at the back reprices its centre back's goals conceded only once the site set scores instructions", async () => {
  const goalsConcededOf = async (scoresInstructions: boolean) => {
    const league = await scoresLeague();
    if (scoresInstructions) {
      await league.t.run((ctx) =>
        holdSiteScoring(ctx, { scoring: { ...FIRST_SCORING, instructions: [GOAL_A_POINT("playOutFromTheBack")] }, kind: "patch", at: Date.now() - 365 * DAY_MS }),
      );
    }
    await standsAnnInTwoThreeFive(league);
    await fullTimeRecords(league);
    const [match] = slotOf((await annsScoredGame(league, GAMEWEEK)).team, HULL_CENTRE_BACK).breakdown;
    const line = match.categories.find((each) => each.stat === "goals_conceded");
    if (line === undefined || line.points === null) throw new Error("his breakdown has no priced goals conceded line");
    return line;
  };

  const before = await goalsConcededOf(false);
  const after = await goalsConcededOf(true);
  expect(before.points).toBe(-1); // FPL's: a point off for every two conceded
  expect(after.why.actions).toBe(before.why.actions);
  expect(after.why.actions).toBeGreaterThan(1);
  expect(after.points).toBe(-after.why.actions); // the back line's: a point off for every one
});

/** Ann's eleven stood as a 2-3-5: two of her back five stay at the back, the rest step up. */
const standsAnnInTwoThreeFive = ({ t, annsTeam }: Awaited<ReturnType<typeof scoresLeague>>) =>
  t.run(async (ctx) => {
    const lineup = (await ctx.db.query("lineups").collect()).find((each) => each.teamId === annsTeam)!;
    const shape: { area: Cell["area"]; lane: Cell["lane"] }[] = [
      { area: "goalkeeper", lane: "centre" },
      { area: "defence", lane: "leftCentre" },
      { area: "defence", lane: "rightCentre" },
      { area: "midfield", lane: "leftCentre" },
      { area: "midfield", lane: "centre" },
      { area: "midfield", lane: "rightCentre" },
      { area: "attack", lane: "left" },
      { area: "attack", lane: "leftCentre" },
      { area: "attack", lane: "centre" },
      { area: "attack", lane: "rightCentre" },
      { area: "attack", lane: "right" },
    ];
    const order = [PHILLIPS, HULL_CENTRE_BACK, 232351, 243413, HULL_SCORER, 243951, 606930, 108416, HULL_STRIKER, 146426, 101282];
    await ctx.db.patch("lineups", lineup._id, { starters: order.map((playerCode, index) => ({ playerCode, ...shape[index] })) });
  });
