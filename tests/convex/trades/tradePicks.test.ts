import { beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { pickRefusals as draftPickRefusals } from "../../../convex/draft/draftPicks";
import type { TradeRules } from "../../../convex/rules/leagueRulesShape";
import { offerRefusals } from "../../../convex/trades/tradeOffers";
import { pickRefusals } from "../../../convex/trades/tradePicks";
import { REVIEW_MS } from "../../../convex/trades/tradeLimits";
import { ARSENAL, insertClubs, insertPlayers, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { changeEveryRules } from "../../support/convex/leagueRules.harness";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER, eventsIn, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { pickGapPasses } from "../../support/convex/pickWindow.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { lettersTo } from "../../support/convex/waivers.harness";

// Draft picks in trades (spec/04, The picks; #1096): before the draft starts only, one pick for one
// pick and nothing else. A traded pick is a team's pick in a round, not a fixed slot (Craig, 8 Nov
// 2026), so its new owner makes it wherever that team's turn falls. When the draft starts, a pick
// trade still open or in review closes without going through, both managers told why. `S04.2`
// `S04.3` `S04.4`

let t: TestConvex;
let leagueId: Id<"leagues">;
let ann: Id<"teams">, bob: Id<"teams">, cat: Id<"teams">;
const [ANN, BOB, CAT] = MANAGERS;

const PLAYERS: HeldPlayer[] = [101, 102, 103, 104, 105, 106].map((code) => ({
  code,
  name: `Player ${code}`,
  fullName: `Player ${code}`,
  clubCode: ARSENAL.code,
  positions: ["CM"],
}));

const as = (email: string) => actingAs(t, email);
const pickOf = (teamId: Id<"teams">, round: number) => ({ round, teamId });
const offerPicks = async (email: string, toTeamId: Id<"teams">, gives: { round: number; teamId: Id<"teams"> }, gets: { round: number; teamId: Id<"teams"> }, players: number[] = []) =>
  (await as(email)).mutation(api.trades.tradeOffers.offer, { leagueId, toTeamId, gives: players, gets: [], picks: { gives, gets }, note: null });
const accept = async (email: string, offerId: Id<"tradeOffers">) => (await as(email)).mutation(api.trades.tradeOffers.accept, { leagueId, offerId });
const start = async () => (await as(COMMISSIONER)).mutation(api.draft.draftStart.start, { leagueId });
const onTheClock = async () => {
  const draft = await (await as(COMMISSIONER)).query(api.draft.draftStart.ofLeague, { leagueId });
  return draft.status === "live" ? { pick: draft.onTheClock.pick, teamId: draft.onTheClock.teamId } : null;
};
/** `email` picks, and the pick's 10 seconds to undo it pass. */
const makePick = async (email: string, playerCode: number) => {
  await (await as(email)).mutation(api.draft.draftPicks.makePick, { leagueId, playerCode });
  await pickGapPasses(t);
};
const offers = () => t.run((ctx) => ctx.db.query("tradeOffers").collect());
const teamName = async (teamId: Id<"teams">) => (await t.run((ctx) => ctx.db.get("teams", teamId)))!.name;
const tradesAre =(trades: TradeRules) => changeEveryRules(t, leagueId, (rules) => ({ ...rules, trades }));

beforeEach(async () => {
  vi.useFakeTimers();
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 5);
  [ann, bob, cat] = await addManagers(t, leagueId, [ANN, BOB, CAT]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL]);
    await insertPlayers(ctx, PLAYERS);
  });
  // Squads of 2, so a 2-round draft, and trades with no review unless a test says.
  await changeEveryRules(t, leagueId, (rules) => ({
    ...rules,
    squad: { size: { minimum: 1, maximum: 2 }, minimumByArea: null, maxPerClub: null },
    trades: { review: "none", deadline: null },
  }));
});

describe("a pick swap", () => {
  test("changes who is on the clock: each pick is made by the team that holds it now", async () => {
    // Ann's round-1 pick for Bob's round-2 pick. The snake is Ann, Bob, Cat, then Cat, Bob, Ann.
    const { offerId } = await offerPicks(ANN, bob, pickOf(ann, 1), pickOf(bob, 2));
    await accept(BOB, offerId);
    await start();

    expect(await onTheClock()).toEqual({ pick: 1, teamId: bob });
    await expectRefused(makePick(ANN, 101), draftPickRefusals.notYourTurn(await teamName(bob)));
    await makePick(BOB, 101);
    expect(await onTheClock()).toEqual({ pick: 2, teamId: bob });
    await makePick(BOB, 102);
    await makePick(CAT, 103);
    await makePick(CAT, 104);
    // Bob's round-2 turn is Ann's pick now.
    expect(await onTheClock()).toEqual({ pick: 5, teamId: ann });
    await makePick(ANN, 105);
    await makePick(ANN, 106);
    expect(await onTheClock()).toBeNull();
  });

  test("is on the board's read for the whole league, each pick with its team and its owner now", async () => {
    const { offerId } = await offerPicks(ANN, bob, pickOf(ann, 1), pickOf(bob, 2));
    expect((await (await as(CAT)).query(api.draft.draftBoard.ofLeague, { leagueId })).tradedPicks).toEqual([]);
    await accept(BOB, offerId);

    expect((await (await as(CAT)).query(api.draft.draftBoard.ofLeague, { leagueId })).tradedPicks).toEqual([
      { round: 1, teamId: ann, ownerId: bob },
      { round: 2, teamId: bob, ownerId: ann },
    ]);
  });

  test("is on the Trades screen: each team's picks it holds now, held while in review, none once the draft starts", async () => {
    await tradesAre({ review: "veto", deadline: null });
    const picksOn = async (email: string) => {
      const view = await (await as(email)).query(api.trades.tradeScreen.ofMyTeam, { leagueId, now: Date.now() });
      return new Map(view.teams.map((team) => [team.teamId, team.picks.map(({ round, teamId, held }) => ({ round, teamId, held }))]));
    };
    expect((await picksOn(ANN)).get(ann)).toEqual([
      { round: 1, teamId: ann, held: false },
      { round: 2, teamId: ann, held: false },
    ]);
    const { offerId } = await offerPicks(ANN, bob, pickOf(ann, 1), pickOf(bob, 2));
    // The open offer carries its picks for a counter to start with (#1471).
    const open = await (await as(BOB)).query(api.trades.tradeScreen.ofMyTeam, { leagueId, now: Date.now() });
    expect(open.offers[0].pickTerms).toEqual({ gives: pickOf(ann, 1), gets: pickOf(bob, 2) });
    await accept(BOB, offerId);
    const inReview = await picksOn(CAT);
    expect(inReview.get(ann)?.[0]).toEqual({ round: 1, teamId: ann, held: true });
    expect(inReview.get(cat)?.every(({ held }) => !held)).toBe(true);

    vi.setSystemTime(Date.now() + REVIEW_MS);
    await t.mutation(internal.trades.tradeReview.finish, { offerId });
    const after = await picksOn(ANN);
    expect(after.get(ann)).toEqual([
      { round: 2, teamId: ann, held: false },
      { round: 2, teamId: bob, held: false },
    ]);
    expect(after.get(bob)).toEqual([
      { round: 1, teamId: ann, held: false },
      { round: 1, teamId: bob, held: false },
    ]);
    const view = await (await as(ANN)).query(api.trades.tradeScreen.ofMyTeam, { leagueId, now: Date.now() });
    expect(view.teams[0].picks[1].teamName).toBe(await teamName(bob));

    await start();
    expect([...(await picksOn(ANN)).values()].flat()).toEqual([]);
  });

  test("is a team's pick in a round, not a slot: a new order moves it with its team", async () => {
    const { offerId } = await offerPicks(ANN, bob, pickOf(ann, 1), pickOf(bob, 2));
    await accept(BOB, offerId);
    await (await as(COMMISSIONER)).mutation(api.draft.draftOrder.setTeamOrder, { leagueId, teamIds: [cat, ann, bob] });
    await start();

    expect(await onTheClock()).toEqual({ pick: 1, teamId: cat });
    await makePick(CAT, 101);
    // Ann's round-1 turn, now second, is Bob's pick.
    expect(await onTheClock()).toEqual({ pick: 2, teamId: bob });
  });

  test("tells the whole league once it goes through, naming each pick by the team it came from", async () => {
    const { offerId } = await offerPicks(ANN, bob, pickOf(ann, 1), pickOf(bob, 2));
    await accept(BOB, offerId);
    const annsTeam = await teamName(ann);
    const bobsTeam = await teamName(bob);
    expect(await lettersTo(t, CAT)).toContainEqual({
      subject: `${annsTeam} and ${bobsTeam} traded`,
      body: `the ${annsTeam} round 1 pick to ${bobsTeam}; the ${bobsTeam} round 2 pick to ${annsTeam}.`,
    });
  });

  test("is filed as one trade, each pick named by the team whose pick it is, so the screens list it (#1491)", async () => {
    const { offerId } = await offerPicks(ANN, bob, pickOf(ann, 1), pickOf(bob, 2));
    await accept(BOB, offerId);
    expect((await eventsIn(t, leagueId)).filter((event) => event.kind === "tradeMade")).toEqual([
      expect.objectContaining({
        by: BOB,
        fromTeamId: ann,
        toTeamId: bob,
        gives: { players: [], picks: [{ round: 1, teamId: ann, teamName: await teamName(ann) }] },
        gets: { players: [], picks: [{ round: 2, teamId: bob, teamName: await teamName(bob) }] },
      }),
    ]);
  });

  test("can be traded on, and a pick back with its own team is its own again", async () => {
    const first = await offerPicks(ANN, bob, pickOf(ann, 1), pickOf(bob, 1));
    await accept(BOB, first.offerId);
    // Bob gives Ann's round-1 pick back for his own.
    const back = await offerPicks(BOB, ann, pickOf(ann, 1), pickOf(bob, 1));
    await accept(ANN, back.offerId);
    expect((await t.run((ctx) => ctx.db.query("drafts").first()))?.tradedPicks).toEqual([]);
    await start();
    expect(await onTheClock()).toEqual({ pick: 1, teamId: ann });
  });

  test("shows its picks, named, in both managers' offers", async () => {
    await offerPicks(ANN, bob, pickOf(ann, 1), pickOf(bob, 2));
    const annsTeam = await teamName(ann);
    const bobsTeam = await teamName(bob);
    const [shown] = await (await as(BOB)).query(api.trades.tradeOffers.mine, { leagueId });
    expect(shown.picks).toEqual({
      gives: { round: 1, teamId: ann, name: `the ${annsTeam} round 1 pick` },
      gets: { round: 2, teamId: bob, name: `the ${bobsTeam} round 2 pick` },
    });
    expect(shown.gives).toEqual([]);
  });
});

describe("a pick offer is refused", () => {
  test("once the draft has started", async () => {
    await start();
    await expectRefused(offerPicks(ANN, bob, pickOf(ann, 2), pickOf(bob, 2)), offerRefusals.draftLive);
  });

  test("with a player in it too: one pick for one pick, and nothing else", async () => {
    await t.run((ctx) => ctx.db.insert("squadPlayers", { leagueId, teamId: ann, playerCode: 101 }));
    await expectRefused(offerPicks(ANN, bob, pickOf(ann, 1), pickOf(bob, 1), [101]), pickRefusals.pickAndMore);
  });

  test("for a pick its side doesn't hold, or a round the draft doesn't have", async () => {
    const bobsTeam = await teamName(bob);
    const catsTeam = await teamName(cat);
    await expectRefused(offerPicks(ANN, bob, pickOf(cat, 1), pickOf(bob, 1)), pickRefusals.notHeld(`the ${catsTeam} round 1 pick`, await teamName(ann)));
    await expectRefused(offerPicks(ANN, bob, pickOf(ann, 1), pickOf(cat, 1)), pickRefusals.notHeld(`the ${catsTeam} round 1 pick`, bobsTeam));
    await expectRefused(offerPicks(ANN, bob, pickOf(ann, 3), pickOf(bob, 1)), pickRefusals.noRound(2));
  });

  test("while the same pick swap is open to the same team, but a swap of other picks is its own offer (#1539)", async () => {
    await offerPicks(ANN, bob, pickOf(ann, 1), pickOf(bob, 1));
    await expectRefused(offerPicks(ANN, bob, pickOf(ann, 1), pickOf(bob, 1)), offerRefusals.alreadyOffered(await teamName(bob)));
    await offerPicks(ANN, bob, pickOf(ann, 1), pickOf(bob, 2));
    await offerPicks(ANN, bob, pickOf(ann, 2), pickOf(bob, 1));
    expect(await offers()).toHaveLength(3);
  });

  test("to accept while its pick is in another trade under review", async () => {
    await tradesAre({ review: "veto", deadline: null });
    const toBob = await offerPicks(ANN, bob, pickOf(ann, 1), pickOf(bob, 1));
    const toCat = await offerPicks(ANN, cat, pickOf(ann, 1), pickOf(cat, 1));
    await accept(BOB, toBob.offerId);
    const annsTeam = await teamName(ann);
    await expectRefused(accept(CAT, toCat.offerId), pickRefusals.held(`the ${annsTeam} round 1 pick`));
  });
});

describe("closing pick offers", () => {
  test("another open offer holding a traded pick closes, with a letter saying why", async () => {
    const toBob = await offerPicks(ANN, bob, pickOf(ann, 1), pickOf(bob, 1));
    await offerPicks(ANN, cat, pickOf(ann, 1), pickOf(cat, 1));
    await accept(BOB, toBob.offerId);
    expect(await offers()).toEqual([]);
    const annsTeam = await teamName(ann);
    expect((await lettersTo(t, CAT)).map(({ body }) => body)).toContainEqual(expect.stringContaining(`Another trade took the ${annsTeam} round 1 pick.`));
  });

  test("the draft's start closes every pick trade open or in review, unmade, telling both managers", async () => {
    await tradesAre({ review: "veto", deadline: null });
    const inReview = await offerPicks(ANN, bob, pickOf(ann, 1), pickOf(bob, 1));
    await accept(BOB, inReview.offerId);
    await offerPicks(CAT, ann, pickOf(cat, 2), pickOf(ann, 2));
    await start();

    expect(await offers()).toEqual([]);
    for (const email of [ANN, BOB, CAT]) {
      expect((await lettersTo(t, email)).map(({ body }) => body)).toContainEqual(expect.stringContaining("The draft started, and picks are traded only before it."));
    }
    // The review's end finds nothing to make, and every pick stays its own team's.
    vi.setSystemTime(Date.now() + REVIEW_MS);
    await t.mutation(internal.trades.tradeReview.finish, { offerId: inReview.offerId });
    expect(await onTheClock()).toEqual({ pick: 1, teamId: ann });
  });
});
