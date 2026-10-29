import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { refusals } from "../../../convex/shared/leagueAccess";
import { MOST_IN_SQUAD } from "../../../convex/leagues/leagueLimits";
import { NO_AREA_MINIMUMS, rulesWith } from "../../support/convex/leagueRules.harness";
import { ADMIN, COMMISSIONER, CO_COMMISSIONER, MANAGERS, actingAs, addManager, addManagers, adminCreatesLeague, eventsIn, type TestConvex } from "../../support/convex/leagues.harness";
import { ARSENAL, CHELSEA, insertClubs } from "../../support/convex/footballRows.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { squadRefusals } from "../../../convex/squads/squads";
import { CURRENT_CLUBS_MOST } from "../../../convex/shared/players";
import { expectRefused } from "../../support/convex/test.harness";
import { squadMoves } from "../../support/convex/lineupSquad.harness";

// Assigning players (#31, spec/15 Assigning players): the commissioners and the admin put any
// player on any team, move him, or release him; one team per player in a league; each files a
// letter; the league's squad limits warn but don't block.

const [ANN, BOB, CAT, DAN] = MANAGERS;
const CLUBS = [
  ARSENAL,
  CHELSEA,
  { code: 14, name: "Liverpool", shortName: "LIV" },
];
/** Sixty players, numbered from 1001, spread over the three clubs. */
const PLAYER_CODES = Array.from({ length: 60 }, (_, i) => 1001 + i);
const SAKA = 1001;
const GONE = 2001;

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 4);
  teams = await addManagers(t, leagueId, [ANN, BOB, CAT, DAN]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, CLUBS);
    for (const [i, code] of PLAYER_CODES.entries()) {
      const name = code === SAKA ? "Saka" : `Player ${code}`;
      await ctx.db.insert("players", { code, name, fullName: code === SAKA ? "Bukayo Saka" : name, clubCode: CLUBS[i % 3].code });
    }
    await ctx.db.insert("players", { code: GONE, name: "Gone", fullName: "Long Gone", clubCode: ARSENAL.code, droppedAt: Date.now() });
  });
});

const as = async (email: string) => {
  const person = await actingAs(t, email);
  return {
    ...(await squadMoves(t, leagueId, email)),
    squads: () => person.query(api.squads.squads.squads, { leagueId }),
    find: (text: string) => person.query(api.squads.squads.findPlayers, { leagueId, text }),
  };
};
const squadCodes = async () => (await (await as(COMMISSIONER)).squads()).map((team) => team.players.map((player) => player.code));
const lastEvent = async () => (await eventsIn(t, leagueId)).at(-1);

/** Gives the league these squad limits, written straight into its rules. */
const setSquadRules = async (squad: typeof FIRST_RULES.squad) => {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("leagueRules")
      .withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId))
      .first();
    await ctx.db.patch("leagueRules", row!._id, { rules: rulesWith({ squad }) });
  });
};

test("#31 Done: four teams of 15 can be filled, and each squad says it's over the league's 14", async () => {
  await setSquadRules({ size: { minimum: 11, maximum: 14 }, minimumByArea: null, maxPerClub: null });
  const commissioner = await as(COMMISSIONER);
  for (const [i, code] of PLAYER_CODES.entries()) await commissioner.assign(code, teams[i % 4]);

  const squads = await commissioner.squads();
  expect(squads.map((team) => team.players.length)).toEqual([15, 15, 15, 15]);
  for (const team of squads) expect(team.warnings).toContainEqual({ kind: "overMaximum", players: 15, maximum: 14 });
});

describe("a player is on one team in a league at most", () => {
  test("assigning one already on a team is refused, saying where he is", async () => {
    const commissioner = await as(COMMISSIONER);
    await commissioner.assign(SAKA, teams[0]);
    await expectRefused(commissioner.assign(SAKA, teams[1]), squadRefusals.alreadyOwned("Saka", "Team 1"));
    expect(await squadCodes()).toEqual([[SAKA], [], [], []]);
  });

  test("moving him takes him off his old team", async () => {
    const commissioner = await as(COMMISSIONER);
    await commissioner.assign(SAKA, teams[0]);
    await commissioner.move(SAKA, teams[2]);
    expect(await squadCodes()).toEqual([[], [], [SAKA], []]);
  });

  test("released, he is a free agent, and can be assigned again", async () => {
    const commissioner = await as(COMMISSIONER);
    await commissioner.assign(SAKA, teams[0]);
    await commissioner.release(SAKA);
    expect(await squadCodes()).toEqual([[], [], [], []]);
    await commissioner.assign(SAKA, teams[3]);
    expect(await squadCodes()).toEqual([[], [], [], [SAKA]]);
  });

  test("another league can have him too", async () => {
    const other = await adminCreatesLeague(t, 4, "Another league");
    const [othersTeam] = await addManagers(t, other, [ANN]);
    await (await as(COMMISSIONER)).assign(SAKA, teams[0]);
    await (await actingAs(t, COMMISSIONER)).mutation(api.squads.squads.assign, { leagueId: other, playerCode: SAKA, teamId: othersTeam });
    expect(await squadCodes()).toEqual([[SAKA], [], [], []]);
  });
});

describe("each change files one letter to the league", () => {
  type Commissioner = Awaited<ReturnType<typeof as>>;
  test.each([
    ["assigning", async () => {}, (c: Commissioner) => c.assign(SAKA, teams[0]), { kind: "playerAssigned", teamName: "Team 1" }],
    ["moving", (c: Commissioner) => c.assign(SAKA, teams[0]), (c: Commissioner) => c.move(SAKA, teams[1]), { kind: "playerMoved", fromTeamName: "Team 1", teamName: "Team 2" }],
    ["releasing", (c: Commissioner) => c.assign(SAKA, teams[0]), (c: Commissioner) => c.release(SAKA), { kind: "playerReleased", teamName: "Team 1" }],
  ])("%s", async (_what, setUp, change, event) => {
    const commissioner = await as(COMMISSIONER);
    await setUp(commissioner);
    const before = (await eventsIn(t, leagueId)).length;
    await change(commissioner);
    expect((await eventsIn(t, leagueId)).length - before).toBe(1);
    expect(await lastEvent()).toMatchObject({ by: COMMISSIONER, playerCode: SAKA, playerName: "Saka", ...event });
  });

  test("Ann, managing a team, gets the letter", async () => {
    await (await as(COMMISSIONER)).assign(SAKA, teams[1]);
    const letters = await (await actingAs(t, ANN)).query(api.mail.mail.letters, {});
    expect(letters[0]).toMatchObject({ subject: "Saka joined Team 2" });
  });
});

describe("who may", () => {
  test.each([CO_COMMISSIONER, ADMIN])("%s may", async (email) => {
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
    await (await as(email)).assign(SAKA, teams[0]);
    expect(await squadCodes()).toEqual([[SAKA], [], [], []]);
  });

  test("a manager may not, nor search", async () => {
    const ann = await as(ANN);
    await expectRefused(ann.assign(SAKA, teams[0]), refusals.notRunner);
    await expectRefused(ann.find("Saka"), refusals.notRunner);
  });

  test("a manager sees every squad", async () => {
    await (await as(COMMISSIONER)).assign(SAKA, teams[1]);
    expect((await (await as(ANN)).squads()).map((team) => team.players.map((player) => player.name))).toEqual([[], ["Saka"], [], []]);
  });
});

describe("refused, saying why, and nothing changes", () => {
  test.each([
    ["a player who doesn't exist", (c: Awaited<ReturnType<typeof as>>) => c.assign(9999, teams[0]), squadRefusals.noPlayer],
    ["a player who has left the Premier League", (c: Awaited<ReturnType<typeof as>>) => c.assign(GONE, teams[0]), squadRefusals.playerGone("Gone")],
    ["moving a free agent", (c: Awaited<ReturnType<typeof as>>) => c.move(SAKA, teams[0]), squadRefusals.freeAgent("Saka")],
    ["releasing a free agent", (c: Awaited<ReturnType<typeof as>>) => c.release(SAKA), squadRefusals.freeAgent("Saka")],
  ])("%s", async (_what, change, reason) => {
    await expectRefused(change(await as(COMMISSIONER)), reason);
    expect(await squadCodes()).toEqual([[], [], [], []]);
  });

  test("moving him to the team he's on", async () => {
    const commissioner = await as(COMMISSIONER);
    await commissioner.assign(SAKA, teams[0]);
    await expectRefused(commissioner.move(SAKA, teams[0]), squadRefusals.alreadyThere("Saka", "Team 1"));
  });

  test("a team from another league", async () => {
    const other = await adminCreatesLeague(t, 4, "Another league");
    const [othersTeam] = await addManagers(t, other, [ANN]);
    await expectRefused((await as(COMMISSIONER)).assign(SAKA, othersTeam), refusals.noTeam);
  });

  test(`a team already holding ${MOST_IN_SQUAD}, the most any can`, async () => {
    await t.run(async (ctx) => {
      for (let i = 0; i < MOST_IN_SQUAD; i += 1) await ctx.db.insert("squadPlayers", { leagueId, teamId: teams[0], playerCode: 5000 + i });
    });
    await expectRefused((await as(COMMISSIONER)).assign(SAKA, teams[0]), squadRefusals.squadFull);
  });
});

describe("squad limits warn, never block", () => {
  test("under the minimum, and over the most per club", async () => {
    await setSquadRules({ size: { minimum: 11, maximum: 14 }, minimumByArea: null, maxPerClub: 1 });
    const commissioner = await as(COMMISSIONER);
    // 1001 and 1004 are both Arsenal's.
    await commissioner.assign(1001, teams[0]);
    await commissioner.assign(1004, teams[0]);

    expect((await commissioner.squads())[0].warnings).toEqual([
      { kind: "underMinimum", players: 2, minimum: 11 },
      { kind: "overClubMaximum", clubShortName: "ARS", players: 2, maximum: 1 },
    ]);
  });

  test("short of an area's minimum, with a wing back filling only one of defence and midfield (#317)", async () => {
    await setSquadRules({ size: null, minimumByArea: { ...NO_AREA_MINIMUMS, defence: 1, midfield: 1 }, maxPerClub: null });
    await t.run(async (ctx) => {
      await ctx.db.insert("playerPositions", { code: SAKA, starts: [], approved: [], set: ["WB"], removed: [] });
    });
    await (await as(COMMISSIONER)).assign(SAKA, teams[0]);

    expect((await (await as(COMMISSIONER)).squads())[0].warnings).toEqual([{ kind: "underAreaMinimum", area: "midfield", players: 0, minimum: 1 }]);
  });

  test("a league with no squad limits warns of nothing", async () => {
    await setSquadRules({ size: null, minimumByArea: null, maxPerClub: null });
    await (await as(COMMISSIONER)).assign(SAKA, teams[0]);
    expect((await (await as(COMMISSIONER)).squads())[0].warnings).toEqual([]);
  });
});

describe("finding a player", () => {
  test("by name, with his team in this league, never one who has left", async () => {
    const commissioner = await as(COMMISSIONER);
    await commissioner.assign(SAKA, teams[0]);
    expect(await commissioner.find("Saka")).toEqual([{ code: SAKA, name: "Saka", fullName: "Bukayo Saka", teamName: "Team 1" }]);
    expect(await commissioner.find("Gone")).toEqual([]);
    expect(await commissioner.find("  ")).toEqual([]);
  });

  test("a squad row naming a team outside the league is an error, never a free agent", async () => {
    const otherLeague = await adminCreatesLeague(t, 4, "Another league");
    const outsider = await addManager(t, otherLeague, ANN);
    await t.run(async (ctx) => {
      await ctx.db.insert("squadPlayers", { leagueId, teamId: outsider, playerCode: SAKA });
    });
    await expect((await as(COMMISSIONER)).find("Saka")).rejects.toThrow(`player ${SAKA} is owned by team ${outsider}, which isn't in league ${leagueId}`);
  });

  test("those who have left never crowd out one still here", async () => {
    await t.run(async (ctx) => {
      for (let i = 0; i < 30; i += 1) {
        await ctx.db.insert("players", { code: 3000 + i, name: "Smith", fullName: `Gone Smith ${i}`, clubCode: ARSENAL.code, droppedAt: Date.now() });
      }
      await ctx.db.insert("players", { code: 4000, name: "Smith", fullName: "Here Smith", clubCode: ARSENAL.code });
    });
    expect((await (await as(COMMISSIONER)).find("Smith")).map((player) => player.code)).toEqual([4000]);
  });
});

// Clubs are never deleted, only marked dropped, so seasons pile up (#142).
describe("a player's club", () => {
  test(`is named however many clubs were held before his, past ${CURRENT_CLUBS_MOST}`, async () => {
    const PROMOTED = { code: 90, name: "Promoted", shortName: "PRO" };
    const NEWCOMER = 5000;
    await t.run(async (ctx) => {
      for (let index = 0; index < CURRENT_CLUBS_MOST; index += 1) {
        await ctx.db.insert("clubs", { code: 100 + index, name: `Old ${index}`, shortName: "OLD", droppedAt: Date.now() });
      }
      await ctx.db.insert("clubs", PROMOTED);
      await ctx.db.insert("players", { code: NEWCOMER, name: "Newcomer", fullName: "New Comer", clubCode: PROMOTED.code });
    });
    const commissioner = await as(COMMISSIONER);
    await commissioner.assign(NEWCOMER, teams[0]);
    expect((await commissioner.squads())[0].players).toEqual([{ code: NEWCOMER, name: "Newcomer", clubShortName: PROMOTED.shortName, gone: false }]);
  });

  test("that isn't held fails the squads loudly, never a blank name", async () => {
    const UNKNOWN_CLUB = 999;
    const ORPHAN = 5001;
    await t.run((ctx) => ctx.db.insert("players", { code: ORPHAN, name: "Orphan", fullName: "Or Phan", clubCode: UNKNOWN_CLUB }));
    const commissioner = await as(COMMISSIONER);
    await commissioner.assign(ORPHAN, teams[0]);
    await expect(commissioner.squads()).rejects.toThrow(`No club with code ${UNKNOWN_CLUB} is held`);
  });
});
