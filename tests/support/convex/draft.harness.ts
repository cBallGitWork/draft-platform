// The draft tests' shared steps (#1580): the commissioner's start, pause and resume, a manager's
// pick, the draft as the room reads it, and the league's squad size, each in the league `current`
// gives, read at each call, as each test makes its own in `beforeEach`.

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ARSENAL, type Club, type HeldPlayer } from "./footballRows.harness";
import { changeEveryRules, HELD_FIRST_RULES, setPickSeconds } from "./leagueRules.harness";
import { actingAs, COMMISSIONER, type TestConvex } from "./leagues.harness";
import { clockRunsTo } from "./test.harness";
import { SECOND_MS } from "../../../convex/shared/time";

/** The pick clock the held first rules give, in milliseconds. */
export const FIRST_PICK_MS = HELD_FIRST_RULES.draft!.pickSeconds * SECOND_MS;
/** A short pick clock a test sets in place of the first rules' own, and it in milliseconds. */
export const SHORT_PICK_SECONDS = 30;
export const SHORT_PICK_MS = SHORT_PICK_SECONDS * SECOND_MS;

/** A live draft's rounds: more than any test picks, so the draft is still on the clock. */
export const LIVE_DRAFT_ROUNDS = 15;

/** The league's draft row, started now over `rounds` rounds. With none it is over, as no pick is
 *  left on the clock: free agency and waivers wait for that (#1326). */
export const draftStarted = (t: TestConvex, leagueId: Id<"leagues">, teamIds: Id<"teams">[], rounds = 0) =>
  t.run(async (ctx) => {
    await ctx.db.insert("drafts", { leagueId, started: { at: Date.now(), teamIds, rounds } });
  });

/** A central midfielder named for his code, at Arsenal unless a test says. */
export const midfielder = (code: number, club: Club = ARSENAL): HeldPlayer => ({
  code,
  name: `Player ${code}`,
  fullName: `Player ${code}`,
  clubCode: club.code,
  positions: ["CM"],
});

export function draftSteps(current: () => { t: TestConvex; leagueId: Id<"leagues"> }) {
  const as = (email: string) => actingAs(current().t, email);
  const leagueId = () => current().leagueId;
  return {
    as,
    /** The draft as the commissioner's draft room reads it. */
    read: async () => (await as(COMMISSIONER)).query(api.draft.draftStart.ofLeague, { leagueId: leagueId() }),
    /** The commissioner starts the league's draft. */
    start: async () => (await as(COMMISSIONER)).mutation(api.draft.draftStart.start, { leagueId: leagueId() }),
    pause: async (email = COMMISSIONER) => (await as(email)).mutation(api.draft.draftPause.pause, { leagueId: leagueId() }),
    resume: async (email = COMMISSIONER) => (await as(email)).mutation(api.draft.draftPause.resume, { leagueId: leagueId() }),
    /** `email` picks; the 10 seconds to undo it are left to the test. */
    pick: async (email: string, playerCode: number) => (await as(email)).mutation(api.draft.draftPicks.makePick, { leagueId: leagueId(), playerCode }),
    /** The clock moves on `ms`, and every job scheduled by then runs. */
    pass: (ms: number) => clockRunsTo(current().t, Date.now() + ms),
    setPickSeconds: (pickSeconds: number) => setPickSeconds(current().t, leagueId(), pickSeconds),
    /** The squad holds `minimum` to `maximum`, so the draft has `maximum` rounds, with no area or
     *  club limits; at once, in every rules row. */
    setSquadSize: (maximum: number, minimum = 1) =>
      changeEveryRules(current().t, leagueId(), (rules) => ({ ...rules, squad: { size: { minimum, maximum }, minimumByArea: null, maxPerClub: null } })),
  };
}
