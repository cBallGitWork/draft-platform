// The links to FPL's codes stored (#1421): the link run after the Premier League's read, its counts,
// the admin's list of what is unlinked (a man only once he has played; Craig, 12 Nov 2026: "Once
// he plays") and the admin's link by hand, which stands (S14.16). The linking itself:
// fplLinks.test.ts.

import { expect, test } from "vitest";
import { internal } from "../../../../convex/_generated/api";
import { SPORTMONKS_STAT_IDS } from "../../../../convex/football/sportmonks/sportmonksStats";
import { bothFeedsHeld as feedsHeldAt } from "../../../support/convex/sportmonks.harness";
import { freshConvex, type TestConvex } from "../../../support/convex/test.harness";
import { CLUB_CODE, PLAYER_CODE } from "../../../support/recorded/fpl.payloads";
import { SM_PL } from "../../../support/recorded/sportmonks.payloads";

const RAN_AT = Date.parse("2026-11-12T06:00:00Z");
const links = internal.football.sportmonks.fplLinksSync;

const bothFeedsHeld = (t: TestConvex) => feedsHeldAt(t, RAN_AT);

/** A live read of the Arsenal v Coventry match in which `playerId` has played `minutes`. */
async function livePlays(t: TestConvex, playerId: number, minutes: number, readAt: number) {
  const man = { playerId, teamId: SM_PL.arsenal, started: false, formationField: null, formationPosition: null, stats: [{ typeId: SPORTMONKS_STAT_IDS.minutes, value: minutes }] };
  const score = { fixtureCode: SM_PL.arsenalCoventry, state: "live" as const, homeGoals: 0, awayGoals: 0, minutes: 80, clockLabel: null };
  await t.mutation(internal.football.sportmonks.sportmonksLive.writeMatch, { score, men: [man], events: [], readAt });
}

test("the link run links every club and match and every man but the two strangers, and counts them", async () => {
  const t = freshConvex();
  await bothFeedsHeld(t);

  expect(await t.mutation(links.link, { ranAt: RAN_AT })).toEqual({
    club: { linked: 7, unlinked: 0 },
    player: { linked: 7, unlinked: 2 },
    match: { linked: 3, unlinked: 0 },
  });
  const saka = await t.run((ctx) => ctx.db.query("sportmonksFplLinks").withIndex("by_kind_and_code", (q) => q.eq("kind", "player").eq("code", SM_PL.saka)).unique());
  expect(saka).toMatchObject({ fplCode: PLAYER_CODE.saka, candidates: [], since: RAN_AT });
});

test("an unlinked man is listed for the admin only from his first Premier League minute; a man who sits the match out is not", async () => {
  const t = freshConvex();
  await bothFeedsHeld(t);
  await t.mutation(links.link, { ranAt: RAN_AT });
  expect(await t.query(links.unlinked, {})).toEqual([]);

  const firstMinute = RAN_AT + 60_000;
  await livePlays(t, SM_PL.wrenfield, 0, RAN_AT);
  expect(await t.query(links.unlinked, {})).toEqual([]);
  await livePlays(t, SM_PL.wrenfield, 1, firstMinute);
  await livePlays(t, SM_PL.wrenfield, 2, firstMinute + 60_000);

  expect(await t.query(links.unlinked, {})).toEqual([{ kind: "player", code: SM_PL.wrenfield, candidates: [], since: RAN_AT, firstPlayedAt: firstMinute }]);
});

test("the admin's link by hand stands through the next link run, and an FPL code another man holds is refused", async () => {
  const t = freshConvex();
  await bothFeedsHeld(t);
  // FPL lists him late, under a name the link can't tie to Sportmonks'.
  const fplCode = 990001;
  await t.mutation(internal.football.footballSync.upsertPlayers, { rows: [{ code: fplCode, name: "Wrenfield", fullName: "Toby Wren-Field", clubCode: CLUB_CODE.arsenal }] });
  await t.mutation(links.link, { ranAt: RAN_AT });

  await t.mutation(links.linkByHand, { kind: "player", code: SM_PL.wrenfield, fplCode });
  await t.mutation(links.link, { ranAt: RAN_AT + 1 });
  const wrenfield = await t.run((ctx) => ctx.db.query("sportmonksFplLinks").withIndex("by_kind_and_code", (q) => q.eq("kind", "player").eq("code", SM_PL.wrenfield)).unique());
  expect(wrenfield).toMatchObject({ fplCode, candidates: [], byHand: true });

  await expect(t.mutation(links.linkByHand, { kind: "player", code: SM_PL.wrenfield, fplCode: PLAYER_CODE.saka })).rejects.toThrow(
    `FPL's player ${PLAYER_CODE.saka} is already Sportmonks' ${SM_PL.saka}`,
  );
  await expect(t.mutation(links.linkByHand, { kind: "player", code: SM_PL.wrenfield, fplCode: 1 })).rejects.toThrow("FPL holds no player with code 1");
});
