import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { tradeRulesOf } from "../../../convex/rules/firstRules";
import { latestRules } from "../../../convex/rules/rulesHistory";
import { refusals } from "../../../convex/shared/leagueAccess";
import { draftSteps } from "../../support/convex/draft.harness";
import { changeRules, rulesWith } from "../../support/convex/leagueRules.harness";
import {
  ADMIN,
  actingAs,
  COMMISSIONER,
  LEAGUE_NAME,
  leagueRow,
  lettersTo,
  MANAGERS,
  noCommissionerLeague,
  TEST_LEAGUE_TEAMS,
  type TestConvex,
} from "../../support/convex/leagues.harness";
import { expectRefused } from "../../support/convex/test.harness";

// A league made with no commissioner (spec/01 S01.1, S01.2, S01.4; #2660): its set-up manager runs
// it until the draft starts, a veto is saved as a vote, and the commissioner's letters reach everyone.

const SET_UP_BY = MANAGERS[0];

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  ({ t, leagueId } = await noCommissionerLeague());
});

const setMaxTeams = async (email: string, maxTeams: number) =>
  (await actingAs(t, email)).mutation(api.leagues.leagues.setMaxTeams, { leagueId, maxTeams });
const review = () => t.run(async (ctx) => tradeRulesOf(await latestRules(ctx, leagueId)).review);

describe("a league with no commissioner", () => {
  test("S01.1 is made with none, and its set-up manager runs it until the draft starts, when the settings lock but for the admin", async () => {
    const made = await leagueRow(t, leagueId);
    expect(made?.commissionerEmail).toBeUndefined();
    expect(made?.setUpBy).toBe(SET_UP_BY);
    await expectRefused(setMaxTeams(MANAGERS[1], TEST_LEAGUE_TEAMS + 1), refusals.notRunner);
    await setMaxTeams(SET_UP_BY, TEST_LEAGUE_TEAMS + 1);

    const steps = draftSteps(() => ({ t, leagueId }));
    await steps.setSquadSize(2);
    await (await steps.as(SET_UP_BY)).mutation(api.draft.draftStart.start, { leagueId });

    expect((await leagueRow(t, leagueId))?.setUpBy).toBeUndefined();
    await expectRefused(setMaxTeams(SET_UP_BY, TEST_LEAGUE_TEAMS + 2), refusals.notRunner);
    await setMaxTeams(ADMIN, TEST_LEAGUE_TEAMS + 2);
  });

  test("S01.1 the set-up manager can't name a commissioner or delete the league", async () => {
    await expectRefused(
      (await actingAs(t, SET_UP_BY)).mutation(api.leagues.leagues.nameCommissioner, { leagueId, email: MANAGERS[1] }),
      refusals.notNamer,
    );
    await expectRefused((await actingAs(t, SET_UP_BY)).mutation(api.leagues.leagueDeletion.deleteLeague, { leagueId }), refusals.notDeleter);
  });

  test("S01.4 a commissioner veto is saved as a league vote, and stays one until a commissioner changes it", async () => {
    expect(await review()).toBe("vote");
    await changeRules(t, leagueId, rulesWith({ trades: { review: "veto", deadline: null } }), SET_UP_BY);
    expect(await review()).toBe("vote");

    await (await actingAs(t, ADMIN)).mutation(api.leagues.leagues.nameCommissioner, { leagueId, email: COMMISSIONER });
    expect(await review()).toBe("vote");
    expect((await leagueRow(t, leagueId))?.setUpBy).toBeUndefined();
    await changeRules(t, leagueId, rulesWith({ trades: { review: "veto", deadline: null } }));
    expect(await review()).toBe("veto");
  });

  test("S01.2 the commissioner's letters go to every manager", async () => {
    await (await actingAs(t, ADMIN)).mutation(api.leagues.leagueDeletion.deleteLeague, { leagueId });

    for (const email of MANAGERS.slice(0, 3)) {
      expect((await lettersTo(t, email)).map(({ subject }) => subject)).toContain(`${LEAGUE_NAME} is being deleted`);
    }
  });
});
