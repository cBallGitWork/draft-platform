import { beforeEach, describe, expect, test } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { DRAFT_LIST_MOST } from "../../../convex/draft/draftLimits";
import { api } from "../../../convex/_generated/api";
import { draftListRefusals, listsOf } from "../../../convex/draft/draftLists";
import { refusals } from "../../../convex/shared/leagueAccess";
import { draftStarted, LIVE_DRAFT_ROUNDS } from "../../support/convex/draft.harness";
import { ANN, BOB, ODEGAARD, PALMER, SAKA, listsAs, listsLeague, manyPlayers, namesOn as namesIn, playerLeaves } from "../../support/convex/draftLists.harness";
import { ARSENAL, CHELSEA, GONE, UNHELD } from "../../support/convex/footballRows.harness";
import { ADMIN, COMMISSIONER, MANAGERS, actingAs, addManager, addManagers, adminCreatesLeague, TEST_LEAGUE_TEAMS, type TestConvex } from "../../support/convex/leagues.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { teamNumbered } from "../../../convex/leagues/teams";

// A manager's draft queue and do-not-draft list (#1092, spec/04 The queue and the ranking): the
// team's, private to it, no player on both, 250 each, and changeable between picks once the draft
// has started, a drafted player staying listed. The shortlist feeding the queue: shortlistQueue.test.ts.

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];
beforeEach(async () => {
  ({ t, leagueId, teams } = await listsLeague());
});

const as = (email: string, league = leagueId) => listsAs(t, league, email);
const namesOn = (email: string, league = leagueId) => namesIn(t, league, email);

describe("a manager's own queue", () => {
  test("starts empty, as does his do-not-draft list", async () => {
    expect(await namesOn(ANN)).toEqual({ queue: [], doNotDraft: [] });
  });

  test("a player added goes to the bottom, with his club and who owns him", async () => {
    await t.run((ctx) => ctx.db.insert("squadPlayers", { leagueId, teamId: teams[1], playerCode: PALMER.code }));
    const ann = await as(ANN);
    await ann.queue(SAKA.code);
    await ann.queue(PALMER.code);
    expect((await ann.mine())?.queue).toEqual([
      { code: SAKA.code, name: "Saka", fullName: "Bukayo Saka", club: ARSENAL, ownerTeamName: null, gone: false, position: null },
      { code: PALMER.code, name: "Palmer", fullName: "Cole Palmer", club: CHELSEA, ownerTeamName: teamNumbered(2), gone: false, position: null },
    ]);
  });

  test("a player added twice keeps his first place", async () => {
    const ann = await as(ANN);
    for (const code of [SAKA.code, PALMER.code, SAKA.code]) await ann.queue(code);
    expect((await namesOn(ANN))?.queue).toEqual(["Saka", "Palmer"]);
  });

  test("is reordered by moving a player to a place, the rest shifting", async () => {
    const ann = await as(ANN);
    for (const code of [SAKA.code, PALMER.code, ODEGAARD.code]) await ann.queue(code);
    await ann.move(ODEGAARD.code, 1);
    expect((await namesOn(ANN))?.queue).toEqual(["Ødegaard", "Saka", "Palmer"]);
    await ann.move(ODEGAARD.code, 3);
    expect((await namesOn(ANN))?.queue).toEqual(["Saka", "Palmer", "Ødegaard"]);
    await ann.move(PALMER.code, 2);
    expect((await namesOn(ANN))?.queue).toEqual(["Saka", "Palmer", "Ødegaard"]);
  });

  test.each([0, 3, 1.5])("refuses a move to place %s, which isn't in it", async (place) => {
    const ann = await as(ANN);
    for (const code of [SAKA.code, PALMER.code]) await ann.queue(code);
    await expectRefused(ann.move(SAKA.code, place), draftListRefusals.noPlace(2));
    expect((await namesOn(ANN))?.queue).toEqual(["Saka", "Palmer"]);
  });

  test("refuses moving a player not in it", async () => {
    const ann = await as(ANN);
    await expectRefused(ann.move(SAKA.code, 1), draftListRefusals.notQueued("Saka"));
    await ann.queue(PALMER.code);
    await expectRefused(ann.move(SAKA.code, 1), draftListRefusals.notQueued("Saka"));
    await expectRefused(ann.move(UNHELD, 1), refusals.noPlayer);
  });

  test("a player removed is off it, the rest keeping their order; removing one not on it changes nothing", async () => {
    const ann = await as(ANN);
    for (const code of [SAKA.code, PALMER.code, ODEGAARD.code]) await ann.queue(code);
    await ann.unqueue(PALMER.code);
    await ann.unqueue(PALMER.code);
    expect((await namesOn(ANN))?.queue).toEqual(["Saka", "Ødegaard"]);
  });
});

describe("a manager's own do-not-draft list", () => {
  test("holds the players added, by name; one removed is off it", async () => {
    const ann = await as(ANN);
    for (const code of [SAKA.code, PALMER.code, PALMER.code]) await ann.rule(code);
    expect((await namesOn(ANN))?.doNotDraft).toEqual(["Palmer", "Saka"]);
    await ann.unrule(SAKA.code);
    await ann.unrule(SAKA.code);
    expect(await namesOn(ANN)).toEqual({ queue: [], doNotDraft: ["Palmer"] });
  });

  test("no player is on both: adding him to one takes him off the other", async () => {
    const ann = await as(ANN);
    for (const code of [SAKA.code, PALMER.code, ODEGAARD.code]) await ann.queue(code);
    await ann.rule(PALMER.code);
    expect(await namesOn(ANN)).toEqual({ queue: ["Saka", "Ødegaard"], doNotDraft: ["Palmer"] });
    await ann.queue(PALMER.code);
    expect(await namesOn(ANN)).toEqual({ queue: ["Saka", "Ødegaard", "Palmer"], doNotDraft: [] });
  });
});

describe("both lists", () => {
  test("can be changed between picks once the draft has started, and a drafted player stays listed", async () => {
    const ann = await as(ANN);
    await ann.queue(SAKA.code);
    await draftStarted(t, leagueId, teams, LIVE_DRAFT_ROUNDS);
    await t.run((ctx) => ctx.db.insert("squadPlayers", { leagueId, teamId: teams[1], playerCode: SAKA.code }));
    await ann.queue(PALMER.code);
    await ann.queue(ODEGAARD.code);
    await ann.move(ODEGAARD.code, 1);
    await ann.unqueue(PALMER.code);
    await ann.rule(PALMER.code);
    expect(await namesOn(ANN)).toEqual({ queue: ["Ødegaard", "Saka"], doNotDraft: ["Palmer"] });
    expect((await ann.mine())?.queue[1]).toMatchObject({ name: "Saka", ownerTeamName: teamNumbered(2) });
  });

  test("a player who leaves the Premier League after he was added stays, marked gone", async () => {
    await (await as(ANN)).queue(SAKA.code);
    await playerLeaves(t, SAKA.code);
    expect((await (await as(ANN)).mine())?.queue[0]).toMatchObject({ name: "Saka", gone: true });
  });

  test.each(["queue", "doNotDraft"] as const)(`the %s holds at most ${DRAFT_LIST_MOST}, the other list apart`, async (list) => {
    const codes = await manyPlayers(t, DRAFT_LIST_MOST);
    await t.run((ctx) => ctx.db.insert("draftLists", { leagueId, teamId: teams[0], queue: [], doNotDraft: [], [list]: codes }));
    const ann = await as(ANN);
    const add = list === "queue" ? ann.queue : ann.rule;
    await expectRefused(add(SAKA.code), draftListRefusals.full(list));
    await add(codes[0]);
    await (list === "queue" ? ann.rule : ann.queue)(SAKA.code);
    expect((await ann.mine())?.[list]).toHaveLength(DRAFT_LIST_MOST);
  });

  test.each([
    ["no such player", UNHELD, refusals.noPlayer],
    ["a player who has left the Premier League", GONE.code, draftListRefusals.playerGone("Gone")],
  ])("refuse %s", async (_what, code, refusal) => {
    await expectRefused((await as(ANN)).queue(code), refusal);
    await expectRefused((await as(ANN)).rule(code), refusal);
    expect(await namesOn(ANN)).toEqual({ queue: [], doNotDraft: [] });
  });
});

describe("private to the team", () => {
  test("another manager can't see or change them: each team's are its own", async () => {
    await (await as(ANN)).queue(SAKA.code);
    await (await as(ANN)).rule(PALMER.code);
    const bob = await as(BOB);
    expect(await namesOn(BOB)).toEqual({ queue: [], doNotDraft: [] });
    await bob.unqueue(SAKA.code);
    await bob.unrule(PALMER.code);
    await expectRefused(bob.move(SAKA.code, 1), draftListRefusals.notQueued("Saka"));
    expect(await namesOn(ANN)).toEqual({ queue: ["Saka"], doNotDraft: ["Palmer"] });
  });

  test("a manager who leaves keeps them for auto-pick while the team is vacated; whoever takes it next starts empty (S04.15)", async () => {
    await (await as(ANN)).queue(SAKA.code);
    await (await as(ANN)).rule(PALMER.code);
    await (await actingAs(t, ANN)).mutation(api.leagues.teams.leave, { leagueId });
    const vacatedLists = await t.run((ctx) => listsOf(ctx, teams[0]));
    expect(vacatedLists).toMatchObject({ queue: [SAKA.code], doNotDraft: [PALMER.code] });
    await addManager(t, leagueId, MANAGERS[2], teams[0]);
    expect(await namesOn(MANAGERS[2])).toEqual({ queue: [], doNotDraft: [] });
    expect(await t.run((ctx) => listsOf(ctx, teams[0]))).toBeNull();
  });

  test("they are per league: Ann's in another league are different lists", async () => {
    const otherLeague = await adminCreatesLeague(t, TEST_LEAGUE_TEAMS, "Another League");
    await addManagers(t, otherLeague, [ANN]);
    await (await as(ANN)).queue(SAKA.code);
    expect(await namesOn(ANN, otherLeague)).toEqual({ queue: [], doNotDraft: [] });
  });

  test.each([COMMISSIONER, ADMIN])("%s, running no team, gets nothing, and can't change them", async (email) => {
    await (await as(ANN)).queue(SAKA.code);
    const runner = await as(email);
    expect(await runner.mine()).toBeNull();
    await expectRefused(runner.queue(SAKA.code), refusals.runsNoTeam);
    await expectRefused(runner.rule(SAKA.code), refusals.runsNoTeam);
    await expectRefused(runner.unqueue(SAKA.code), refusals.runsNoTeam);
    await expectRefused(runner.move(SAKA.code, 1), refusals.runsNoTeam);
  });

  test("someone outside the league is refused", async () => {
    const outsider = await as(MANAGERS[4]);
    await expectRefused(outsider.mine(), refusals.notInLeague);
    await expectRefused(outsider.queue(SAKA.code), refusals.notInLeague);
  });
});
