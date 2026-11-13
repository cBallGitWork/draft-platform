import { beforeEach, describe, expect, test } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { DRAFT_LIST_MOST } from "../../../convex/draft/draftLimits";
import { draftListRefusals } from "../../../convex/draft/draftLists";
import { refusals } from "../../../convex/shared/leagueAccess";
import { ODEGAARD, PALMER, SAKA, listsAs, listsLeague, manyPlayers, namesOn as namesIn, playerLeaves } from "../../support/convex/draftLists.harness";
import { UNHELD } from "../../support/convex/footballRows.harness";
import { ADMIN, COMMISSIONER, type TestConvex, ANN, BOB } from "../../support/convex/leagues.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { teamNumbered } from "../../../convex/leagues/teams";

// The shortlist feeding the draft queue (#1137, spec/04 line 46, spec/19 The shortlist): a player
// at a time, or the whole shortlist at the bottom in name order, as many as fit (Craig, 4 Nov 2026).
// Those already queued keep their place, those on the do-not-draft list move off it, and a player
// already on a team never goes in.

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];
beforeEach(async () => {
  ({ t, leagueId, teams } = await listsLeague());
});

const as = (email: string) => listsAs(t, leagueId, email);
const namesOn = (email: string) => namesIn(t, leagueId, email);
/** Ann, with `codes` on her shortlist. */
const annShortlisting = async (codes: number[]) => {
  const ann = await as(ANN);
  for (const code of codes) await ann.shortlist(code);
  return ann;
};

describe("one shortlisted player at a time", () => {
  test("goes to the bottom of the queue", async () => {
    const ann = await annShortlisting([SAKA.code, PALMER.code]);
    await ann.queue(ODEGAARD.code);
    await ann.queueFromShortlist(PALMER.code);
    expect((await namesOn(ANN))?.queue).toEqual(["Ødegaard", "Palmer"]);
  });

  test("one already queued keeps his place", async () => {
    const ann = await annShortlisting([SAKA.code]);
    for (const code of [SAKA.code, PALMER.code]) await ann.queue(code);
    await ann.queueFromShortlist(SAKA.code);
    expect((await namesOn(ANN))?.queue).toEqual(["Saka", "Palmer"]);
  });

  test("refuses a player not on the shortlist, or no such player", async () => {
    const ann = await annShortlisting([SAKA.code]);
    await expectRefused(ann.queueFromShortlist(PALMER.code), draftListRefusals.notShortlisted("Palmer"));
    await expectRefused(ann.queueFromShortlist(UNHELD), refusals.noPlayer);
    expect((await namesOn(ANN))?.queue).toEqual([]);
  });
});

describe("the whole shortlist", () => {
  test("goes to the bottom in name order; those already queued keep their place", async () => {
    const ann = await annShortlisting([SAKA.code, PALMER.code, ODEGAARD.code]);
    await ann.queue(SAKA.code);
    expect(await ann.queueShortlist()).toEqual({ added: 2, leftOut: 0 });
    expect((await namesOn(ANN))?.queue).toEqual(["Saka", "Ødegaard", "Palmer"]);
    expect(await ann.queueShortlist()).toEqual({ added: 0, leftOut: 0 });
    expect((await namesOn(ANN))?.queue).toEqual(["Saka", "Ødegaard", "Palmer"]);
  });

  test(`adds as many as fit under ${DRAFT_LIST_MOST}, by name, and says how many were left out`, async () => {
    const codes = await manyPlayers(t, DRAFT_LIST_MOST - 1);
    await t.run((ctx) => ctx.db.insert("draftLists", { leagueId, teamId: teams[0], queue: codes, doNotDraft: [] }));
    const ann = await annShortlisting([SAKA.code, PALMER.code, ODEGAARD.code]);
    expect(await ann.queueShortlist()).toEqual({ added: 1, leftOut: 2 });
    const queue = (await namesOn(ANN))?.queue;
    expect(queue).toHaveLength(DRAFT_LIST_MOST);
    expect(queue?.at(-1)).toBe("Ødegaard");
    expect(await ann.queueShortlist()).toEqual({ added: 0, leftOut: 2 });
    await expectRefused(ann.queueFromShortlist(SAKA.code), draftListRefusals.full("queue"));
  });
});

describe("either way", () => {
  test("a shortlisted player on the do-not-draft list moves off it", async () => {
    const ann = await annShortlisting([SAKA.code, PALMER.code]);
    for (const code of [SAKA.code, PALMER.code, ODEGAARD.code]) await ann.rule(code);
    await ann.queueFromShortlist(SAKA.code);
    expect(await namesOn(ANN)).toEqual({ queue: ["Saka"], doNotDraft: ["Ødegaard", "Palmer"] });
    await ann.queueShortlist();
    expect(await namesOn(ANN)).toEqual({ queue: ["Saka", "Palmer"], doNotDraft: ["Ødegaard"] });
  });

  test("a player already on a team never goes in: one at a time says he's taken, the whole list skips him", async () => {
    const ann = await annShortlisting([SAKA.code, PALMER.code]);
    await t.run((ctx) => ctx.db.insert("squadPlayers", { leagueId, teamId: teams[1], playerCode: SAKA.code }));
    await expectRefused(ann.queueFromShortlist(SAKA.code), draftListRefusals.taken("Saka", teamNumbered(2)));
    expect(await ann.queueShortlist()).toEqual({ added: 1, leftOut: 0 });
    expect((await namesOn(ANN))?.queue).toEqual(["Palmer"]);
  });

  test("a player who has left the Premier League since he was shortlisted never goes in", async () => {
    const ann = await annShortlisting([SAKA.code, PALMER.code]);
    await playerLeaves(t, SAKA.code);
    await expectRefused(ann.queueFromShortlist(SAKA.code), draftListRefusals.playerGone("Saka"));
    expect(await ann.queueShortlist()).toEqual({ added: 1, leftOut: 0 });
    expect((await namesOn(ANN))?.queue).toEqual(["Palmer"]);
  });

  test("another manager gets nothing: Ann's shortlist feeds only Ann's queue", async () => {
    await annShortlisting([SAKA.code]);
    const bob = await as(BOB);
    expect(await bob.queueShortlist()).toEqual({ added: 0, leftOut: 0 });
    await expectRefused(bob.queueFromShortlist(SAKA.code), draftListRefusals.notShortlisted("Saka"));
    expect(await namesOn(BOB)).toEqual({ queue: [], doNotDraft: [] });
    expect(await namesOn(ANN)).toEqual({ queue: [], doNotDraft: [] });
  });

  test.each([COMMISSIONER, ADMIN])("%s, running no team, can't feed a queue", async (email) => {
    const runner = await as(email);
    await expectRefused(runner.queueShortlist(), refusals.runsNoTeam);
    await expectRefused(runner.queueFromShortlist(SAKA.code), refusals.runsNoTeam);
  });
});
