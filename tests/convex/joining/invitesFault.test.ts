import { beforeEach, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { putOnTeam } from "../../../convex/leagues/teams";
import { invite, openLastLinkTo } from "../../support/convex/joining.harness";
import { actingAs, adminCreatesLeague, LEAGUE_NAME, managersOf, type TestConvex, ANN } from "../../support/convex/leagues.harness";
import { ask, fakeResend, signInDeployment, type SentEmail } from "../../support/convex/signIn.harness";
import { silenceConsoleError } from "../../support/convex/test.harness";

// A fault while taking up an invite at sign-in (Craig, 12 Nov 2026, on #1437: "Signed in, invite
// kept"): the person is signed in anyway, the invite stays live with nothing of the join written,
// and their leagues page says to open the link again, which then works.

vi.mock("../../../convex/leagues/teams", async (actual) => {
  const teams = await actual<typeof import("../../../convex/leagues/teams")>();
  return { ...teams, putOnTeam: vi.fn(teams.putOnTeam) };
});

const FAULT = "a passing fault";

let t: TestConvex;
let sent: SentEmail[];
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  sent = fakeResend();
  leagueId = await adminCreatesLeague(t);
});

test("signs them in, keeps the invite live with nothing written, says to open the link again, and the next link joins them", async () => {
  const error = silenceConsoleError();
  const put = vi.mocked(putOnTeam);
  const real = put.getMockImplementation()!;
  // The team is made, then the fault: the made team must roll back with the rest of the join.
  put.mockImplementationOnce(async (...args) => {
    await real(...args);
    throw new Error(FAULT);
  });
  const inviteId = await invite(t, leagueId, ANN);

  expect(await openLastLinkTo(t, sent, ANN)).not.toBeNull();
  expect(error).toHaveBeenCalledWith(expect.stringContaining(FAULT));
  expect(await managersOf(t, leagueId)).toEqual([]);
  const kept = await t.run((ctx) => ctx.db.get("invites", inviteId));
  expect(kept).toMatchObject({ joinFailedAt: expect.any(Number) });
  expect(kept?.joined).toBeUndefined();
  expect(kept?.couldNotJoin).toBeUndefined();
  const ann = await actingAs(t, ANN);
  expect(await ann.query(api.joining.endedInvite.mine, { now: Date.now() })).toEqual({ leagueName: LEAGUE_NAME, ended: "joinFailed", reason: null });

  await ask(t, ANN);
  await openLastLinkTo(t, sent, ANN);
  expect((await managersOf(t, leagueId)).map(({ managerEmail }) => managerEmail)).toEqual([ANN]);
  expect(await ann.query(api.joining.endedInvite.mine, { now: Date.now() })).toBeNull();
});
