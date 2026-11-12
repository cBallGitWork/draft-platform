import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { NEWS_PAGE, type LeagueNews } from "../../../convex/home/leagueNews";
import type { LeagueEvent } from "../../../convex/schema";
import { refusals } from "../../../convex/shared/leagueAccess";
import { expectRefused } from "../../support/convex/test.harness";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS, OUTSIDER, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { teamNumbered } from "../../../convex/leagues/teams";

// League home's News tab (#1356; docs/design/approved/home/, The News tab): every team's completed
// moves, newest first, paged, with Team and Kind filters, from the league's squad events.

const [ANN, BOB, CAT] = MANAGERS;
const SAKA = { playerCode: 1001, playerName: "Saka" };
const RICE = { playerCode: 1002, playerName: "Rice" };

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: { teamId: Id<"teams">; teamName: string }[];
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 20);
  const ids = await addManagers(t, leagueId, [ANN, BOB, CAT]);
  teams = ids.map((teamId, i) => ({ teamId, teamName: `Team ${i + 1}` }));
});

type Asked = { before?: LeagueNews["older"]; teamId?: Id<"teams"> | null; kind?: LeagueNews["moves"][number]["kind"] | null };
const read = async ({ before = null, teamId = null, kind = null }: Asked = {}, email = ANN) =>
  (await actingAs(t, email)).query(api.home.leagueNews.ofLeague, { leagueId, before, teamId, kind });

/** Files the event at `at`, as the league's squad changes file theirs. */
const file = (at: number, event: LeagueEvent, by = ANN) => t.run((ctx) => ctx.db.insert("leagueEvents", { leagueId, at, by, event }));
const onTeam = (team: number, player = SAKA) => ({ ...player, teamId: teams[team].teamId, teamName: teams[team].teamName });

/** Each move's kind, team, who joined, who left and where from; a trade's sides and other team. */
const summary = (news: LeagueNews) =>
  news.moves.map((move) =>
    move.kind === "tradeMade"
      ? { kind: move.kind, teamName: move.teamName, gets: move.gets, gives: move.gives, otherTeamName: move.otherTeamName }
      : { kind: move.kind, teamName: move.teamName, joined: move.joined?.playerName ?? null, left: move.left?.playerName ?? null, fromTeamName: move.fromTeamName },
  );

test("anyone without a part in the league is refused", async () => {
  await expectRefused(read({}, OUTSIDER), refusals.notInLeague);
});

test("the commissioner reads it too, with the league's teams for the Team filter and his letter pinned", async () => {
  await (await actingAs(t, COMMISSIONER)).mutation(api.mail.mail.writeToLeague, { leagueId, subject: "Christmas break", body: "GW17 to GW19 are off" });
  const news = await read({}, COMMISSIONER);
  expect(news.teams).toEqual(teams);
  expect(news.pinnedLetter?.subject).toBe("Christmas break");
});

describe("the moves", () => {
  test("lists every kind of squad move, newest first, and no other event", async () => {
    await file(1, { kind: "playerAssigned", ...onTeam(0) });
    await file(2, { kind: "playerMoved", ...onTeam(1), fromTeamId: teams[0].teamId, fromTeamName: teams[0].teamName }, COMMISSIONER);
    await file(3, { kind: "teamRenamed", teamId: teams[2].teamId, from: teamNumbered(3), to: "Team Three" });
    await file(4, { kind: "playerReleased", ...onTeam(1) }, COMMISSIONER);
    await file(5, { kind: "playerPickedUp", ...onTeam(2, RICE), dropped: null });
    await file(6, { kind: "playerDropped", ...onTeam(2, RICE), toWaivers: true });

    const news = await read();
    expect(summary(news)).toEqual([
      { kind: "playerDropped", teamName: teamNumbered(3), joined: null, left: "Rice", fromTeamName: null },
      { kind: "playerPickedUp", teamName: teamNumbered(3), joined: "Rice", left: null, fromTeamName: null },
      { kind: "playerReleased", teamName: teamNumbered(2), joined: null, left: "Saka", fromTeamName: null },
      { kind: "playerMoved", teamName: teamNumbered(2), joined: "Saka", left: null, fromTeamName: teamNumbered(1) },
      { kind: "playerAssigned", teamName: teamNumbered(1), joined: "Saka", left: null, fromTeamName: null },
    ]);
    expect(news.moves[0]).toMatchObject({ toWaivers: true });
    expect(news.older).toBeNull();
  });

  test("a claim names the player dropped for it, whose drop has no row of its own", async () => {
    // As a waiver run files them: the drop first, then the claim, at the same instant.
    await file(7, { kind: "playerDropped", ...onTeam(0, RICE), toWaivers: false });
    await file(7, { kind: "playerClaimed", ...onTeam(0), dropped: { ...RICE, toWaivers: false } });

    const news = await read();
    expect(summary(news)).toEqual([{ kind: "playerClaimed", teamName: teamNumbered(1), joined: "Saka", left: "Rice", fromTeamName: null }]);
    expect(news.moves[0]).toMatchObject({ toWaivers: false });
  });

  test("the Team filter finds a move by either team, and the Kind filter only its kind", async () => {
    await file(1, { kind: "playerAssigned", ...onTeam(0) });
    await file(2, { kind: "playerMoved", ...onTeam(1), fromTeamId: teams[0].teamId, fromTeamName: teams[0].teamName });
    await file(3, { kind: "playerAssigned", ...onTeam(2, RICE) });

    expect(summary(await read({ teamId: teams[0].teamId })).map((move) => move.kind)).toEqual(["playerMoved", "playerAssigned"]);
    expect(summary(await read({ teamId: teams[2].teamId })).map((move) => move.joined)).toEqual(["Rice"]);
    expect(summary(await read({ kind: "playerAssigned" })).map((move) => move.joined)).toEqual(["Rice", "Saka"]);
    expect((await read({ teamId: teams[1].teamId, kind: "playerAssigned" })).moves).toEqual([]);
  });

  test("a trade that went through is one row, never its players' moves, found by either team and by its kind (#1491)", async () => {
    const gives = { players: [SAKA], picks: [] };
    const gets = { players: [RICE], picks: [{ round: 2, teamId: teams[1].teamId, teamName: teams[1].teamName }] };
    const between = { fromTeamId: teams[0].teamId, fromTeamName: teams[0].teamName, toTeamId: teams[1].teamId, toTeamName: teams[1].teamName };
    await file(4, { kind: "tradeMade", ...between, gives, gets });
    await file(4, { kind: "playerTraded", ...onTeam(1), fromTeamId: teams[0].teamId, fromTeamName: teams[0].teamName });
    await file(4, { kind: "playerTraded", ...onTeam(0, RICE), fromTeamId: teams[1].teamId, fromTeamName: teams[1].teamName });

    const row = { kind: "tradeMade", teamName: teamNumbered(1), gets, gives, otherTeamName: teamNumbered(2) };
    expect(summary(await read())).toEqual([row]);
    expect(summary(await read({ teamId: teams[1].teamId }))).toEqual([row]);
    expect(summary(await read({ kind: "tradeMade" }))).toEqual([row]);
    expect((await read({ teamId: teams[2].teamId })).moves).toEqual([]);
  });
});

describe("paging", () => {
  test(`a page holds ${NEWS_PAGE}, and Older moves reads the rest, none twice and none missed`, async () => {
    for (let at = 1; at <= NEWS_PAGE + 5; at += 1) await file(at, { kind: "playerAssigned", ...onTeam(0) });

    const first = await read();
    expect(first.moves.map((move) => move.at)).toEqual(Array.from({ length: NEWS_PAGE }, (_, i) => NEWS_PAGE + 5 - i));
    const second = await read({ before: first.older });
    expect(second.moves.map((move) => move.at)).toEqual([5, 4, 3, 2, 1]);
    expect(second.older).toBeNull();
  });

  test("moves at the same instant either side of a page's end are each shown once", async () => {
    for (let i = 0; i < NEWS_PAGE + 3; i += 1) await file(9, { kind: "playerAssigned", ...onTeam(i % 3) });

    const first = await read();
    const second = await read({ before: first.older });
    expect(first.moves).toHaveLength(NEWS_PAGE);
    expect(second.moves).toHaveLength(3);
    expect(new Set([...first.moves, ...second.moves].map((move) => move.filed)).size).toBe(NEWS_PAGE + 3);
  });

  test("a claim ending a page keeps its drop off the next", async () => {
    for (let at = 20; at < 20 + NEWS_PAGE - 1; at += 1) await file(at, { kind: "playerAssigned", ...onTeam(1) });
    await file(10, { kind: "playerDropped", ...onTeam(0, RICE), toWaivers: true });
    await file(10, { kind: "playerClaimed", ...onTeam(0), dropped: { ...RICE, toWaivers: true } });
    await file(5, { kind: "playerReleased", ...onTeam(2) });

    const first = await read();
    expect(first.moves.at(-1)?.kind).toBe("playerClaimed");
    expect(summary(await read({ before: first.older })).map((move) => move.kind)).toEqual(["playerReleased"]);
  });
});
