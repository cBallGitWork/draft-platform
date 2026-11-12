import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { FORM_RESULTS } from "../../../convex/table/standings";
import { refusals } from "../../../convex/shared/leagueAccess";
import { actingAs, addManager, adminCreatesLeague, ANN, OUTSIDER } from "../../support/convex/leagues.harness";
import { syncRun } from "../../support/convex/footballSync.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused, SLOW_TEST } from "../../support/convex/test.harness";
import { recordedResults } from "../../support/recorded/standings.payloads";

// A real club's page (#1936; spec/18, Club pages): its table place, its last five results, its
// next match as an opponent card, and its matches this season, one read per club and league.

/** Coventry, 19th after gameweek 8 in the recording, at home to Sunderland, bottom, in gameweek 9. */
const COVENTRY = 9;
const SUNDERLAND = 56;

async function setUp() {
  const t = await signInDeployment();
  await syncRun(t, recordedResults());
  // After the sync, which fakes the feeds' fetch: the league's letters go by email.
  fakeResend();
  const leagueId = await adminCreatesLeague(t);
  await addManager(t, leagueId, ANN);
  return { t, leagueId };
}

test("a club's page has its place, its last five results, its next match and its season's matches", SLOW_TEST, async () => {
  const { t, leagueId } = await setUp();
  const page = (await (await actingAs(t, ANN)).query(api.football.clubPage.ofClub, { leagueId, clubCode: COVENTRY }))!;

  expect(page.club).toMatchObject({ code: COVENTRY, name: "Coventry City" });
  expect(page.position).toBe(19);
  expect(page.form).toHaveLength(FORM_RESULTS);
  // Every match the club plays, in kickoff order, from its side.
  expect(page.fixtures.length).toBeGreaterThan(30);
  expect(page.fixtures.every(({ opponent }) => opponent.code !== COVENTRY)).toBe(true);
  const played = page.fixtures.filter(({ score }) => score?.state === "fullTime");
  expect(played.map(({ gameweek }) => gameweek)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

  expect(page.next).toMatchObject({ gameweek: 9, atHome: true, opponent: { code: SUNDERLAND }, opponentPosition: 20 });
  expect(page.next!.opponentForm).toHaveLength(FORM_RESULTS);
});

test("a club the football sync doesn't hold has no page; someone outside the league can't read one", SLOW_TEST, async () => {
  const { t, leagueId } = await setUp();
  expect(await (await actingAs(t, ANN)).query(api.football.clubPage.ofClub, { leagueId, clubCode: 999 })).toBeNull();
  await expectRefused((await actingAs(t, OUTSIDER)).query(api.football.clubPage.ofClub, { leagueId, clubCode: COVENTRY }), refusals.notInLeague);
});
