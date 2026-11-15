import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { LetterSummary } from "../../../convex/mail/mail";
import { actingAs, ANN, BOB, CAT, COMMISSIONER } from "../../support/convex/leagues.harness";
import { holdPlayers, STARTERS } from "../../support/convex/lineupSquad.harness";
import { ANNS_FIRST_DROP, SAKA, tradeLeague, type TradeLeague } from "../../support/convex/trades.harness";

// Regression BG-205 to BG-211 (#2300): each letter's one link (S16.2), the Needs you and Unread
// views (S16.3) and the deadline letter's words (S16.4), with Craig's answers on #1030 (14 Nov
// 2026): a letter leaves Needs you once nothing waits on him; a deadline letter needs him only for
// an empty slot, or a doubt or an injured player in the eleven; a letter with nothing to do links
// to where its change shows, or has no link.
//
// None of this is built yet (#1030), so every test here is marked expected to fail: once #1030
// builds it, each fails as passing, and is unmarked then. The catalogue puts BG-205, BG-206 and
// BG-207 in a browser (E2E) and BG-211 in a unit test; neither `npm run e2e` (#2288) nor the deadline
// letter's words exist yet, so each is checked here through Mail's own reads. `linkOf` and
// `needsYou` read the letter where #1030's build is expected to put them, in one place to change.

let w: TradeLeague;
beforeEach(async () => {
  w = await tradeLeague();
  await w.tradesAre({ review: "veto", deadline: null });
});

/** A letter as Mail lists it, with what #1030 adds. */
type Built = LetterSummary & { link?: string | null; needsYou?: boolean };
const linkOf = (letter: LetterSummary) => (letter as Built).link;
const needsYou = (letter: LetterSummary) => (letter as Built).needsYou === true;

/** `email`'s letters in the league, newest first, as Mail lists them. */
const mailOf = async (email: string) => (await actingAs(w.t, email)).query(api.mail.mail.letters, { leagueId: w.leagueId });
/** The subjects of `email`'s letters in Needs you, and in Unread. */
const needsYouOf = async (email: string) => (await mailOf(email)).filter(needsYou).map(({ subject }) => subject);
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
  test.fails("BG-205 S16.2 S08.2: the offer letter links to Trades, the review letter to the trade's panel", async () => {
    const offerId = await annOffersForSaka();
    expect(linkOf(await letterAbout(BOB, /offered .* a trade$/))).toMatch(/^\/trades/);

    await w.accept(BOB, offerId);
    expect(linkOf(await letterAbout(COMMISSIONER, /^Block the trade/))).toMatch(new RegExp(`^/trades.*${offerId}`));
  });

  test.fails("BG-206 S16.2: a claim letter with nothing to do links to the squad, or has no link (#1030)", async () => {
    await holdPlayers(w.t, [9100]);
    await w.onWaivers([9100]);
    await w.claim(ANN, 9100);
    await w.runWaivers();

    const link = linkOf(await letterAbout(ANN, /claimed Player 9100$/));
    expect(link === null || /^\/team\/squad/.test(link ?? "")).toBe(true);
    expect(link).not.toBeUndefined();
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

  test.fails("BG-208 S16.3: the offer letter leaves Needs you once it is answered, and stays in All (#1030)", async () => {
    const offerId = await annOffersForSaka();
    const offer = await letterAbout(BOB, /offered .* a trade$/);
    expect(await needsYouOf(BOB)).toContain(offer.subject);

    await w.accept(BOB, offerId);
    expect(await needsYouOf(BOB)).not.toContain(offer.subject);
    expect((await mailOf(BOB)).map(({ subject }) => subject)).toContain(offer.subject);
  });

  test.fails("BG-210 S16.3: under a veto the trade to review is in the commissioner's Needs you, never the manager's", async () => {
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
