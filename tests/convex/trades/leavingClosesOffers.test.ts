import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { actingAs, COMMISSIONER, ANN, BOB, CAT, TEAM_1 } from "../../support/convex/leagues.harness";
import { ANNS_FIRST_DROP, PALMER, RICE, SAKA, tradeLeague, type TradeLeague } from "../../support/convex/trades.harness";

// spec/13, Leaving, S13.2 (Craig, 14 Nov 2026, on #2202): a manager removed or leaving mid-season has
// his trade offers, sent and received, cancelled, and the other side gets a Mail letter. The rest of
// S13.2 is tested where it lives: his claims withdrawn in tests/convex/waivers/waiverClaims.test.ts,
// his lineup kept legal by the auto team in tests/convex/lineup/autoTeam.test.ts ("a team with no manager").

let w: TradeLeague;
beforeEach(async () => {
  w = await tradeLeague();
});

test.each(["removed", "leaves"])("a manager %s mid-season: his offers, sent and received, close with a letter to the other side; others stay open (S13.2)", async (how) => {
  await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
  await w.offer(CAT, w.annsTeam, [RICE], []);
  const { offerId: othersOffer } = await w.offer(CAT, w.bobsTeam, [RICE], [PALMER]);
  const leagueId = w.leagueId;
  if (how === "removed") await (await actingAs(w.t, COMMISSIONER)).mutation(api.leagues.teams.removeManager, { leagueId, teamId: w.annsTeam });
  else await (await actingAs(w.t, ANN)).mutation(api.leagues.teams.leave, { leagueId });

  expect((await w.offers()).map(({ _id }) => _id)).toEqual([othersOffer]);
  for (const email of [BOB, CAT]) {
    expect(await w.lettersTo(email)).toContainEqual(expect.objectContaining({ body: expect.stringMatching(new RegExp(`^${TEAM_1} went on the auto team`)) }));
  }
});
