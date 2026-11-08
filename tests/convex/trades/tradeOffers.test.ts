import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { NOTE_MOST } from "../../../convex/trades/tradeLimits";
import { offerRefusals } from "../../../convex/trades/tradeOffers";
import { refusals } from "../../../convex/shared/leagueAccess";
import { DAY_MS } from "../../../convex/shared/time";
import { actingAs, COMMISSIONER } from "../../support/convex/leagues.harness";
import { nameOf } from "../../support/convex/lineupSquad.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { ANN, ANNS_FIRST_DROP, BOB, CAT, PALMER, RICE, SAKA, tradeLeague, type TradeLeague } from "../../support/convex/trades.harness";

// A trade's offer (#383, spec/08 Trades): any mix of players on either side with a one-line note;
// the other manager accepts, rejects or counters, which closes the old offer; the one who made it
// withdraws it until it is accepted; both managers get a Mail letter at each step.

let w: TradeLeague;
beforeEach(async () => {
  w = await tradeLeague();
});

describe("an offer", () => {
  test("is filed, shown to both managers, and lettered to both, with its note", async () => {
    const { offerId, warnings } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA, PALMER], "Fancy a swap?");

    // Bob's two-man squad goes further under its minimum.
    expect(warnings.map((team) => team.warnings)).toEqual([[], [{ kind: "underMinimum", players: 1, minimum: 11 }]]);
    for (const email of [ANN, BOB]) {
      expect(await w.mine(email)).toEqual([
        expect.objectContaining({
          offerId,
          fromTeamId: w.annsTeam,
          toTeamId: w.bobsTeam,
          gives: [{ playerCode: ANNS_FIRST_DROP, playerName: nameOf(ANNS_FIRST_DROP) }],
          gets: [
            { playerCode: SAKA, playerName: nameOf(SAKA) },
            { playerCode: PALMER, playerName: nameOf(PALMER) },
          ],
          note: "Fancy a swap?",
          review: null,
        }),
      ]);
    }
    expect(await w.mine(CAT)).toEqual([]);
    expect(await w.lettersTo(BOB)).toContainEqual({
      subject: "Team 1 offered Team 2 a trade",
      body: `${ANN} offered Team 2 a trade for Team 1: Team 1 give ${nameOf(ANNS_FIRST_DROP)}; Team 2 give ${nameOf(SAKA)} and ${nameOf(PALMER)}. The note: "Fancy a swap?" Team 2 can accept, reject or counter it; unanswered, it closes at the next deadline.`,
    });
    expect(await w.subjectsTo(ANN)).toContain("Team 1 offered Team 2 a trade");
  });

  test("can give or get nobody on one side", async () => {
    await w.offer(ANN, w.bobsTeam, [], [SAKA]);
    expect(await w.offers()).toHaveLength(1);
  });

  test.each([
    ["no players", [], [], offerRefusals.noPlayers],
    ["a player twice", [ANNS_FIRST_DROP, ANNS_FIRST_DROP], [], offerRefusals.twice],
    ["a player of theirs as his own", [SAKA], [], offerRefusals.notOnTeam(nameOf(SAKA), "Team 1")],
    ["a player not on their team", [], [RICE], offerRefusals.notOnTeam(nameOf(RICE), "Team 2")],
  ])("is refused with %s", async (_, gives, gets, reason) => {
    await expectRefused(w.offer(ANN, w.bobsTeam, gives, gets), reason);
    expect(await w.offers()).toEqual([]);
  });

  test("is refused to his own team, and to anyone who runs no team", async () => {
    await expectRefused(w.offer(ANN, w.annsTeam, [ANNS_FIRST_DROP], []), offerRefusals.sameTeam);
    await expectRefused(w.offer(COMMISSIONER, w.bobsTeam, [], [SAKA]), refusals.runsNoTeam);
  });

  test(`carries a note of one line up to ${NOTE_MOST} characters, blank as none`, async () => {
    await expectRefused(w.offer(ANN, w.bobsTeam, [], [SAKA], "x".repeat(NOTE_MOST + 1)), offerRefusals.noteTooLong);
    await expectRefused(w.offer(ANN, w.bobsTeam, [], [SAKA], "one\ntwo"), offerRefusals.noteOneLine);
    await w.offer(ANN, w.bobsTeam, [], [SAKA], "   ");
    expect((await w.offers())[0].note).toBeUndefined();
  });

  test("warns only of a limit it would push a squad past, newly or further, but is made", async () => {
    const { warnings } = await w.offer(ANN, w.catsTeam, [], [RICE]);
    expect(warnings).toEqual([
      { teamId: w.annsTeam, teamName: "Team 1", warnings: [] },
      { teamId: w.catsTeam, teamName: "Team 3", warnings: [{ kind: "underMinimum", players: 0, minimum: 11 }] },
    ]);
    expect(await w.offers()).toHaveLength(1);
  });

  test("goes to no team on the auto team, nor from one (spec/09)", async () => {
    await (await actingAs(w.t, CAT)).mutation(api.lineup.autoTeam.set, { leagueId: w.leagueId, teamId: w.catsTeam, on: true });
    await expectRefused(w.offer(ANN, w.catsTeam, [], [RICE]), offerRefusals.autoTeam("Team 3"));
    await expectRefused(w.offer(CAT, w.annsTeam, [RICE], []), offerRefusals.autoTeam("Team 3"));
  });
});

describe("answering an offer", () => {
  test("a rejection closes it, with a letter to both saying so", async () => {
    const { offerId } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await w.reject(BOB, offerId);

    expect(await w.offers()).toEqual([]);
    for (const email of [ANN, BOB]) {
      expect(await w.lettersTo(email)).toContainEqual({
        subject: "The trade between Team 1 and Team 2 is closed",
        body: `Team 2 rejected it. The offer was: Team 1 give ${nameOf(ANNS_FIRST_DROP)}; Team 2 give ${nameOf(SAKA)}.`,
      });
    }
  });

  test("only the team it's to answers it", async () => {
    const { offerId } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await expectRefused(w.reject(ANN, offerId), offerRefusals.notYours);
    await expectRefused(w.accept(CAT, offerId), offerRefusals.notYours);
    await expectRefused(w.counter(CAT, offerId, [RICE], []), offerRefusals.notYours);
  });

  test("a counter closes the old offer and makes the changed one, from the other side", async () => {
    const { offerId } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA, PALMER]);
    const countered = await w.counter(BOB, offerId, [SAKA], [ANNS_FIRST_DROP]);

    expect(await w.offers()).toEqual([expect.objectContaining({ _id: countered.offerId, fromTeamId: w.bobsTeam, toTeamId: w.annsTeam, gives: [SAKA], gets: [ANNS_FIRST_DROP] })]);
    expect(await w.lettersTo(ANN)).toContainEqual({
      subject: "Team 2 offered Team 1 a trade",
      body: `${BOB} countered Team 1's offer with this one for Team 2, which closes the old offer: Team 2 give ${nameOf(SAKA)}; Team 1 give ${nameOf(ANNS_FIRST_DROP)}. Team 1 can accept, reject or counter it; unanswered, it closes at the next deadline.`,
    });
    await expectRefused(w.accept(BOB, offerId), offerRefusals.closed);
  });

  test("the manager who made it withdraws it until it's accepted (Craig, 6 Nov 2026), and nobody else can", async () => {
    const { offerId } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await expectRefused(w.withdraw(BOB, offerId), offerRefusals.notYoursToWithdraw);
    await w.withdraw(ANN, offerId);

    expect(await w.offers()).toEqual([]);
    expect(await w.lettersTo(BOB)).toContainEqual(expect.objectContaining({ body: expect.stringMatching(/^Team 1 withdrew it\./) }));

    const accepted = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await w.accept(BOB, accepted.offerId);
    await expectRefused(w.withdraw(ANN, accepted.offerId), offerRefusals.closed);
  });

  test("one nobody answers closes at the next deadline, and can't be accepted after it", async () => {
    const { offerId } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await w.closeDue();
    expect(await w.offers()).toHaveLength(1);

    await w.gameweekEnds(5);
    await expectRefused(w.accept(BOB, offerId), offerRefusals.closed);
    await w.closeDue();
    expect(await w.offers()).toEqual([]);
    expect(await w.lettersTo(BOB)).toContainEqual(expect.objectContaining({ body: expect.stringMatching(/^Nobody answered it by the deadline\./) }));
  });

  test("an offer made a day before a deadline still closes at it", async () => {
    await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await w.t.run(async (ctx) => {
      for (const offer of await ctx.db.query("tradeOffers").collect()) await ctx.db.patch("tradeOffers", offer._id, { madeAt: Date.now() - DAY_MS });
    });
    await w.gameweekEnds(5);
    await w.closeDue();
    expect(await w.offers()).toEqual([]);
  });
});
