import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { nextDeadline } from "../../../convex/trades/tradeScreen";
import { actingAs } from "../../support/convex/leagues.harness";
import { nameOf } from "../../support/convex/lineupSquad.harness";
import { ANN, ANNS_FIRST_DROP, BOB, CAT, SAKA, tradeLeague, type TradeLeague } from "../../support/convex/trades.harness";
import { NEXT } from "../../support/convex/waivers.harness";

// The Trades screen's read (#383; docs/design/approved/trades): the offers to and from the
// manager's team, each with when it closes, who it waits on and the limits it breaks for him, and
// every team's squad to make an offer from, a player held in a trade under review marked.

let w: TradeLeague;
beforeEach(async () => {
  w = await tradeLeague();
  // The trade league's players name clubs it doesn't hold; the screen shows each player's club.
  await w.t.run(async (ctx) => {
    const codes = new Set((await ctx.db.query("players").collect()).map(({ clubCode }) => clubCode));
    for (const code of codes) await ctx.db.insert("clubs", { code, name: `Club ${code}`, shortName: `C${code}` });
  });
});

const viewOf = async (email: string) => (await actingAs(w.t, email)).query(api.trades.tradeScreen.ofMyTeam, { leagueId: w.leagueId, now: Date.now() });

describe("the Trades screen", () => {
  test("puts the manager's own team first, then the rest, each with its squad", async () => {
    const view = await viewOf(BOB);
    expect(view.myTeamId).toBe(w.bobsTeam);
    expect(view.teams[0]).toMatchObject({ teamId: w.bobsTeam, teamName: "Team 2", onAutoTeam: false });
    expect(view.teams[0].players.map(({ code }) => code).sort()).toEqual([SAKA, 9002].sort());
    expect(view.teams.map(({ teamId }) => teamId)).toContain(w.annsTeam);
    expect(view.review).toBe("veto");
    expect(view.shut).toBeNull();
  });

  test("shows an open offer to both managers, closing at the next deadline, reviewed by the commissioner once accepted", async () => {
    const { offerId } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA], "Fancy it?");
    for (const email of [ANN, BOB]) {
      const [offer] = (await viewOf(email)).offers;
      expect(offer).toMatchObject({
        offerId,
        fromTeamName: "Team 1",
        toTeamName: "Team 2",
        gives: [expect.objectContaining({ code: ANNS_FIRST_DROP, name: nameOf(ANNS_FIRST_DROP) })],
        gets: [expect.objectContaining({ code: SAKA, name: nameOf(SAKA) })],
        note: "Fancy it?",
        closes: expect.objectContaining({ gameweek: NEXT }),
        reviewer: "commissioner",
        reviewEndsAt: null,
      });
    }
    expect((await viewOf(CAT)).offers).toEqual([]);
  });

  test("warns the manager of a limit the trade would push his own squad past", async () => {
    await w.offer(ANN, w.bobsTeam, [], [SAKA]);
    expect((await viewOf(BOB)).offers[0].warnings).toEqual([{ kind: "underMinimum", players: 1, minimum: 11 }]);
    expect((await viewOf(ANN)).offers[0].warnings).toEqual([]);
  });

  test("once accepted, shows when its review ends, and holds its players", async () => {
    const { offerId } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await w.accept(BOB, offerId);
    const view = await viewOf(CAT);
    expect(view.teams.find(({ teamId }) => teamId === w.bobsTeam)?.players.find(({ code }) => code === SAKA)?.held).toBe(true);
    const [offer] = (await viewOf(ANN)).offers;
    expect(offer.closes).toBeNull();
    expect(offer.reviewEndsAt).toBeGreaterThan(Date.now());
  });

  test("says why trades are shut", async () => {
    await w.tradesAre({ review: "veto", deadline: NEXT - 1 });
    expect((await viewOf(ANN)).shut).toBe("tradeDeadline");
  });
});

describe("nextDeadline", () => {
  test("is the first deadline after the moment, with its gameweek", () => {
    const deadlines = new Map<number, number | null>([
      [1, 100],
      [2, null],
      [3, 300],
      [4, 200],
    ]);
    expect(nextDeadline(deadlines, 150)).toEqual({ gameweek: 4, at: 200 });
    expect(nextDeadline(deadlines, 300)).toBeNull();
  });
});
