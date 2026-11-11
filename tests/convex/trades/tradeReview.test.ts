import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { claimFailedLetter } from "../../../convex/mail/waiverLetterWords";
import { offerRefusals } from "../../../convex/trades/tradeOffers";
import { REVIEW_MS } from "../../../convex/trades/tradeLimits";
import { mostAgainst, reviewRefusals } from "../../../convex/trades/tradeReview";
import { dropRefusals } from "../../../convex/waivers/waivers";
import { DAY_MS } from "../../../convex/shared/time";
import { actingAs, addManager, COMMISSIONER, CO_COMMISSIONER, eventsIn, MANAGERS } from "../../support/convex/leagues.harness";
import { holdPlayers, nameOf } from "../../support/convex/lineupSquad.harness";
import { expectRefused, pendingJobs } from "../../support/convex/test.harness";
import { ANN, ANNS_FIRST_DROP, BOB, CAT, PALMER, RICE, SAKA, tradeLeague, type TradeLeague } from "../../support/convex/trades.harness";
import { draftOver, noDraft } from "../../support/convex/waivers.harness";

// A trade's review and move (#383, spec/08 Trades): accepted, it goes through at once with no
// review; under a commissioner veto he has 24 hours to block it, and a trade he is in goes to the
// co-commissioner or a league vote; under a vote it is blocked only if most of the managers still
// playing vote against. Through, its players move at once and the league gets the usual letter;
// blocked, the league is told. Its players are held meanwhile.

const DAN = MANAGERS[3];

let w: TradeLeague;
/** The league's fourth team, made when a test gives `email` it: Team 4. Joining shuts once the
 *  draft starts, so it joins as if before the draft, which is over again after. */
let fourthTeam: Id<"teams">;
const fourthTeamTo = async (email: string) => {
  await noDraft(w.t, w.leagueId);
  fourthTeam = await addManager(w.t, w.leagueId, email);
  await draftOver(w.t, w.leagueId, w.teams);
};
beforeEach(async () => {
  w = await tradeLeague();
});

const squadOf = (teamId: Id<"teams">) => w.squadCodes(teamId);
const annTradesForSaka = () => w.annTradesForSaka();

describe("with no review", () => {
  beforeEach(() => w.tradesAre({ review: "none", deadline: null }));

  test("an accepted trade goes through at once: its players move, filed as moves, and the league gets the trade letter", async () => {
    await annTradesForSaka();

    expect(await squadOf(w.annsTeam)).toContain(SAKA);
    expect(await squadOf(w.annsTeam)).not.toContain(ANNS_FIRST_DROP);
    expect(await squadOf(w.bobsTeam)).toEqual(expect.arrayContaining([PALMER, ANNS_FIRST_DROP]));
    expect(await w.offers()).toEqual([]);
    expect((await eventsIn(w.t, w.leagueId)).filter((event) => event.kind === "playerTraded")).toEqual([
      expect.objectContaining({ playerCode: ANNS_FIRST_DROP, teamId: w.bobsTeam, fromTeamId: w.annsTeam, by: BOB }),
      expect.objectContaining({ playerCode: SAKA, teamId: w.annsTeam, fromTeamId: w.bobsTeam, by: BOB }),
    ]);
    const letter = { subject: "Team 1 and Team 2 traded", body: `${nameOf(ANNS_FIRST_DROP)} to Team 2; ${nameOf(SAKA)} to Team 1.` };
    expect(await w.lettersTo(CAT)).toContainEqual(letter);
    expect(await w.lettersTo(COMMISSIONER)).toContainEqual(letter);
  });

  test("the trade letter names a squad it pushed past the league's limits", async () => {
    const { offerId } = await w.offer(CAT, w.annsTeam, [RICE], []);
    await w.accept(ANN, offerId);

    expect(await w.lettersTo(BOB)).toContainEqual({ subject: "Team 3 and Team 1 traded", body: `${nameOf(RICE)} to Team 1; nobody to Team 3. Team 3 is now outside the league's squad limits.` });
  });

  test("closes every other open offer holding one of its players, with a letter to both of its managers", async () => {
    await w.offer(CAT, w.bobsTeam, [RICE], [SAKA]);
    await annTradesForSaka();

    expect(await w.offers()).toEqual([]);
    expect(await w.lettersTo(CAT)).toContainEqual({
      subject: "The trade between Team 3 and Team 2 is closed",
      body: `${nameOf(SAKA)} left Team 2's squad. The offer was: Team 3 give ${nameOf(RICE)}; Team 2 give ${nameOf(SAKA)}.`,
    });
  });
});

describe("under a commissioner veto, a new league's", () => {
  test("an accepted trade waits 24 hours, the commissioner gets a letter to block it, and both managers are told", async () => {
    const offerId = await annTradesForSaka();

    expect(await squadOf(w.annsTeam)).not.toContain(SAKA);
    expect((await w.mine(ANN))[0].review).toEqual({ kind: "veto", endsAt: Date.now() + REVIEW_MS });
    expect(REVIEW_MS).toBe(DAY_MS);
    expect(await w.subjectsTo(COMMISSIONER)).toContain("Block the trade between Team 1 and Team 2?");
    expect(await w.subjectsTo(CAT)).not.toContain("Block the trade between Team 1 and Team 2?");
    expect(await w.subjectsTo(ANN)).toContain("Team 2 accepted Team 1's trade");
    expect(await pendingJobs(w.t, internal.trades.tradeReview.finish)).toHaveLength(1);

    await w.reviewEnds(offerId);
    expect(await squadOf(w.annsTeam)).toContain(SAKA);
    expect(await w.subjectsTo(CAT)).toContain("Team 1 and Team 2 traded");
  });

  test("the commissioner's Block stops it: nobody moves, its timer is cancelled, and the whole league is told", async () => {
    const offerId = await annTradesForSaka();
    await expectRefused(w.block(CAT, offerId), reviewRefusals.notYourBlock);
    await w.block(COMMISSIONER, offerId);

    expect(await squadOf(w.bobsTeam)).toContain(SAKA);
    expect(await w.offers()).toEqual([]);
    expect(await pendingJobs(w.t, internal.trades.tradeReview.finish)).toEqual([]);
    expect(await w.lettersTo(CAT)).toContainEqual({
      subject: "The trade between Team 1 and Team 2 was blocked",
      body: `${COMMISSIONER} blocked it, so nobody moves. The trade was: Team 1 give ${nameOf(ANNS_FIRST_DROP)}; Team 2 give ${nameOf(SAKA)}.`,
    });
    await w.reviewEnds(offerId);
    expect(await squadOf(w.bobsTeam)).toContain(SAKA);
  });

  test("a trade the commissioner is in goes to the co-commissioner", async () => {
    await fourthTeamTo(COMMISSIONER);
    await (await actingAs(w.t, COMMISSIONER)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId: w.leagueId, email: CO_COMMISSIONER });
    const { offerId } = await w.offer(COMMISSIONER, w.bobsTeam, [], [SAKA]);
    await w.accept(BOB, offerId);

    expect(await w.subjectsTo(CO_COMMISSIONER)).toContain("Block the trade between Team 4 and Team 2?");
    await expectRefused(w.block(COMMISSIONER, offerId), reviewRefusals.notYourBlock);
    await w.block(CO_COMMISSIONER, offerId);
    expect(await squadOf(w.bobsTeam)).toContain(SAKA);
  });

  test("a trade the commissioner is in goes to a league vote when there's no co-commissioner", async () => {
    await fourthTeamTo(COMMISSIONER);
    const { offerId } = await w.offer(COMMISSIONER, w.bobsTeam, [], [SAKA]);
    await w.accept(BOB, offerId);

    expect((await w.mine(BOB))[0].review?.kind).toBe("vote");
    expect(await w.subjectsTo(ANN)).toContain("Vote on the trade between Team 4 and Team 2");
  });
});

describe("under a league vote", () => {
  beforeEach(async () => {
    await w.tradesAre({ review: "vote", deadline: null });
    await fourthTeamTo(DAN);
  });

  test("each other manager gets a letter to vote Against, and the two in it don't", async () => {
    await annTradesForSaka();
    for (const email of [CAT, DAN]) expect(await w.subjectsTo(email)).toContain("Vote on the trade between Team 1 and Team 2");
    for (const email of [ANN, BOB, COMMISSIONER]) expect(await w.subjectsTo(email)).not.toContain("Vote on the trade between Team 1 and Team 2");
  });

  test("it goes through unless most vote against: one of two isn't most", async () => {
    const offerId = await annTradesForSaka();
    await w.against(CAT, offerId);
    await expectRefused(w.against(CAT, offerId), reviewRefusals.votedAlready);
    await expectRefused(w.against(ANN, offerId), reviewRefusals.notYourVote);
    await w.reviewEnds(offerId);

    expect(await squadOf(w.annsTeam)).toContain(SAKA);
  });

  test("two of two against blocks it, and the league is told", async () => {
    const offerId = await annTradesForSaka();
    await w.against(CAT, offerId);
    await w.against(DAN, offerId);
    await w.reviewEnds(offerId);

    expect(await squadOf(w.bobsTeam)).toContain(SAKA);
    expect(await w.lettersTo(ANN)).toContainEqual(expect.objectContaining({ body: expect.stringMatching(/^Most of the managers voted against it, so nobody moves\./) }));
  });

  test("an Against can be taken back until the review ends, in case of a typo (Craig, 10 Nov 2026; S08.3)", async () => {
    const offerId = await annTradesForSaka();
    await expectRefused(w.takeBack(CAT, offerId), reviewRefusals.notVoted);
    await w.against(CAT, offerId);
    await w.against(DAN, offerId);
    await w.takeBack(DAN, offerId);
    await expectRefused(w.takeBack(ANN, offerId), reviewRefusals.notYourVote);
    await w.reviewEnds(offerId);

    expect(await squadOf(w.annsTeam)).toContain(SAKA);
    await expectRefused(w.takeBack(CAT, offerId), reviewRefusals.notInReview);
  });

  test("a vote taken back can be cast again", async () => {
    const offerId = await annTradesForSaka();
    await w.against(CAT, offerId);
    await w.takeBack(CAT, offerId);
    await w.against(CAT, offerId);
    await w.against(DAN, offerId);
    await w.reviewEnds(offerId);

    expect(await squadOf(w.bobsTeam)).toContain(SAKA);
  });

  test("a manager on the auto team doesn't vote, and most is of those still playing (31 Oct 2026)", async () => {
    const offerId = await annTradesForSaka();
    await w.against(CAT, offerId);
    await (await actingAs(w.t, DAN)).mutation(api.lineup.autoTeam.set, { leagueId: w.leagueId, teamId: fourthTeam, on: true });
    await expectRefused(w.against(DAN, offerId), reviewRefusals.notYourVote);
    await w.reviewEnds(offerId);

    expect(await squadOf(w.bobsTeam)).toContain(SAKA);
  });

  test("most is more than half of those who may vote", () => {
    expect(mostAgainst(["a", "b"], ["a"])).toBe(false);
    expect(mostAgainst(["a", "b", "c"], ["a", "b"])).toBe(true);
    expect(mostAgainst([], [])).toBe(false);
    expect(mostAgainst(["a"], ["a", "gone"])).toBe(true);
  });
});

describe("players held in review (Craig, 6 Nov 2026)", () => {
  test("can't be dropped, nor taken by another accepted trade", async () => {
    await annTradesForSaka();
    await expectRefused((await actingAs(w.t, BOB)).mutation(api.waivers.waivers.drop, { leagueId: w.leagueId, playerCode: SAKA }), dropRefusals.held(nameOf(SAKA)));

    const second = await w.offer(CAT, w.bobsTeam, [RICE], [SAKA]);
    await expectRefused(w.accept(BOB, second.offerId), offerRefusals.held(nameOf(SAKA)));
  });

  test("a claim naming one as its drop fails at the run, saying why", async () => {
    await annTradesForSaka();
    await holdPlayers(w.t, [9100]);
    await w.onWaivers([9100]);
    await w.claim(BOB, 9100, SAKA);
    await w.runWaivers();

    expect(await w.lettersTo(BOB)).toContainEqual(claimFailedLetter({ playerName: nameOf(9100), dropName: nameOf(SAKA), why: "dropHeld" }));
    expect(await squadOf(w.bobsTeam)).toContain(SAKA);
  });

  test("a trade in review whose player the commissioner moved meanwhile doesn't go through, and both managers are told", async () => {
    const offerId = await annTradesForSaka();
    await (await actingAs(w.t, COMMISSIONER)).mutation(api.squads.squads.move, { leagueId: w.leagueId, playerCode: SAKA, teamId: w.catsTeam });
    await w.reviewEnds(offerId);

    expect(await squadOf(w.catsTeam)).toContain(SAKA);
    expect(await squadOf(w.annsTeam)).toContain(ANNS_FIRST_DROP);
    expect(await w.subjectsTo(ANN)).toContain("The trade between Team 1 and Team 2 didn't go through");
  });
});

describe("open offers close", () => {
  test("the moment one of its players leaves his squad, with a letter to both managers", async () => {
    await w.offer(CAT, w.bobsTeam, [RICE], [SAKA]);
    await (await actingAs(w.t, BOB)).mutation(api.waivers.waivers.drop, { leagueId: w.leagueId, playerCode: SAKA });

    expect(await w.offers()).toEqual([]);
    expect(await w.lettersTo(CAT)).toContainEqual(expect.objectContaining({ body: expect.stringMatching(new RegExp(`^${nameOf(SAKA)} left Team 2's squad\\.`)) }));
  });

  test("when a team in it goes on the auto team, but a trade in review finishes it", async () => {
    await w.tradesAre({ review: "veto", deadline: null });
    await w.offer(CAT, w.bobsTeam, [RICE], [PALMER]);
    const inReview = await annTradesForSaka();
    await (await actingAs(w.t, BOB)).mutation(api.lineup.autoTeam.set, { leagueId: w.leagueId, teamId: w.bobsTeam, on: true });

    expect((await w.offers()).map(({ _id }) => _id)).toEqual([inReview]);
    expect(await w.lettersTo(CAT)).toContainEqual(expect.objectContaining({ body: expect.stringMatching(/^Team 2 went on the auto team/) }));
    await w.reviewEnds(inReview);
    expect(await squadOf(w.annsTeam)).toContain(SAKA);
  });

  test("once the trade deadline's gameweek is over, and no trade is offered after; a trade in review finishes it", async () => {
    await w.tradesAre({ review: "veto", deadline: 5 });
    await w.gameweekEnds(5);
    await w.matchIs(5, "live");
    const inReview = await annTradesForSaka();
    await w.offer(CAT, w.bobsTeam, [RICE], [PALMER]);
    await w.matchIs(5, "fullTime");
    await w.closeDue();

    expect((await w.offers()).map(({ _id }) => _id)).toEqual([inReview]);
    expect(await w.lettersTo(CAT)).toContainEqual(expect.objectContaining({ body: expect.stringMatching(/^The league's trade deadline has passed\./) }));
    await expectRefused(w.offer(CAT, w.bobsTeam, [RICE], [PALMER]), offerRefusals.tradeDeadline);
    await w.reviewEnds(inReview);
    expect(await squadOf(w.annsTeam)).toContain(SAKA);
  });

  test("trades go on through the trade deadline's gameweek until its last match is over", async () => {
    await w.tradesAre({ review: "none", deadline: 5 });
    await w.gameweekEnds(5);
    await w.matchIs(5, "live");
    await w.offer(CAT, w.bobsTeam, [RICE], [PALMER]);
    expect(await w.offers()).toHaveLength(1);
  });

  test("through a gameweek the league doesn't play, from its deadline until its last match is over (spec/13)", async () => {
    await (await actingAs(w.t, COMMISSIONER)).mutation(api.gameweeks.leagueGameweeks.setUsed, { leagueId: w.leagueId, gameweek: 5, used: false });
    await w.gameweekEnds(5);
    await w.matchIs(5, "live");
    await expectRefused(w.offer(CAT, w.bobsTeam, [RICE], [PALMER]), offerRefusals.unusedGameweek);

    await w.matchIs(5, "fullTime");
    await w.offer(CAT, w.bobsTeam, [RICE], [PALMER]);
    expect(await w.offers()).toHaveLength(1);
  });
});
