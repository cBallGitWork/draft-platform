import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { asCommissioner, invitesPage, joinPageAs, lastEmailTo, makeLink, openLastLinkTo } from "../../support/convex/joining.harness";
import { joiningRefusals } from "../../../convex/joining/joining";
import { joinPath } from "../../../convex/joining/joiningShared";
import { refusals } from "../../../convex/shared/leagueAccess";
import { COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, eventsIn, onTheList, type TestConvex } from "../../support/convex/leagues.harness";
import { SITE_URL, UNLISTED, fakeResend, signInDeployment, type SentEmail } from "../../support/convex/signIn.harness";

// A league's invite link (#73 story 2; spec/02, spec/13 Joining): made, replaced and switched
// off, and letting anyone who opens it sign in to ask to join.

const [ANN] = MANAGERS;

let t: TestConvex;
let sent: SentEmail[];
let leagueId: Id<"leagues">;
let token: string;
beforeEach(async () => {
  t = await signInDeployment();
  sent = fakeResend();
  leagueId = await adminCreatesLeague(t, 4);
  token = await makeLink(t, leagueId);
});

const joinPageFor = (email: string, linkToken = token) => joinPageAs(t, email, linkToken);

describe("the invite link", () => {
  test("opened signed in, names the league and lets them ask to join", async () => {
    expect(await joinPageFor(ANN)).toEqual({ leagueName: "Tim Hortons Pro League", standing: "mayAsk" });
  });

  test("lets anyone who opens it sign in, on the list or not, with a link back to it", async () => {
    expect(await t.action(api.joining.inviteLink.signInToJoin, { token, email: UNLISTED })).toBe("checkYourEmail");

    expect(await onTheList(t, UNLISTED)).toBe(true);
    expect(lastEmailTo(sent, UNLISTED).text).toContain(`${SITE_URL}${joinPath(token)}?code=`);
    expect(await openLastLinkTo(t, sent, UNLISTED)).not.toBeNull();
  });

  test("switched off, stops working: its page is gone, and it neither signs anyone in nor takes a request", async () => {
    await (await asCommissioner(t)).mutation(api.joining.inviteLink.switchOff, { leagueId });

    expect(await joinPageFor(ANN)).toBeNull();
    expect(await t.action(api.joining.inviteLink.signInToJoin, { token, email: UNLISTED })).toBe("linkOff");
    expect(await onTheList(t, UNLISTED)).toBe(false);
    await expect((await actingAs(t, ANN)).mutation(api.joining.joinRequests.ask, { token })).rejects.toThrow(joiningRefusals.linkOff);
    expect((await invitesPage(t, leagueId))?.linkToken).toBeNull();
  });

  test("replaced, the old one stops working and the new one works", async () => {
    const newToken = await makeLink(t, leagueId);

    expect(newToken).not.toBe(token);
    expect(await joinPageFor(ANN)).toBeNull();
    expect((await joinPageFor(ANN, newToken))?.standing).toBe("mayAsk");
  });

  test("making, replacing and switching it off are each filed for Mail", async () => {
    await makeLink(t, leagueId);
    await (await asCommissioner(t)).mutation(api.joining.inviteLink.switchOff, { leagueId });
    expect((await eventsIn(t, leagueId)).slice(2)).toEqual([
      { by: COMMISSIONER, kind: "inviteLinkMade", replacedOne: false },
      { by: COMMISSIONER, kind: "inviteLinkMade", replacedOne: true },
      { by: COMMISSIONER, kind: "inviteLinkSwitchedOff" },
    ]);
  });

  test("is made and switched off only by the league's runners", async () => {
    await addManagers(t, leagueId, [ANN]);
    const ann = await actingAs(t, ANN);
    await expect(ann.mutation(api.joining.inviteLink.make, { leagueId })).rejects.toThrow(refusals.notRunner);
    await expect(ann.mutation(api.joining.inviteLink.switchOff, { leagueId })).rejects.toThrow(refusals.notRunner);
  });
});
