import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Lineup } from "../../../convex/lineup/lineup";
import { HELD_FIRST_RULES, holdGameweeks, rulesInGameweek, rulesRevision, TOTAL_POINTS } from "../../support/convex/leagueRules.harness";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { FOUR_FOUR_TWO, holdSquad } from "../../support/convex/lineupSquad.harness";
import { lineupInGameweek } from "../../../convex/lineup/lineups";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// A whole gameweek postponed behind the gameweek being played (#413): every match of gameweek 7
// waits for a new date, with no gameweek or kickoff, while gameweek 8 is under way. Gameweek 7 has
// no deadline, so it never begins; but a lineup or a rule change saved now must not land in it, or
// it becomes gameweek 8's, after gameweek 8's deadline (spec/05: the deadline "locks the whole
// lineup"; spec/09: a change "applies from the next gameweek on"). What gameweek 7 then means for
// its head-to-heads is not settled.

const [ANN] = MANAGERS;
const POSTPONED = 7;
const UNDER_WAY = 8;
/** holdGameweeks' next gameweek: every one before it has begun. */
const NEXT = 9;

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: NEXT });
  // holdGameweeks gives each gameweek one match, coded with its number.
  await t.run(async (ctx) => {
    const match = await ctx.db
      .query("fixtures")
      .withIndex("by_code", (q) => q.eq("code", POSTPONED))
      .unique();
    await ctx.db.patch("fixtures", match!._id, { gameweek: null, kickoff: null });
  });
  leagueId = await adminCreatesLeague(t);
});

/** The lineup as a browser sends it. */
const sent = (lineup: Lineup) => ({ starters: [...lineup.starters], bench: [...lineup.bench] });

test("a lineup saved now is from the gameweek after the one under way, and that one keeps none of it", async () => {
  const [annsTeam] = await addManagers(t, leagueId, [ANN]);
  await holdSquad(t, leagueId, annsTeam);
  const ann = await actingAs(t, ANN);

  expect(await ann.mutation(api.lineup.lineups.save, { leagueId, lineup: sent(FOUR_FOUR_TWO) })).toBe(NEXT);
  // No row reaches it: it holds no saved lineup, only the squad's first (#637).
  expect(await t.run((ctx) => lineupInGameweek(ctx, leagueId, annsTeam, UNDER_WAY))).toMatchObject({ fromGameweek: null });
});

test("a rule change made now takes effect from the gameweek after the one under way, which keeps its rules", async () => {
  const commissioner = await actingAs(t, COMMISSIONER);
  const revision = await rulesRevision(t, leagueId);

  expect(await commissioner.mutation(api.rules.leagueRules.change, { leagueId, rules: TOTAL_POINTS, revision })).toBe(NEXT);
  expect(await t.run((ctx) => rulesInGameweek(ctx, leagueId, UNDER_WAY))).toEqual(HELD_FIRST_RULES);
});
