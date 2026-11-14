import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { PICK_GAP_MS } from "../../../convex/draft/draftClock";
import { tablesKeyedToLeague } from "../../../convex/leagues/leagueDeletion";
import { LIVE_CHECK_LEAGUE_NAME } from "../../../convex/leagues/liveCheckLeague";
import { TEST_ACCOUNT_EMAIL_SETTING, TEST_ACCOUNT_SECRET_SETTING } from "../../../convex/outbound/deploymentSettings";
import type { Position } from "../../../convex/positions/positionTables";
import { DAY_MS, HOUR_MS } from "../../../convex/shared/time";
import { insertSetPositions } from "../../support/convex/footballRows.harness";
import { recordedGw6 } from "../../support/recorded/gw6.payloads";
import { ADMIN, type TestConvex } from "../../support/convex/leagues.harness";
import { DEADLINE, footballSyncAt, leagueWorld } from "../../support/convex/miniBeta.harness";
import { rowsKeyedTo } from "../../support/convex/leagueDeletion.harness";
import { signInDeployment } from "../../support/convex/signIn.harness";
import { elapse, SLOW_TEST } from "../../support/convex/test.harness";

// The first live-data check's test league (spec/20, The first live-data check; #2114): one run makes two teams,
// Craig's and the test account's, drafts both by auto-pick and leaves each a lineup the auto team
// sets; a second run finds it; a delete leaves nothing of it.

const TEST_ACCOUNT = "release-check@example.resend.app";
/** The week before gameweek 6's deadline, with the recorded season's players synced. */
const SETUP_MORNING = DEADLINE - 7 * DAY_MS;

/** A keeper, a defender, a midfielder and a forward's positions. */
const LINES: Position[][] = [["GK"], ["CB", "FB"], ["CDM", "CM", "WM", "CAM"], ["W", "SS", "ST"]];

let t: TestConvex;

beforeEach(async () => {
  t = await signInDeployment(SETUP_MORNING);
  const synced = await footballSyncAt(t, SETUP_MORNING, leagueWorld(recordedGw6(), { beforeKickoff: true }));
  if (!synced.outcome.ok) throw new Error(`the football sync failed: ${synced.outcome.error}`);
  // Each player's positions, as the positions sync or the admin would give them: one line each, in turn.
  await t.run(async (ctx) => {
    const players = await ctx.db.query("players").collect();
    for (const [index, { code }] of players.entries()) await insertSetPositions(ctx, code, LINES[index % LINES.length]);
  });
  vi.stubEnv(TEST_ACCOUNT_EMAIL_SETTING, TEST_ACCOUNT);
  vi.stubEnv(TEST_ACCOUNT_SECRET_SETTING, "a-secret");
});

const make = () => t.mutation(internal.leagues.liveCheckLeague.make, {});
const state = () => t.query(internal.leagues.liveCheckLeague.state, {});

test("one run makes two drafted teams, Craig's and the test account's, each with a lineup that stands; a second finds it; a delete leaves nothing", SLOW_TEST, async () => {
  const first = await make();
  expect(first.made).toBe(true);
  // The draft runs itself, both teams on auto-pick, a pick each PICK_GAP_MS: well within an hour.
  for (let waited = 0; waited < HOUR_MS && !(await state())!.draftOver; waited += PICK_GAP_MS) await elapse(t, PICK_GAP_MS);

  const made = (await state())!;
  expect(made.draftOver).toBe(true);
  expect(made.squadSize).toBeGreaterThan(0);
  expect(made.teams.map(({ managerEmail }) => managerEmail)).toEqual([ADMIN, TEST_ACCOUNT]);
  for (const team of made.teams) {
    expect(team.players).toBe(made.squadSize);
    expect(team.onAutoTeam).toBe(true);
    expect(team.lineupStands).toBe(true);
  }
  const league = await t.run((ctx) => ctx.db.get("leagues", first.leagueId));
  expect(league).toMatchObject({ name: LIVE_CHECK_LEAGUE_NAME, commissionerEmail: ADMIN });

  expect(await make()).toEqual({ made: false, leagueId: first.leagueId });
  expect(await t.run(async (ctx) => (await ctx.db.query("leagues").collect()).length)).toBe(1);

  expect(await t.mutation(internal.leagues.liveCheckLeague.remove, {})).toBe(true);
  await elapse(t, 0);
  expect(await state()).toBeNull();
  expect(await t.run((ctx) => ctx.db.get("leagues", first.leagueId))).toBeNull();
  const left = await rowsKeyedTo(t, first.leagueId);
  expect(Object.keys(left)).toHaveLength(tablesKeyedToLeague.length);
  expect(Object.values(left).every((count) => count === 0)).toBe(true);
  expect(await t.mutation(internal.leagues.liveCheckLeague.remove, {})).toBe(false);
});

test("with no test account on the deployment, nothing is made", async () => {
  vi.stubEnv(TEST_ACCOUNT_SECRET_SETTING, "");
  await expect(make()).rejects.toThrow(TEST_ACCOUNT_EMAIL_SETTING);
  expect(await state()).toBeNull();
});
