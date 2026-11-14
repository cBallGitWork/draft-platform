import { describe, expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { offerClosedLetter } from "../../../convex/mail/tradeLetterWords";
import { claimWithdrawnLetter } from "../../../convex/mail/waiverLetterWords";
import { playerSoldAbroad } from "../../support/convex/draftLists.harness";
import { BOB, ANN, CAT, TEAM_1, TEAM_2 } from "../../support/convex/leagues.harness";
import { nameOf } from "../../support/convex/lineupSquad.harness";
import { pendingJobs } from "../../support/convex/test.harness";
import { ANNS_FIRST_DROP, PALMER, RICE, SAKA, tradeLeague } from "../../support/convex/trades.harness";
import { waiverLeague } from "../../support/convex/waivers.harness";

// A player who leaves the Premier League, sold abroad say (#2200; Craig, 14 Nov 2026, grill batch
// 2): as the football sync marks him gone, a pending claim for him is withdrawn, its manager told
// (S08.24), and a pending trade holding him, open or in review, is cancelled, both managers told
// by Mail letter (S08.25).

describe("a pending claim for him", () => {
  test("is withdrawn as he goes, and its manager gets a letter saying so; his other claims stay (S08.24)", async () => {
    const w = await waiverLeague();
    await w.onWaivers([SAKA, PALMER]);
    await w.claim(BOB, SAKA);
    await w.claim(BOB, PALMER);
    await w.claim(CAT, SAKA);

    await playerSoldAbroad(w.t, SAKA);

    expect((await w.pending(BOB)).map(({ claim }) => claim.playerCode)).toEqual([PALMER]);
    expect(await w.pending(CAT)).toEqual([]);
    for (const email of [BOB, CAT]) expect(await w.lettersTo(email)).toContainEqual(claimWithdrawnLetter(nameOf(SAKA)));
    expect(claimWithdrawnLetter(nameOf(SAKA)).body).toContain(`${nameOf(SAKA)} has left the Premier League`);
  });
});

describe("a pending trade holding him", () => {
  const cancelled = offerClosedLetter(
    { fromTeamName: TEAM_1, toTeamName: TEAM_2, gives: [nameOf(ANNS_FIRST_DROP)], gets: [nameOf(SAKA)], note: null },
    { why: "leftPremierLeague", playerName: nameOf(SAKA) },
  );

  test("is cancelled while open, both managers told by letter; one without him stays (S08.25)", async () => {
    const w = await tradeLeague();
    await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await w.offer(ANN, w.catsTeam, [ANNS_FIRST_DROP], [RICE]);

    await playerSoldAbroad(w.t, SAKA);

    expect((await w.offers()).map(({ gets }) => gets)).toEqual([[RICE]]);
    for (const email of [ANN, BOB]) expect(await w.lettersTo(email)).toContainEqual(cancelled);
    expect(await w.subjectsTo(CAT)).not.toContain(cancelled.subject);
  });

  test("is cancelled in review too, its review's timer with it (S08.25)", async () => {
    const w = await tradeLeague();
    await w.annTradesForSaka();

    await playerSoldAbroad(w.t, SAKA);

    expect(await w.offers()).toEqual([]);
    expect(await pendingJobs(w.t, internal.trades.tradeReview.finish)).toEqual([]);
    for (const email of [ANN, BOB]) expect(await w.lettersTo(email)).toContainEqual(cancelled);
    expect(await w.squadCodes(w.bobsTeam)).toContain(SAKA);
  });
});
