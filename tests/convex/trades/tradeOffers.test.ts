import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { NOTE_MOST, OFFERS_PER_TEAM_MOST } from "../../../convex/trades/tradeLimits";
import { OFFERS_READ_MOST } from "../../../convex/trades/tradeClose";
import { offerRefusals } from "../../../convex/trades/tradeOffers";
import { refusals } from "../../../convex/shared/leagueAccess";
import { DAY_MS } from "../../../convex/shared/time";
import { WAIVER_MS } from "../../../convex/waivers/waiverLimits";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER, TEST_LEAGUE_TEAMS } from "../../support/convex/leagues.harness";
import { nameOf } from "../../support/convex/lineupSquad.harness";
import { expectRefused, pendingJobs } from "../../support/convex/test.harness";
import { ANN, ANNS_FIRST_DROP, BOB, CAT, PALMER, RICE, SAKA, tradeLeague, type TradeLeague } from "../../support/convex/trades.harness";
import { teamNumbered } from "../../../convex/leagues/teams";

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
    ["a player of theirs as his own", [SAKA], [], offerRefusals.notOnTeam(nameOf(SAKA), teamNumbered(1))],
    ["a player not on their team", [], [RICE], offerRefusals.notOnTeam(nameOf(RICE), teamNumbered(2))],
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
      { teamId: w.annsTeam, teamName: teamNumbered(1), warnings: [] },
      { teamId: w.catsTeam, teamName: teamNumbered(3), warnings: [{ kind: "underMinimum", players: 0, minimum: 11 }] },
    ]);
    expect(await w.offers()).toHaveLength(1);
  });

  test("is refused while the same trade between the same teams is open, whatever its order or note (#1539)", async () => {
    await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA, PALMER], "First go");
    await expectRefused(w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [PALMER, SAKA], "Second go"), offerRefusals.alreadyOffered(teamNumbered(2)));
    expect(await w.offers()).toHaveLength(1);

    // A different trade, or the same one the other way, is an offer of its own.
    await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await w.offer(BOB, w.annsTeam, [SAKA, PALMER], [ANNS_FIRST_DROP]);
    expect(await w.offers()).toHaveLength(3);
  });

  test("can be made again once the same one is closed", async () => {
    const { offerId } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await w.withdraw(ANN, offerId);
    await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    expect(await w.offers()).toHaveLength(1);
  });

  test(`is refused while his team has ${OFFERS_PER_TEAM_MOST} open, until he withdraws one or a deadline closes them (S08.16)`, async () => {
    // Ann's team holds one short of the ceiling, each offering Cat's team the same trade.
    await w.t.run(async (ctx) => {
      for (let each = 1; each < OFFERS_PER_TEAM_MOST; each++) {
        await ctx.db.insert("tradeOffers", { leagueId: w.leagueId, fromTeamId: w.annsTeam, toTeamId: w.catsTeam, gives: [], gets: [RICE], by: ANN, madeAt: Date.now() });
      }
    });
    const { offerId } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await expectRefused(w.offer(ANN, w.bobsTeam, [], [PALMER]), offerRefusals.tooMany);
    // The ceiling is each team's own: Bob still offers Ann's team a trade.
    await w.offer(BOB, w.annsTeam, [PALMER], []);
    await w.withdraw(ANN, offerId);
    await w.offer(ANN, w.bobsTeam, [], [PALMER]);
    await expectRefused(w.offer(ANN, w.bobsTeam, [], [SAKA]), offerRefusals.tooMany);
    // Past a deadline nobody answered them by, they no longer count, the cron yet to close them.
    await w.gameweekEnds(5);
    await w.offer(ANN, w.bobsTeam, [], [SAKA]);
  });

  test("goes to no team on the auto team, nor from one (spec/09)", async () => {
    await (await actingAs(w.t, CAT)).mutation(api.lineup.autoTeam.set, { leagueId: w.leagueId, teamId: w.catsTeam, on: true });
    await expectRefused(w.offer(ANN, w.catsTeam, [], [RICE]), offerRefusals.autoTeam(teamNumbered(3)));
    await expectRefused(w.offer(CAT, w.annsTeam, [RICE], []), offerRefusals.autoTeam(teamNumbered(3)));
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

  test("Continue counts the open offers waiting for his answer, not his own nor one accepted (#1553)", async () => {
    const waiting = async (email: string) => (await actingAs(w.t, email)).query(api.trades.tradeOffers.countWaitingForMe, { leagueId: w.leagueId });
    const toBob = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await w.offer(CAT, w.bobsTeam, [RICE], [PALMER]);
    expect([await waiting(ANN), await waiting(BOB), await waiting(CAT), await waiting(COMMISSIONER)]).toEqual([0, 2, 0, 0]);

    await w.accept(BOB, toBob.offerId);
    expect(await waiting(BOB)).toBe(1);
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

  test(`closes at the deadline however many offers other leagues hold, past ${OFFERS_READ_MOST} between them (#1539)`, async () => {
    await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    // Another league's offers, the platform's count past the cap; the league is gone, so none is due.
    await w.t.run(async (ctx) => {
      const [{ leagueId, fromTeamId, toTeamId, gives, gets, by, madeAt }] = await ctx.db.query("tradeOffers").collect();
      const { name, maxTeams, commissionerEmail } = (await ctx.db.get("leagues", leagueId))!;
      const other = await ctx.db.insert("leagues", { name, maxTeams, commissionerEmail });
      for (let each = 0; each < OFFERS_READ_MOST; each++) {
        await ctx.db.insert("tradeOffers", { leagueId: other, fromTeamId, toTeamId, gives, gets, by, madeAt });
      }
      await ctx.db.delete("leagues", other);
    });
    await w.gameweekEnds(5);
    await w.closeDue();
    expect((await w.offers()).filter((offer) => offer.leagueId === w.leagueId)).toEqual([]);
  });

  test("each league's due offers close in its own transaction, so one league's that can't close holds up no other (#1558)", async () => {
    const other = await adminCreatesLeague(w.t, TEST_LEAGUE_TEAMS, "Another league");
    const [fromTeamId, toTeamId] = await addManagers(w.t, other, ["gone@example.com", "kept@example.com"]);
    await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    // The other league's offer, due at the same deadline, names a team since gone, so it can't be lettered.
    await w.t.run(async (ctx) => {
      const [{ gives, gets, by, madeAt }] = await ctx.db.query("tradeOffers").collect();
      await ctx.db.insert("tradeOffers", { leagueId: other, fromTeamId, toTeamId, gives, gets, by, madeAt });
      await ctx.db.delete("teams", fromTeamId);
    });
    await w.gameweekEnds(5);
    await w.t.mutation(internal.trades.tradeClose.closeDue, {});
    const asked = (await pendingJobs(w.t, internal.trades.tradeClose.closeLeagueDue)).map((job) => job.args[0] as { leagueId: Id<"leagues"> });
    expect(asked.map(({ leagueId }) => leagueId).sort()).toEqual([w.leagueId, other].sort());

    for (const args of asked) {
      const closing = w.t.mutation(internal.trades.tradeClose.closeLeagueDue, args);
      if (args.leagueId === other) await expect(closing).rejects.toThrow("names a team that no longer exists");
      else await closing;
    }
    expect((await w.offers()).map(({ leagueId }) => leagueId)).toEqual([other]);
  });

  test("a league holding no offer isn't asked to close any (#1558)", async () => {
    await w.t.mutation(internal.trades.tradeClose.closeDue, {});
    expect(await pendingJobs(w.t, internal.trades.tradeClose.closeLeagueDue)).toEqual([]);
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

describe("while the draft is live (#1482, S08.7)", () => {
  /** The league's draft given `rounds`: two leave a pick on the clock, none is a draft over. */
  const draftRounds = (rounds: number) =>
    w.t.run(async (ctx) => {
      const draft = await ctx.db.query("drafts").withIndex("by_leagueId", (q) => q.eq("leagueId", w.leagueId)).unique();
      await ctx.db.patch("drafts", draft!._id, { started: { ...draft!.started!, rounds } });
    });

  test("a player offer is refused, and an offer made before it can't be accepted, until the last pick", async () => {
    const { offerId } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await draftRounds(2);
    await expectRefused(w.offer(ANN, w.catsTeam, [], [RICE]), offerRefusals.draftLive);
    await expectRefused(w.accept(BOB, offerId), offerRefusals.draftLive);

    await draftRounds(0);
    await w.offer(ANN, w.catsTeam, [], [RICE]);
    expect(await w.offers()).toHaveLength(2);
  });
});

describe("the churn rule (#1479, S08.6)", () => {
  test("a free agent Ann just picked up, traded to Bob and dropped by him before the deadline, goes on waivers", async () => {
    await w.tradesAre({ review: "none", deadline: null });
    await w.t.run(async (ctx) => {
      const place = await ctx.db.query("squadPlayers").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", w.leagueId).eq("playerCode", ANNS_FIRST_DROP)).unique();
      await ctx.db.patch("squadPlayers", place!._id, { pickedUpAt: Date.now() });
    });
    await w.accept(BOB, (await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [])).offerId);
    await (await actingAs(w.t, BOB)).mutation(api.waivers.waivers.drop, { leagueId: w.leagueId, playerCode: ANNS_FIRST_DROP });

    expect(await w.stateOf(ANNS_FIRST_DROP)).toEqual({ kind: "onWaivers", claimableFrom: Date.now() + WAIVER_MS });
  });
});
