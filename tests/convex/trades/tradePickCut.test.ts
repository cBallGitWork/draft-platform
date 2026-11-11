import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ARSENAL, insertClubs, insertPlayers, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { changeEveryRules } from "../../support/convex/leagueRules.harness";
import { addManagers, adminCreatesLeague, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { pickOf, pickTradeSteps } from "../../support/convex/trades.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { lettersTo } from "../../support/convex/waivers.harness";

// A pick trade with a pick in a round a squad-size cut removed (#1457): when the draft starts, the
// trade is undone, both picks back with the teams that held them before, and both managers are
// told in Mail (Craig, 11 Nov 2026), so no team ends with more or fewer picks than the rest. A
// later trade on a pick that went back is undone too. `S04.11`

let t: TestConvex;
let leagueId: Id<"leagues">;
let ann: Id<"teams">, bob: Id<"teams">, cat: Id<"teams">;
const [ANN, BOB, CAT] = MANAGERS;

const PLAYERS: HeldPlayer[] = [101, 102, 103].map((code) => ({
  code,
  name: `Player ${code}`,
  fullName: `Player ${code}`,
  clubCode: ARSENAL.code,
  positions: ["CM"],
}));

const { as, start, onTheClock, makePick, teamName } = pickTradeSteps(() => ({ t, leagueId }));
/** `email`'s team trades its `gives` pick to `toTeamId` for `gets`, accepted at once. */
const tradePicks = async (email: string, toEmail: string, toTeamId: Id<"teams">, gives: { round: number; teamId: Id<"teams"> }, gets: { round: number; teamId: Id<"teams"> }) => {
  const { offerId } = await (await as(email)).mutation(api.trades.tradeOffers.offer, { leagueId, toTeamId, gives: [], gets: [], picks: { gives, gets }, note: null });
  await (await as(toEmail)).mutation(api.trades.tradeOffers.accept, { leagueId, offerId });
};
// Squads cut from 2 to 1 after the trades: the draft runs 1 round, so round 2 isn't in it.
const cutToOne = () => changeEveryRules(t, leagueId, (rules) => ({ ...rules, squad: { ...rules.squad, size: { minimum: 1, maximum: 1 } } }));
const tradedPicks = async () => (await t.run((ctx) => ctx.db.query("drafts").first()))?.tradedPicks;
const undoneSubjects = async (email: string) => (await lettersTo(t, email)).map(({ subject }) => subject).filter((subject) => subject.endsWith("is undone"));

beforeEach(async () => {
  vi.useFakeTimers();
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 5);
  [ann, bob, cat] = await addManagers(t, leagueId, [ANN, BOB, CAT]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL]);
    await insertPlayers(ctx, PLAYERS);
  });
  // Squads of 2, so a 2-round draft until the cut, and trades with no review.
  await changeEveryRules(t, leagueId, (rules) => ({
    ...rules,
    squad: { size: { minimum: 1, maximum: 2 }, minimumByArea: null, maxPerClub: null },
    trades: { review: "none", deadline: null },
  }));
});

describe("a squad-size cut below a traded pick's round", () => {
  test("undoes the trade when the draft starts: each team makes its own pick, and both managers are told", async () => {
    await tradePicks(ANN, BOB, bob, pickOf(ann, 1), pickOf(bob, 2));
    await cutToOne();
    await start();

    expect(await tradedPicks()).toEqual([]);
    await makePick(ANN, 101);
    await makePick(BOB, 102);
    await makePick(CAT, 103);
    expect(await onTheClock()).toBeNull();
    const [annsTeam, bobsTeam] = [await teamName(ann), await teamName(bob)];
    for (const email of [ANN, BOB]) {
      expect(await lettersTo(t, email)).toContainEqual({
        subject: `The trade between ${annsTeam} and ${bobsTeam} is undone`,
        body: `The draft has 1 rounds, so the ${bobsTeam} round 2 pick isn't in it. Both picks go back to the teams that held them before the trade. The trade was: ${annsTeam} give the ${annsTeam} round 1 pick; ${bobsTeam} give the ${bobsTeam} round 2 pick.`,
      });
    }
    expect(await undoneSubjects(CAT)).toEqual([]);
  });

  test("undoes a later trade on a pick that went back", async () => {
    await tradePicks(ANN, CAT, cat, pickOf(ann, 1), pickOf(cat, 2));
    // Cat trades on Ann's round-1 pick, which the cut sends back to Ann.
    await tradePicks(CAT, BOB, bob, pickOf(ann, 1), pickOf(bob, 1));
    await cutToOne();
    await start();

    expect(await tradedPicks()).toEqual([]);
    expect(await onTheClock()).toEqual({ pick: 1, teamId: ann });
    const annsTeam = await teamName(ann);
    expect((await lettersTo(t, BOB)).map(({ body }) => body)).toContainEqual(
      expect.stringContaining(`An earlier trade was undone, so the ${annsTeam} round 1 pick went back to the team that held it before.`),
    );
    expect(await undoneSubjects(CAT)).toHaveLength(2);
  });

  test("keeps a trade whose picks are both inside the rounds", async () => {
    await tradePicks(BOB, CAT, cat, pickOf(bob, 1), pickOf(cat, 1));
    await tradePicks(ANN, BOB, bob, pickOf(ann, 2), pickOf(bob, 2));
    await cutToOne();
    await start();

    expect(await tradedPicks()).toEqual([
      { round: 1, teamId: bob, ownerId: cat },
      { round: 1, teamId: cat, ownerId: bob },
    ]);
    await makePick(ANN, 101);
    // Bob's turn is Cat's pick now.
    expect(await onTheClock()).toEqual({ pick: 2, teamId: cat });
    expect(await undoneSubjects(CAT)).toEqual([]);
  });

  test("leaves every trade standing when no round is cut", async () => {
    await tradePicks(ANN, BOB, bob, pickOf(ann, 1), pickOf(bob, 2));
    await start();
    expect(await tradedPicks()).toEqual([
      { round: 1, teamId: ann, ownerId: bob },
      { round: 2, teamId: bob, ownerId: ann },
    ]);
    expect(await undoneSubjects(ANN)).toEqual([]);
  });
});
