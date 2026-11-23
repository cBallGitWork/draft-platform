import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { commissionerSubject, steppedDownBody } from "../../../convex/mail/letterWords";
import { refusals } from "../../../convex/shared/leagueAccess";
import {
  ADMIN,
  actingAs,
  COMMISSIONER,
  CO_COMMISSIONER,
  MANAGERS,
  addManager,
  addManagers,
  eventsIn,
  freshLeague,
  leagueRow,
  lettersTo,
  type TestConvex,
} from "../../support/convex/leagues.harness";
import { expectRefused, everyJobRuns } from "../../support/convex/test.harness";

// A commissioner stepping down, and to whom the role passes (spec/01 S01.5; #2659).

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  ({ t, leagueId } = await freshLeague());
});

const stepDown = async (email = COMMISSIONER) => (await actingAs(t, email)).mutation(api.leagues.leagues.stepDown, { leagueId });
const nameCoCommissioner = async () =>
  (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
const commissionerNow = async () => (await leagueRow(t, leagueId))?.commissionerEmail;
const letter = (email: string) => ({ subject: commissionerSubject(email), body: steppedDownBody(COMMISSIONER, email) });

describe("the commissioner stepping down", () => {
  test("S01.5 the co-commissioner takes the role on, leaving no co-commissioner, and the league gets the letter", async () => {
    await addManagers(t, leagueId, [MANAGERS[0]]);
    await nameCoCommissioner();
    await stepDown();
    await everyJobRuns(t);

    const league = await leagueRow(t, leagueId);
    expect(league?.commissionerEmail).toBe(CO_COMMISSIONER);
    expect(league?.coCommissionerEmail).toBeUndefined();
    expect((await eventsIn(t, leagueId)).at(-1)).toEqual({
      by: COMMISSIONER,
      kind: "commissionerSteppedDown",
      email: CO_COMMISSIONER,
      replaced: COMMISSIONER,
    });
    for (const email of [MANAGERS[0], CO_COMMISSIONER, COMMISSIONER]) {
      expect(await lettersTo(t, email)).toContainEqual(letter(CO_COMMISSIONER));
    }
  });

  test("S01.5 with no co-commissioner the manager who joined first takes it on, whatever his team's number, and can hand it on", async () => {
    const [firstTeam] = await addManagers(t, leagueId, [MANAGERS[0]]);
    vi.advanceTimersByTime(1000);
    await addManagers(t, leagueId, [MANAGERS[1]]);
    vi.advanceTimersByTime(1000);
    // Team 1's manager leaves and someone new takes it: he joined last, though his team was made first.
    await (await actingAs(t, MANAGERS[0])).mutation(api.leagues.teams.leave, { leagueId });
    await addManager(t, leagueId, MANAGERS[2], firstTeam);
    await stepDown();

    expect(await commissionerNow()).toBe(MANAGERS[1]);
    expect(await lettersTo(t, MANAGERS[2])).toContainEqual(letter(MANAGERS[1]));
    await expectRefused(stepDown(), refusals.notCommissioner);

    await (await actingAs(t, MANAGERS[1])).mutation(api.leagues.leagues.nameCommissioner, { leagueId, email: MANAGERS[2] });
    expect(await commissionerNow()).toBe(MANAGERS[2]);
  });

  test("S01.5 a commissioner who runs a team passes it to another manager, and with no one to take it on is refused", async () => {
    await addManagers(t, leagueId, [COMMISSIONER]);
    await expectRefused(stepDown(), refusals.noOneToTakeOver);
    expect(await commissionerNow()).toBe(COMMISSIONER);

    vi.advanceTimersByTime(1000);
    await addManagers(t, leagueId, [MANAGERS[0]]);
    await stepDown();
    expect(await commissionerNow()).toBe(MANAGERS[0]);
  });

  test("S01.5 only the commissioner can step down", async () => {
    await addManagers(t, leagueId, [MANAGERS[0]]);
    await nameCoCommissioner();
    for (const email of [CO_COMMISSIONER, MANAGERS[0], ADMIN]) await expectRefused(stepDown(email), refusals.notCommissioner);
    expect(await commissionerNow()).toBe(COMMISSIONER);
  });
});
