import { beforeEach, expect, test } from "vitest";
import { eventsIn } from "../../support/convex/leagues.harness";
import { nameOf } from "../../support/convex/lineupSquad.harness";
import { ANN, ANNS_FIRST_DROP, BOB, PALMER, SAKA, tradeLeague, type TradeLeague } from "../../support/convex/trades.harness";

// What a trade that goes through files (#1491): the trade as one `tradeMade`, which the screens
// list, and each of its players as a `playerTraded`, which the squads' history reads; never a
// commissioner's `playerMoved`, which reads as a move he made.

let w: TradeLeague;
beforeEach(async () => {
  w = await tradeLeague();
  await w.tradesAre({ review: "none", deadline: null });
});

test("files the trade as one event, both sides as named then, by whoever accepted it, and no commissioner's move", async () => {
  const { offerId } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA, PALMER]);
  await w.accept(BOB, offerId);

  const events = await eventsIn(w.t, w.leagueId);
  expect(events.filter((event) => event.kind === "playerMoved")).toEqual([]);
  expect(events.filter((event) => event.kind === "tradeMade")).toEqual([
    expect.objectContaining({
      by: BOB,
      fromTeamId: w.annsTeam,
      fromTeamName: "Team 1",
      toTeamId: w.bobsTeam,
      toTeamName: "Team 2",
      gives: { players: [{ playerCode: ANNS_FIRST_DROP, playerName: nameOf(ANNS_FIRST_DROP) }], picks: [] },
      gets: {
        players: [
          { playerCode: SAKA, playerName: nameOf(SAKA) },
          { playerCode: PALMER, playerName: nameOf(PALMER) },
        ],
        picks: [],
      },
    }),
  ]);
  expect(events.flatMap((event) => (event.kind === "playerTraded" ? [event.playerCode] : []))).toEqual([ANNS_FIRST_DROP, SAKA, PALMER]);
});

test("files nothing for a trade that is rejected", async () => {
  const { offerId } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
  await w.reject(BOB, offerId);

  expect((await eventsIn(w.t, w.leagueId)).filter((event) => event.kind === "tradeMade" || event.kind === "playerTraded")).toEqual([]);
});
