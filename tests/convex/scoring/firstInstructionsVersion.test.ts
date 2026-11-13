import { expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { FIRST_INSTRUCTION_SCORING } from "../../../convex/scoring/draftedInstructionScoring";
import { FIRST_ROLE_OWN_STATS, FIRST_ROLES } from "../../../convex/scoring/draftedRoleAdjustments";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { holdSiteScoring, inGameweek, lettersCount, NOTICE, patch, t, TODAY, useSiteScoringDeployment, versions, EDITED } from "../../support/convex/siteScoring.harness";

// The team instructions' first values go into the site's set as the roles' did (#990; Craig, 9 Nov
// 2026: "as roles: into the site's set from the next gameweek that hasn't begun, no letter, changed
// by patch after that").

useSiteScoringDeployment();

const addFirstInstructions = () => t.mutation(internal.scoring.firstInstructionsVersion.addFirstInstructions, {});
const letters = () => lettersCount(t);

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
  await t.run((ctx) => holdSiteScoring(ctx, { scoring: withRoles, kind: "fix", at: TODAY - 1 }));

  expect((await addFirstInstructions())?.name).toBe("26_27.2");
  expect(await inGameweek(9)).toEqual({ ...withRoles, instructions: FIRST_INSTRUCTION_SCORING });
  expect(await addFirstInstructions()).toBeNull();
  expect(await versions()).toBe(2);
});

test("run again on a set that scores some of them, it adds only those it lacks, the rest as the set holds them", async () => {
  await holdGameweeks(t, { next: 9 });
  const [edited, ...others] = FIRST_INSTRUCTION_SCORING.filter(({ instruction }) => instruction !== "keepItTightEarly");
  const held = [{ ...edited, lines: edited.lines.map((line) => ({ ...line, points: line.points * 2 })) }, ...others];
  const before = { ...FIRST_SCORING, ownStats: [...FIRST_ROLE_OWN_STATS], instructions: held };
  await t.run((ctx) => holdSiteScoring(ctx, { scoring: before, kind: "fix", at: TODAY - 1 }));

  expect((await addFirstInstructions())?.name).toBe("26_27.2");
  const tight = FIRST_INSTRUCTION_SCORING.find(({ instruction }) => instruction === "keepItTightEarly");
  expect(await inGameweek(9)).toEqual({ ...before, instructions: [...held, tight] });
  expect(await addFirstInstructions()).toBeNull();
});

const redraw = () => t.mutation(internal.scoring.firstInstructionsVersion.redrawForSportmonks, {});

test("Shoot on sight and Press high take their redrawn lines (#1452), every other instruction as the set holds it, with no letter, and only once", async () => {
  await holdGameweeks(t, { next: 9 });
  const old = (lines: number) => ({ lines: [{ stats: [{ stat: "goals_scored", weight: 1 }], every: 1, points: lines }] });
  const held = FIRST_INSTRUCTION_SCORING.map((each) =>
    each.instruction === "shootOnSight" || each.instruction === "pressHigh" || each.instruction === "getStuckIn" ? { ...each, ...old(2) } : each,
  );
  const before = { ...FIRST_SCORING, ownStats: [...FIRST_ROLE_OWN_STATS], instructions: held };
  await t.run((ctx) => holdSiteScoring(ctx, { scoring: before, kind: "fix", at: TODAY - 1 }));

  expect(await redraw()).toEqual({ name: "26_27.2", fromGameweek: 9 });
  const firstOf = (key: string) => FIRST_INSTRUCTION_SCORING.find(({ instruction }) => instruction === key);
  const after = held.map((each) => (each.instruction === "getStuckIn" ? each : firstOf(each.instruction)));
  expect(await inGameweek(9)).toEqual({ ...before, instructions: after });
  expect(await letters()).toBe(0);
  expect(await redraw()).toBeNull();
  expect(await versions()).toBe(2);
});

test("while a patch made without them waits to take effect, they aren't added, so it can't drop them", async () => {
  await holdGameweeks(t, { next: 9 });
  await patch(EDITED, TODAY + NOTICE);

  await expect(addFirstInstructions()).rejects.toThrow(/waits to take effect/);
  expect(await versions()).toBe(1);
});
