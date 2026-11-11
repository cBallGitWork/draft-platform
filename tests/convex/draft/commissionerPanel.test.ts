import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { refusals } from "../../../convex/shared/leagueAccess";
import { SECOND_MS } from "../../../convex/shared/time";
import { changeEveryRules, changeRules, HELD_FIRST_RULES, holdGameweeks, rulesWith } from "../../support/convex/leagueRules.harness";
import { draftSteps } from "../../support/convex/draft.harness";
import { addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The draft room's commissioner panel (#1101; spec/04, The commissioner): what it reads, the pick
// time its box shows and the teams with no manager, and its box before the start, which changes
// League settings' pick time (Craig, 5 Nov 2026, on #1101).

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];
const [ANN, BOB] = MANAGERS;
const PICK_SECONDS = 30;

const { as, read, start, pause } = draftSteps(() => ({ t, leagueId }));
const panel = async (email = COMMISSIONER) => (await as(email)).query(api.draft.draftCommissioner.panel, { leagueId, now: Date.now() });
const setPickTime = async (pickSeconds: number) => (await as(COMMISSIONER)).mutation(api.draft.draftCommissioner.setPickTime, { leagueId, pickSeconds });
const mark = async (teamId: Id<"teams">) => (await as(COMMISSIONER)).mutation(api.draft.draftCommissioner.markForCommissioner, { leagueId, teamId, marked: true });
const leaveTeam = (teamId: Id<"teams">) => t.run((ctx) => ctx.db.patch("teams", teamId, { managerEmail: undefined }));

beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 5);
  teams = await addManagers(t, leagueId, [ANN, BOB]);
  // The squad holds 11, enough for the rules a League settings save checks.
  await changeEveryRules(t, leagueId, (rules) => ({
    ...rules,
    squad: { size: { minimum: 11, maximum: 11 }, minimumByArea: null, maxPerClub: null },
    draft: { ...HELD_FIRST_RULES.draft!, pickSeconds: PICK_SECONDS },
  }));
});

describe("the commissioner panel's read", () => {
  test("holds the league's pick time and the teams with no manager, each marked or not", async () => {
    await leaveTeam(teams[1]);
    await mark(teams[1]);
    const { pickSeconds, unmanaged } = await panel();
    expect(pickSeconds).toBe(PICK_SECONDS);
    expect(unmanaged).toEqual([expect.objectContaining({ teamId: teams[1], marked: true })]);
  });

  test("once the draft has started, holds the draft's own pick time", async () => {
    await start();
    await pause();
    await setPickTime(60);
    expect(await panel()).toMatchObject({ pickSeconds: 60 });
  });

  test("is refused to anyone who doesn't run the league", async () => {
    await expect(panel(ANN)).rejects.toThrow(refusals.notRunner);
  });
});

describe("the pick time before the start", () => {
  test("changes League settings' pick time, which the draft starts on", async () => {
    await setPickTime(60);
    expect(await panel()).toMatchObject({ pickSeconds: 60 });
    await start();
    const startedAt = Date.now();
    expect(await read()).toMatchObject({ clock: { startsAt: startedAt, endsAt: startedAt + 60 * SECOND_MS } });
  });

  test("mid-season, the draft starts on the last pick time and timeout limit typed, not those in force (#1439)", async () => {
    await holdGameweeks(t, { next: 5 });
    const squad = { size: { minimum: 11, maximum: 11 }, minimumByArea: null, maxPerClub: null };
    const draft = { ...HELD_FIRST_RULES.draft!, pickSeconds: 45, timeoutsBeforeAutoPick: 3 };
    expect(await changeRules(t, leagueId, rulesWith({ squad, draft }))).toBe(5);
    expect(await changeRules(t, leagueId, rulesWith({ squad, draft: { ...draft, pickSeconds: 60, timeoutsBeforeAutoPick: 1 } }))).toBe(5);
    await start();
    const startedAt = Date.now();

    expect(await read()).toMatchObject({ clock: { startsAt: startedAt, endsAt: startedAt + 60 * SECOND_MS } });
    expect(await panel()).toMatchObject({ pickSeconds: 60 });
    expect(await (await as(ANN)).query(api.draft.draftBoard.ofLeague, { leagueId })).toMatchObject({ pickSeconds: 60, yourAutoPick: { limit: 1 } });
  });
});
