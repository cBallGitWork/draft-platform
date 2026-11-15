import { beforeEach, describe, expect, test } from "vitest";
import { claimFailedLetter } from "../../../convex/mail/waiverLetterWords";
import { offerRefusals } from "../../../convex/trades/tradeOffers";
import { MOST_IN_SQUAD } from "../../../convex/leagues/leagueLimits";
import { ANN, BOB } from "../../support/convex/leagues.harness";
import { holdPlayers, nameOf } from "../../support/convex/lineupSquad.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { ANNS_FIRST_DROP, SAKA, tradeLeague, type TradeLeague } from "../../support/convex/trades.harness";

// Regression BG-091 (#2300): Ann's waiver claim drops a player she has also traded to Bob, the
// trade accepted under a commissioner veto as the run starts. Whichever commits first, the other
// fails: the player is never on two teams, and Ann's squad never goes past the most it may hold.
// Here Ann's first drop plays the catalogue's Rice and player 9100 its Saka.

const CLAIMED = 9100;
const RICE = ANNS_FIRST_DROP;

let w: TradeLeague;
beforeEach(async () => {
  w = await tradeLeague();
  await w.tradesAre({ review: "veto", deadline: null });
  await holdPlayers(w.t, [CLAIMED]);
  await w.onWaivers([CLAIMED]);
  await w.claim(ANN, CLAIMED, RICE);
});

/** The teams holding `code`. */
const teamsHolding = async (code: number) => {
  const holding = [];
  for (const teamId of [w.annsTeam, w.bobsTeam, w.catsTeam]) if ((await w.squadCodes(teamId)).includes(code)) holding.push(teamId);
  return holding;
};

/** Bob offers Saka for Rice; Ann accepts, so the trade goes into the commissioner's review. */
const bobsOffer = () => w.offer(BOB, w.annsTeam, [SAKA], [RICE]);

describe("BG-091: a claim's drop and an accepted trade of the same player both commit (S08.20)", () => {
  test("BG-091 S08.20: the trade accepted first holds Rice, so the claim fails dropHeld and the trade goes through", async () => {
    const before = (await w.squadCodes(w.annsTeam)).length;
    const { offerId } = await bobsOffer();
    await w.accept(ANN, offerId);
    await w.runWaivers();

    expect(await w.lettersTo(ANN)).toContainEqual(claimFailedLetter({ playerName: nameOf(CLAIMED), dropName: nameOf(RICE), why: "dropHeld" }));
    await w.reviewEnds(offerId);
    expect(await teamsHolding(RICE)).toEqual([w.bobsTeam]);
    expect(await teamsHolding(CLAIMED)).toEqual([]);
    expect((await w.squadCodes(w.annsTeam)).length).toBe(before);
  });

  test("BG-091 S08.20: the run first drops Rice, so the offer closes and can't be accepted", async () => {
    const { offerId } = await bobsOffer();
    await w.runWaivers();

    await expectRefused(w.accept(ANN, offerId), offerRefusals.closed);
    expect(await teamsHolding(RICE)).toEqual([]);
    expect(await teamsHolding(CLAIMED)).toEqual([w.annsTeam]);
    expect((await w.squadCodes(w.annsTeam)).length).toBeLessThanOrEqual(MOST_IN_SQUAD);
  });
});
