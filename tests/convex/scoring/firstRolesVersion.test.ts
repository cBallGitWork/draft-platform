import { expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { FIRST_ROLE_OWN_STATS, FIRST_ROLES } from "../../../convex/scoring/draftedRoleAdjustments";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { EDITED, holdSiteScoring, inGameweek, NOTICE, patch, t, TODAY, useSiteScoringDeployment, versions } from "../../support/convex/siteScoring.harness";

// The roles' first values go into the site's set (#10; Craig, 5 Nov 2026: "taking effect from the
// next gameweek that hasn't begun, with no letter. Later changes go by patch").

useSiteScoringDeployment();

const addFirstRoles = () => t.mutation(internal.scoring.firstRolesVersion.addFirstRoles, {});
const letters = () => t.run(async (ctx) => (await ctx.db.query("letters").collect()).length);

// S05.3
test("they score from the next gameweek not begun, the gameweeks before keeping their set, with no letter", async () => {
  await holdGameweeks(t, { next: 9 });

  expect(await addFirstRoles()).toEqual({ name: "26_27.1", fromGameweek: 9 });
  expect(await inGameweek(8)).toEqual(FIRST_SCORING);
  expect(await inGameweek(9)).toEqual({ ...FIRST_SCORING, ownStats: FIRST_ROLE_OWN_STATS, roles: FIRST_ROLES });
  expect(await letters()).toBe(0);
});

test("they are added to the set as it stands, its rules and own stats kept, and only once", async () => {
  await holdGameweeks(t, { next: 9 });
  await t.run((ctx) => holdSiteScoring(ctx, { scoring: EDITED, kind: "fix", season: 2026, number: 1, at: TODAY - 1 }));

  expect((await addFirstRoles())?.name).toBe("26_27.2");
  expect(await inGameweek(9)).toEqual({ ...EDITED, ownStats: [...(EDITED.ownStats ?? []), ...FIRST_ROLE_OWN_STATS], roles: FIRST_ROLES });
  expect(await addFirstRoles()).toBeNull();
  expect(await versions()).toBe(2);
});

test("while a patch made without them waits to take effect, they aren't added, so it can't drop them", async () => {
  await holdGameweeks(t, { next: 9 });
  await patch(EDITED, TODAY + NOTICE);

  await expect(addFirstRoles()).rejects.toThrow(/waits to take effect/);
  expect(await versions()).toBe(1);
});
