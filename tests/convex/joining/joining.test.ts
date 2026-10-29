import { beforeEach, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import { askToJoin, invite, makeLink, openLastLinkTo } from "../../support/convex/joining.harness";
import { joiningRefusals } from "../../../convex/joining/joining";
import { INVITE_LIFETIME_MS } from "../../../convex/joining/joiningShared";
import { COMMISSIONER, MANAGERS, actingAs, adminCreatesLeague, teamsIn, type TestConvex } from "../../support/convex/leagues.harness";
import { UNLISTED, ask, fakeResend, signInDeployment, type SentEmail } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";

// #73's Done line, end to end: "A league of four fills from two emailed invites and two approved
// link requests; a refused request, an expired invite and a replaced link let no one in."

const [ANN, BOB, CAT, DAN, EVE] = MANAGERS;
const LATE = "late@example.com";

let t: TestConvex;
let sent: SentEmail[];
beforeEach(async () => {
  t = await signInDeployment();
  sent = fakeResend();
});

test("a league of four fills from two invites and two approved requests, and no one else gets in", async () => {
  const leagueId = await adminCreatesLeague(t, 4);
  const commissioner = await actingAs(t, COMMISSIONER);

  // An invite left past its seven days.
  await invite(t, leagueId, LATE);
  vi.advanceTimersByTime(INVITE_LIFETIME_MS + 1);
  await ask(t, LATE);
  await openLastLinkTo(t, sent, LATE);

  for (const email of [ANN, BOB]) {
    await invite(t, leagueId, email);
    await openLastLinkTo(t, sent, email);
  }

  const oldToken = await makeLink(t, leagueId);
  const token = await makeLink(t, leagueId);
  await expectRefused((await actingAs(t, UNLISTED)).mutation(api.joining.joinRequests.ask, { token: oldToken }), joiningRefusals.linkOff);

  for (const email of [CAT, DAN]) {
    const requestId = await askToJoin(t, leagueId, token, email);
    await commissioner.mutation(api.joining.joinRequests.approve, { requestId });
  }
  const refused = await askToJoin(t, leagueId, token, EVE);
  await commissioner.mutation(api.joining.joinRequests.refuseRequest, { requestId: refused });

  expect((await teamsIn(t, leagueId)).map(({ name, managerEmail }) => ({ name, managerEmail }))).toEqual([
    { name: "Team 1", managerEmail: ANN },
    { name: "Team 2", managerEmail: BOB },
    { name: "Team 3", managerEmail: CAT },
    { name: "Team 4", managerEmail: DAN },
  ]);
});
