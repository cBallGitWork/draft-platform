import { beforeEach, describe, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";
import { api } from "../../../convex/_generated/api";
import { PL_SEASON_START_YEAR } from "../../../convex/football/football";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { LONDON_ZONE } from "../../../convex/shared/moments";
import { ANN, deletes, leagueWithPeople } from "../../support/convex/leagueDeletion.harness";
import { changesTo, rowsToChange } from "../../support/convex/leagueMutations.harness";
import { COMMISSIONER, OUTSIDER, actingAs, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { holdSiteScoring } from "../../support/convex/siteScoring.harness";
import { publicFunctions } from "../../support/convex/test.harness";
import { ANSWERS_NOTHING, GATES, GATE_REFUSALS, LET_IN, gates, notCalled } from "../../support/convex/publicGates.harness";

// Every public query, mutation and action names who it lets in, and a signed-out caller and a
// signed-in outsider are let in or refused as that gate says (SEC-6). It pins today's gates;
// leagueAccess.test.ts checks, besides, that the refused mutations change nothing.

/** Whoever calls: someone signed in, or the deployment itself when no one is. */
type Caller = Pick<TestConvex, "query" | "mutation" | "action">;

/** The code (a fixture's, a player's, a club's or a gameweek) and the search text and the position the
 *  calls name: whether such a thing exists or not, the call is past its gate. */
const SOME_CODE = 1;
const SOME_TEXT = "Saka";
const SOME_POSITION = "GK";
/** An invite link's token that no league made. */
const NO_SUCH_LINK = "no-such-link";

let t: TestConvex;
let calls: (caller: Caller) => Record<string, () => Promise<unknown>>;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  const leagueId = await leagueWithPeople(t);
  const rows = await rowsToChange(t, leagueId);

  // Opening a letter needs one to ANN, and undoing a deletion a league being deleted.
  await (await actingAs(t, COMMISSIONER)).mutation(api.mail.mail.writeToLeague, { leagueId, subject: "Welcome", body: "Season starts soon." });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const annsLetter = await t.run((ctx) => ctx.db.query("letters").withIndex("by_to_and_at", (q) => q.eq("to", ANN)).first());
  if (!annsLetter) throw new Error(`writing to the league filed no letter to ${ANN}`);
  const beingDeleted = await leagueWithPeople(t, "A league being deleted");
  await deletes(t, COMMISSIONER, beingDeleted);
  // Dismissing a banner needs a version of the site's scoring.
  const versionId = await t.run((ctx) => holdSiteScoring(ctx, { scoring: FIRST_SCORING, kind: "patch", season: PL_SEASON_START_YEAR, number: 1, at: Date.now() }));

  calls = (caller) => {
    const now = Date.now();
    return {
      ...changesTo({ admin: caller, ann: caller, commissioner: caller }, rows),
      "admin/feeds:feeds": () => caller.query(api.admin.feeds.feeds, { now }),
      "auth:isAuthenticated": () => caller.query(api.auth.isAuthenticated, {}),
      "auth:signOut": () => caller.action(api.auth.signOut, {}),
      "feedback/feedback:list": () => caller.query(api.feedback.feedback.list, {}),
      "feedback/feedback:send": () => caller.mutation(api.feedback.feedback.send, { message: "Love it" }),
      "football/matchScores:ofGameweek": () => caller.query(api.football.matchScores.ofGameweek, { gameweek: SOME_CODE }),
      "football/plGameweeks:firstKickoffs": () => caller.query(api.football.plGameweeks.firstKickoffs, {}),
      "football/plStandings:ofSeason": () => caller.query(api.football.plStandings.ofSeason, {}),
      "gameweeks/leagueGameweeks:ofLeague": () => caller.query(api.gameweeks.leagueGameweeks.ofLeague, { leagueId }),
      "home/leagueHome:ofLeague": () => caller.query(api.home.leagueHome.ofLeague, { leagueId, now }),
      "joining/endedInvite:mine": () => caller.query(api.joining.endedInvite.mine, { now }),
      "joining/inviteLink:signInToJoin": () => caller.action(api.joining.inviteLink.signInToJoin, { token: NO_SUCH_LINK, email: OUTSIDER }),
      "joining/invitesPage:page": () => caller.query(api.joining.invitesPage.page, { leagueId }),
      "joining/joinRequests:ask": () => caller.mutation(api.joining.joinRequests.ask, { token: NO_SUCH_LINK }),
      "joining/joinRequests:joinPage": () => caller.query(api.joining.joinRequests.joinPage, { token: NO_SUCH_LINK }),
      "leagues/leagueDeletion:undo": () => caller.mutation(api.leagues.leagueDeletion.undo, { leagueId: beingDeleted }),
      "leagues/leagues:create": () =>
        caller.mutation(api.leagues.leagues.create, { name: "Another league", maxTeams: 4, commissionerEmail: COMMISSIONER }),
      // Its nothing is "not due", so false is read as nothing here alone.
      "lineup/lineupDue:isDue": async () => (await caller.query(api.lineup.lineupDue.isDue, { leagueId, now })) || null,
      "lineup/tactics:ofMyTeam": () => caller.query(api.lineup.tactics.ofMyTeam, { leagueId, now }),
      "mail/mail:latest": () => caller.query(api.mail.mail.latest, {}),
      "mail/mail:letters": () => caller.query(api.mail.mail.letters, {}),
      "mail/mail:open": () => caller.mutation(api.mail.mail.open, { letterId: annsLetter._id }),
      "mail/mail:unreadCount": () => caller.query(api.mail.mail.unreadCount, {}),
      "match/matchPage:ofMatch": () => caller.query(api.match.matchPage.ofMatch, { leagueId, fixtureCode: SOME_CODE }),
      "matchup/matchup:ofTeam": () => caller.query(api.matchup.matchup.ofTeam, { leagueId, now }),
      "playerCard/playerCard:card": () => caller.query(api.playerCard.playerCard.card, { leagueId, playerCode: SOME_CODE, now }),
      "positions/playerPositions:approveClub": () => caller.mutation(api.positions.playerPositions.approveClub, { clubCode: SOME_CODE }),
      "positions/playerPositions:approvePlayer": () => caller.mutation(api.positions.playerPositions.approvePlayer, { code: SOME_CODE }),
      "positions/playerPositions:find": () => caller.query(api.positions.playerPositions.find, { text: SOME_TEXT }),
      "positions/playerPositions:ofPlayer": () => caller.query(api.positions.playerPositions.ofPlayer, { code: SOME_CODE }),
      "positions/playerPositions:queue": () => caller.query(api.positions.playerPositions.queue, {}),
      "positions/playerPositions:removePosition": () =>
        caller.mutation(api.positions.playerPositions.removePosition, { code: SOME_CODE, position: SOME_POSITION }),
      "positions/playerPositions:setPosition": () =>
        caller.mutation(api.positions.playerPositions.setPosition, { code: SOME_CODE, position: SOME_POSITION }),
      "positions/positionSettings:setApproveMode": () => caller.mutation(api.positions.positionSettings.setApproveMode, { approveMode: "proposals" }),
      "positions/positionSettings:setChangeThresholds": () =>
        caller.mutation(api.positions.positionSettings.setChangeThresholds, { flagAfter: 3, removeAfter: 6 }),
      "rules/leagueRules:latest": () => caller.query(api.rules.leagueRules.latest, { leagueId }),
      "rules/leagueSettings:settings": () => caller.query(api.rules.leagueSettings.settings, { leagueId, now }),
      "scoring/patchNotes:banner": () => caller.query(api.scoring.patchNotes.banner, { now }),
      "scoring/patchNotes:dismissBanner": () => caller.mutation(api.scoring.patchNotes.dismissBanner, { versionId }),
      "scoring/patchNotes:notes": () => caller.query(api.scoring.patchNotes.notes, {}),
      "scoring/siteScoring:announce": () => caller.mutation(api.scoring.siteScoring.announce, { draftSavedAt: now, takesEffectAt: now }),
      "scoring/siteScoring:fix": () => caller.mutation(api.scoring.siteScoring.fix, { scoring: FIRST_SCORING, revision: null }),
      "scoring/siteScoring:saveDraft": () =>
        caller.mutation(api.scoring.siteScoring.saveDraft, { scoring: FIRST_SCORING, revision: null, draftSavedAt: null }),
      "scoring/siteScoring:view": () => caller.query(api.scoring.siteScoring.view, { now }),
      "scouting/compare:players": () => caller.query(api.scouting.compare.players, { leagueId, codes: [SOME_CODE] }),
      "scouting/playersList:list": () =>
        caller.query(api.scouting.playersList.list, {
          leagueId,
          filters: { availability: "all", position: null, clubCode: null },
          sort: { by: "name", descending: false },
          stat: null,
        }),
      "scouting/shortlist:mine": () => caller.query(api.scouting.shortlist.mine, { leagueId }),
      "scouting/statRace:teams": () => caller.query(api.scouting.statRace.teams, { leagueId, stat: "goals_scored", descending: true }),
      "signIn/account:signedInAs": () => caller.query(api.signIn.account.signedInAs, {}),
      "signIn/signInLinks:ask": () => caller.action(api.signIn.signInLinks.ask, { email: OUTSIDER }),
      "signIn/timeZone:recordZone": () => caller.mutation(api.signIn.timeZone.recordZone, { zone: LONDON_ZONE }),
      "squads/squads:findPlayers": () => caller.query(api.squads.squads.findPlayers, { leagueId, text: SOME_TEXT }),
      "squads/squads:squads": () => caller.query(api.squads.squads.squads, { leagueId }),
      "squads/teamSquad:ofMyTeam": () => caller.query(api.squads.teamSquad.ofMyTeam, { leagueId, now }),
      "squads/teamTransactions:ofMyTeam": () => caller.query(api.squads.teamTransactions.ofMyTeam, { leagueId }),
      "stars/playerStars:ofPlayer": () => caller.query(api.stars.playerStars.ofPlayer, { leagueId, playerCode: SOME_CODE }),
      "stars/playerStars:ofPlayers": () => caller.query(api.stars.playerStars.ofPlayers, { leagueId, playerCodes: [SOME_CODE] }),
      "table/leagueTable:ofLeague": () => caller.query(api.table.leagueTable.ofLeague, { leagueId }),
      "table/teamFixtures:ofMyTeam": () => caller.query(api.table.teamFixtures.ofMyTeam, { leagueId }),
    };
  };
});

const isNothing = (answer: unknown) =>
  answer === null || answer === 0 || (Array.isArray(answer) && answer.length === 0);

/** What the call got: the gate's refusal, nothing, or let in. */
async function outcomeOf(call: () => Promise<unknown>): Promise<string> {
  try {
    return isNothing(await call()) ? ANSWERS_NOTHING : LET_IN;
  } catch (error) {
    if (!(error instanceof ConvexError)) throw error;
    return GATE_REFUSALS.has(error.data as string) ? (error.data as string) : LET_IN;
  }
}

/** Whether `got` is what the gate said: let in is met by being answered with nothing too. */
const meets = (expected: string, got: string) =>
  got === expected || (expected === LET_IN && got === ANSWERS_NOTHING);

/** The calls that `caller` got other than their gate says, as [name, what it got]. */
async function offGate(caller: Caller, who: "signedOut" | "outsider"): Promise<[string, string][]> {
  const off: [string, string][] = [];
  for (const [name, call] of Object.entries(calls(caller))) {
    const got = await outcomeOf(call);
    if (!meets(GATES[gates[name]][who], got)) off.push([name, got]);
  }
  return off;
}

describe("a public function", () => {
  test("lets in or refuses a signed-out caller as its gate says", async () => {
    expect(await offGate(t, "signedOut")).toEqual([]);
  });

  test("lets in or refuses someone signed in with no part in the league as its gate says", async () => {
    expect(await offGate(await actingAs(t, OUTSIDER), "outsider")).toEqual([]);
  });

  test("every one names its gate and is called: one added later fails here until it is given its row", async () => {
    const names = [...(await publicFunctions()).keys()].sort();
    expect(Object.keys(gates).sort()).toEqual(names.filter((name) => !(name in notCalled)));
    expect(Object.keys(calls(t)).sort()).toEqual(Object.keys(gates).sort());
  });
});
