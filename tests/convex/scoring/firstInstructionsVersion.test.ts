import { expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { FIRST_INSTRUCTION_SCORING } from "../../../convex/scoring/draftedInstructionScoring";
import { FIRST_ROLE_OWN_STATS, FIRST_ROLES } from "../../../convex/scoring/draftedRoleAdjustments";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { holdSiteScoring, inGameweek, NOTICE, patch, t, TODAY, useSiteScoringDeployment, versions, EDITED } from "../../support/convex/siteScoring.harness";

// The team instructions' first values go into the site's set as the roles' did (#990; Craig, 9 Nov
// 2026: "as roles: into the site's set from the next gameweek that hasn't begun, no letter, changed
// by patch after that").

useSiteScoringDeployment();

const addFirstInstructions = () => t.mutation(internal.scoring.firstInstructionsVersion.addFirstInstructions, {});
const letters = () => t.run(async (ctx) => (await ctx.db.query("letters").collect()).length);

test("they score from the next gameweek not begun, the gameweeks before keeping their set, with no letter", async () => {
  await holdGameweeks(t, { next: 9 });

  expect(await addFirstInstructions()).toEqual({ name: "26_27.1", fromGameweek: 9 });
  expect(await inGameweek(8)).toEqual(FIRST_SCORING);
  expect(await inGameweek(9)).toEqual({ ...FIRST_SCORING, ownStats: FIRST_ROLE_OWN_STATS, instructions: FIRST_INSTRUCTION_SCORING });
  expect(await letters()).toBe(0);
});

test("they are added to the set as it stands, its roles and own stats kept and none held twice, and only once", async () => {
  await holdGameweeks(t, { next: 9 });
  const withRoles = { ...EDITED, ownStats: [...(EDITED.ownStats ?? []), ...FIRST_ROLE_OWN_STATS], roles: [...FIRST_ROLES] };
  await t.run((ctx) => holdSiteScoring(ctx, { scoring: withRoles, kind: "fix", season: 2026, number: 1, at: TODAY - 1 }));

  expect((await addFirstInstructions())?.name).toBe("26_27.2");
  expect(await inGameweek(9)).toEqual({ ...withRoles, instructions: FIRST_INSTRUCTION_SCORING });
  expect(await addFirstInstructions()).toBeNull();
  expect(await versions()).toBe(2);
});

test("while a patch made without them waits to take effect, they aren't added, so it can't drop them", async () => {
  await holdGameweeks(t, { next: 9 });
  await patch(EDITED, TODAY + NOTICE);

  await expect(addFirstInstructions()).rejects.toThrow(/waits to take effect/);
  expect(await versions()).toBe(1);
});
