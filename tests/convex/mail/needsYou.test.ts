import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import { LATEST_LETTERS } from "../../../convex/mail/mailLimits";
import { MINUTE_MS } from "../../../convex/shared/time";
import { actingAs, ANN, BOB, CAT, COMMISSIONER } from "../../support/convex/leagues.harness";
import { holdPlayers, STARTERS } from "../../support/convex/lineupSquad.harness";
import { ANNS_FIRST_DROP, SAKA, tradeLeague, type TradeLeague } from "../../support/convex/trades.harness";

// Regression BG-205 to BG-211 (#2300): each letter's one link (S16.2), the Needs you and Unread
// views (S16.3) and the deadline letter's words (S16.4), with Craig's answers on #1030 (14 Nov
// 2026): a letter leaves Needs you once nothing waits on him; a deadline letter needs him only for
// an empty slot, or a doubt or an injured player in the eleven; a letter with nothing to do links
// to where its change shows, or has no link.
//
// The trade letters' link is built (#2361), and their place in Needs you (#2443); the deadline
// letter isn't yet (#1030), so its tests are marked expected to fail: once #1030 builds it, each
// fails as passing, and is unmarked then. The
// catalogue puts BG-205, BG-206 and BG-207 in a browser (E2E) and BG-211 in a unit test; neither
// `npm run e2e` (#2288) nor the deadline letter's words exist yet, so each is checked here through
// Mail's own reads.

let w: TradeLeague;
beforeEach(async () => {
  w = await tradeLeague();
  await w.tradesAre({ review: "veto", deadline: null });
});

/** `email`'s letters in the league, newest first, as Mail lists them. */
const mailOf = async (email: string) => (await actingAs(w.t, email)).query(api.mail.mail.letters, { leagueId: w.leagueId });
/** The subjects of `email`'s letters in Needs you, and in Unread. */
const needsYouOf = async (email: string) => (await mailOf(email)).filter((letter) => letter.needsYou).map(({ subject }) => subject);
const unreadOf = async (email: string) => (await mailOf(email)).filter((letter) => !letter.read).map(({ subject }) => subject);
/** `email`'s one letter whose subject matches `subject`. */
const letterAbout = async (email: string, subject: RegExp) => {
  const found = (await mailOf(email)).filter((letter) => subject.test(letter.subject));
  expect(found).toHaveLength(1);
  return found[0];
};
/** `email`'s deadline letter for the next gameweek: a lineup letter. */
const deadlineLetterOf = async (email: string) => {
  const found = (await mailOf(email)).filter((letter) => letter.kind === "lineup");
  expect(found).toHaveLength(1);
  return found[0];
};
/** `code`'s availability, as the feed or the admin set it. */
const playerIs = (code: number, availability: "doubtful" | "out") =>
  w.t.run(async (ctx) => {
    const player = await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", code)).unique();
    await ctx.db.patch("players", player!._id, { availability });
  });

/** Ann offers her first drop for Bob's Saka: an offer letter to Bob. The offer's id. */
const annOffersForSaka = async () => (await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA])).offerId;

describe("each letter ends with one link (S16.2)", () => {
  // Mail opens a letter's `{ offer }` link on Trades with that offer or trade in review selected
  // (src/trades/paths.ts, `offerLink`).
  test("BG-205 S16.2 S08.2: the offer letter links to Trades, the review letter to the trade's panel", async () => {
    const offerId = await annOffersForSaka();
    expect((await letterAbout(BOB, /offered .* a trade$/)).link).toEqual({ offer: offerId });

    await w.accept(BOB, offerId);
    expect((await letterAbout(COMMISSIONER, /^Block the trade/)).link).toEqual({ offer: offerId });
  });

  // A link to the squad isn't built (#1030), so a claim letter has none yet.
  test("BG-206 S16.2: a claim letter with nothing to do links to the squad, or has no link (#1030)", async () => {
    await holdPlayers(w.t, [9100]);
    await w.onWaivers([9100]);
    await w.claim(ANN, 9100);
    await w.runWaivers();

    expect((await letterAbout(ANN, /claimed Player 9100$/)).link).toBeNull();
  });
});

describe("Needs you and Unread (S16.3)", () => {
  test.fails("BG-207 S16.3: Needs you holds the offer and the lineup letter only; Unread holds every unread letter", async () => {
    await annOffersForSaka();
    await holdPlayers(w.t, [9100]);
    await w.onWaivers([9100]);
    await w.claim(CAT, 9100);
    await w.runWaivers();

    const needs = await needsYouOf(BOB);
    expect(needs).toHaveLength(2);
    expect(needs).toContain((await letterAbout(BOB, /offered .* a trade$/)).subject);
    expect(needs).toContain((await deadlineLetterOf(BOB)).subject);
    expect(await unreadOf(BOB)).toContain((await letterAbout(BOB, /claimed Player 9100$/)).subject);
  });

  test("BG-208 S16.3: the offer letter leaves Needs you once it is answered, and stays in All (#1030)", async () => {
    const offerId = await annOffersForSaka();
    const offer = await letterAbout(BOB, /offered .* a trade$/);
    expect(await needsYouOf(BOB)).toContain(offer.subject);

    await w.accept(BOB, offerId);
    expect(await needsYouOf(BOB)).not.toContain(offer.subject);
    expect((await mailOf(BOB)).map(({ subject }) => subject)).toContain(offer.subject);
  });

  test(`S16.3 S12.15: a Mail widget holds the letters in Needs you, past its newest ${LATEST_LETTERS}`, async () => {
    await annOffersForSaka();
    const offer = await letterAbout(BOB, /offered .* a trade$/);
    const commissioner = await actingAs(w.t, COMMISSIONER);
    for (let letter = 0; letter < LATEST_LETTERS; letter += 1) {
      vi.advanceTimersByTime(MINUTE_MS);
      await commissioner.mutation(api.mail.mail.writeToLeague, { leagueId: w.leagueId, subject: `Letter ${letter}`, body: "Hello" });
    }

    const latest = (await (await actingAs(w.t, BOB)).query(api.mail.mail.latest, {}))!;
    expect(latest.letters.map(({ letterId }) => letterId)).not.toContain(offer.letterId);
    expect(latest.needsYou).toEqual([offer]);
  });

  test("BG-210 S16.3: under a veto the trade to review is in the commissioner's Needs you, never the manager's", async () => {
    await w.accept(BOB, await annOffersForSaka());
    const review = await letterAbout(COMMISSIONER, /^Block the trade/);

    expect(await needsYouOf(COMMISSIONER)).toContain(review.subject);
    expect((await needsYouOf(ANN)).filter((subject) => /^Block the trade/.test(subject))).toEqual([]);
  });
});

describe("the deadline letter (S16.4)", () => {
  test.fails("BG-209 S16.3 S16.4: a legal lineup with no doubts isn't in Needs you; one with an injured starter is (#1030)", async () => {
    await playerIs(SAKA, "out");

    expect(await needsYouOf(ANN)).not.toContain((await deadlineLetterOf(ANN)).subject);
    expect(await needsYouOf(BOB)).toContain((await deadlineLetterOf(BOB)).subject);
  });

  test.fails("BG-211 S16.4: with one doubt in the eleven it reads 'Lineup set, 1 doubt in your eleven'", async () => {
    await playerIs(STARTERS[0], "doubtful");

    const letter = await deadlineLetterOf(ANN);
    expect(`${letter.subject} ${letter.body}`).toContain("Lineup set, 1 doubt in your eleven");
  });
});
