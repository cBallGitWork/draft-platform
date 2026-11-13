import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { MOST_IN_SQUAD } from "../../../convex/leagues/leagueLimits";
import { squadFullRefusal } from "../../../convex/trades/tradeSquads";
import { actingAs, eventsIn, ANN, BOB, CAT, TEAM_1, TEAM_2, TEAM_3 } from "../../support/convex/leagues.harness";
import { holdPlayers, nameOf } from "../../support/convex/lineupSquad.harness";
import { expectRefused, silenceConsoleError } from "../../support/convex/test.harness";
import { ANNS_FIRST_DROP, PALMER, RICE, SAKA, tradeLeague, type TradeLeague } from "../../support/convex/trades.harness";

// A trade that can't be made at its review's end closes, with a letter to both managers, rather
// than throw and hold its players for good (#1325): nothing retries a review's end.

let w: TradeLeague;
beforeEach(async () => {
  w = await tradeLeague();
});

const squadOf = (teamId: Id<"teams">) => w.squadCodes(teamId);
/** Fills Ann's squad to `short` below the most in a squad, with players nobody else holds. */
const fillAnnsSquadTo = async (short: number) => {
  const have = (await squadOf(w.annsTeam)).length;
  const extra = Array.from({ length: MOST_IN_SQUAD - short - have }, (_, i) => 9500 + i);
  await holdPlayers(w.t, extra);
  await w.t.run(async (ctx) => {
    for (const playerCode of extra) await ctx.db.insert("squadPlayers", { leagueId: w.leagueId, teamId: w.annsTeam, playerCode });
  });
};

describe("a review's end (#1325)", () => {
  test("two accepted trades each fit alone; the second's review end must not throw or stick", async () => {
    await w.tradesAre({ review: "vote", deadline: null });
    await fillAnnsSquadTo(1);
    const first = await w.offer(BOB, w.annsTeam, [SAKA], []);
    await w.accept(ANN, first.offerId);
    const second = await w.offer(CAT, w.annsTeam, [RICE], []);
    await w.accept(ANN, second.offerId);
    await w.reviewEnds(first.offerId);
    await expect(w.reviewEnds(second.offerId)).resolves.toBeUndefined();

    expect((await w.offers()).map(({ _id }) => _id)).not.toContain(second.offerId);
    expect(await squadOf(w.catsTeam)).toContain(RICE);
    const letter = {
      subject: `The trade between ${TEAM_3} and ${TEAM_1} didn't go through`,
      body: `${TEAM_1} would hold more than ${MOST_IN_SQUAD} players, so nobody moves. The trade was: ${TEAM_3} give ${nameOf(RICE)}; ${TEAM_1} give nobody.`,
    };
    expect(await w.lettersTo(CAT)).toContainEqual(letter);
    expect(await w.lettersTo(ANN)).toContainEqual(letter);
    await (await actingAs(w.t, CAT)).mutation(api.waivers.waivers.drop, { leagueId: w.leagueId, playerCode: RICE });
    expect(await squadOf(w.catsTeam)).not.toContain(RICE);
  });

  test("one that throws part-way moves nobody, closes the trade and tells both managers", async () => {
    const { offerId } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await w.accept(BOB, offerId);
    // Another open offer holding Saka, to a team since gone: closing it, once Saka has moved, throws.
    await w.t.run(async (ctx) => {
      const { _id, _creationTime, review, ...offer } = (await ctx.db.get("tradeOffers", offerId))!;
      const { _id: teamId, _creationTime: made, ...team } = (await ctx.db.get("teams", w.catsTeam))!;
      const goneTeam = await ctx.db.insert("teams", team);
      await ctx.db.delete("teams", goneTeam);
      await ctx.db.insert("tradeOffers", { ...offer, fromTeamId: w.bobsTeam, toTeamId: goneTeam, gives: [SAKA], gets: [] });
    });
    const logged = silenceConsoleError();
    await expect(w.reviewEnds(offerId)).resolves.toBeUndefined();

    expect(logged).toHaveBeenCalledOnce();
    expect((await w.offers()).map(({ _id }) => _id)).not.toContain(offerId);
    expect(await squadOf(w.bobsTeam)).toContain(SAKA);
    expect(await squadOf(w.annsTeam)).toContain(ANNS_FIRST_DROP);
    expect((await eventsIn(w.t, w.leagueId)).filter((event) => event.kind === "playerMoved")).toEqual([]);
    const letter = {
      subject: `The trade between ${TEAM_1} and ${TEAM_2} didn't go through`,
      body: `It couldn't be made, so nobody moves. The trade was: ${TEAM_1} give ${nameOf(ANNS_FIRST_DROP)}; ${TEAM_2} give ${nameOf(SAKA)}.`,
    };
    expect(await w.lettersTo(ANN)).toContainEqual(letter);
    expect(await w.lettersTo(BOB)).toContainEqual(letter);
  });
});

test("with no review, accepting a trade a squad filled meanwhile can't take is still refused to the accepter", async () => {
  await w.tradesAre({ review: "none", deadline: null });
  await fillAnnsSquadTo(1);
  const first = await w.offer(BOB, w.annsTeam, [PALMER], []);
  const second = await w.offer(CAT, w.annsTeam, [RICE], []);
  await w.accept(ANN, first.offerId);
  await expectRefused(w.accept(ANN, second.offerId), squadFullRefusal);

  expect((await w.offers()).map(({ _id }) => _id)).toContain(second.offerId);
  expect(await squadOf(w.catsTeam)).toContain(RICE);
});
