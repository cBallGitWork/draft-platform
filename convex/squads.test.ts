import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { FIRST_RULES } from "./firstRules";
import { refusals } from "./leagueAccess";
import { MOST_IN_SQUAD } from "./leagueLimits";
import { rulesWith } from "./leagueRules.harness";
import { ADMIN, COMMISSIONER, CO_COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, eventsIn, type TestConvex } from "./leagues.harness";
import { fakeResend, resetSignInDeployment, signInDeployment } from "./signIn.harness";
import { squadRefusals } from "./squads";

// Assigning players (#31, spec/15 Assigning players): the commissioners and the admin put any
// player on any team, move him, or release him; one team per player in a league; each files a
// letter; the league's squad limits warn but don't block.

const [ANN, BOB, CAT, DAN] = MANAGERS;
const CLUBS = [
  { code: 3, name: "Arsenal", shortName: "ARS" },
  { code: 8, name: "Chelsea", shortName: "CHE" },
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
    for (const club of CLUBS) await ctx.db.insert("clubs", club);
    for (const [i, code] of PLAYER_CODES.entries()) {
      const name = code === SAKA ? "Saka" : `Player ${code}`;
      await ctx.db.insert("players", { code, name, fullName: code === SAKA ? "Bukayo Saka" : name, clubCode: CLUBS[i % 3].code });
    }
    await ctx.db.insert("players", { code: GONE, name: "Gone", fullName: "Long Gone", clubCode: 3, droppedAt: Date.now() });
  });
});
afterEach(resetSignInDeployment);

const as = async (email: string) => {
  const person = await actingAs(t, email);
  return {
    assign: (playerCode: number, teamId: Id<"teams">) => person.mutation(api.squads.assign, { leagueId, playerCode, teamId }),
    move: (playerCode: number, teamId: Id<"teams">) => person.mutation(api.squads.move, { leagueId, playerCode, teamId }),
    release: (playerCode: number) => person.mutation(api.squads.release, { leagueId, playerCode }),
    squads: () => person.query(api.squads.squads, { leagueId }),
    find: (text: string) => person.query(api.squads.findPlayers, { leagueId, text }),
  };
};
const squadCodes = async () => (await (await as(COMMISSIONER)).squads()).map((team) => team.players.map((player) => player.code));
const lastEvent = async () => (await eventsIn(t, leagueId)).at(-1);

test("#31 Done: four teams of 15 can be filled, and each squad says it's over the league's 14", async () => {
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
    await expect(commissioner.assign(SAKA, teams[1])).rejects.toThrow(squadRefusals.alreadyOwned("Saka", "Team 1"));
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
    await (await actingAs(t, COMMISSIONER)).mutation(api.squads.assign, { leagueId: other, playerCode: SAKA, teamId: othersTeam });
    expect(await squadCodes()).toEqual([[SAKA], [], [], []]);
  });
});

describe("each change files one letter to the league", () => {
  test.each([
    ["assigning", async (c: Awaited<ReturnType<typeof as>>) => c.assign(SAKA, teams[0]), { kind: "playerAssigned", teamName: "Team 1" }],
    [
      "moving",
      async (c: Awaited<ReturnType<typeof as>>) => {
        await c.assign(SAKA, teams[0]);
        await c.move(SAKA, teams[1]);
      },
      { kind: "playerMoved", fromTeamName: "Team 1", teamName: "Team 2" },
    ],
    [
      "releasing",
      async (c: Awaited<ReturnType<typeof as>>) => {
        await c.assign(SAKA, teams[0]);
        await c.release(SAKA);
      },
      { kind: "playerReleased", teamName: "Team 1" },
    ],
  ])("%s", async (_what, change, event) => {
    const commissioner = await as(COMMISSIONER);
    const before = (await eventsIn(t, leagueId)).length;
    await change(commissioner);
    expect(await lastEvent()).toMatchObject({ by: COMMISSIONER, playerCode: SAKA, playerName: "Saka", ...event });
    const filed = (await eventsIn(t, leagueId)).length - before;
    expect(filed).toBe(event.kind === "playerAssigned" ? 1 : 2);
  });

  test("Ann, managing a team, gets the letter", async () => {
    await (await as(COMMISSIONER)).assign(SAKA, teams[1]);
    const letters = await (await actingAs(t, ANN)).query(api.mail.letters, {});
    expect(letters[0]).toMatchObject({ subject: "Saka joined Team 2" });
  });
});

describe("who may", () => {
  test.each([CO_COMMISSIONER, ADMIN])("%s may", async (email) => {
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
    await (await as(email)).assign(SAKA, teams[0]);
    expect(await squadCodes()).toEqual([[SAKA], [], [], []]);
  });

  test("a manager may not, nor search", async () => {
    const ann = await as(ANN);
    await expect(ann.assign(SAKA, teams[0])).rejects.toThrow(refusals.notRunner);
    await expect(ann.find("Saka")).rejects.toThrow(refusals.notRunner);
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
    await expect(change(await as(COMMISSIONER))).rejects.toThrow(reason);
    expect(await squadCodes()).toEqual([[], [], [], []]);
  });

  test("moving him to the team he's on", async () => {
    const commissioner = await as(COMMISSIONER);
    await commissioner.assign(SAKA, teams[0]);
    await expect(commissioner.move(SAKA, teams[0])).rejects.toThrow(squadRefusals.alreadyThere("Saka", "Team 1"));
  });

  test("a team from another league", async () => {
    const other = await adminCreatesLeague(t, 4, "Another league");
    const [othersTeam] = await addManagers(t, other, [ANN]);
    await expect((await as(COMMISSIONER)).assign(SAKA, othersTeam)).rejects.toThrow(squadRefusals.noTeam);
  });

  test(`a team already holding ${MOST_IN_SQUAD}, the most any can`, async () => {
    await t.run(async (ctx) => {
      for (let i = 0; i < MOST_IN_SQUAD; i += 1) await ctx.db.insert("squadPlayers", { leagueId, teamId: teams[0], playerCode: 5000 + i });
    });
    await expect((await as(COMMISSIONER)).assign(SAKA, teams[0])).rejects.toThrow(squadRefusals.squadFull);
  });
});

describe("squad limits warn, never block", () => {
  const setSquadRules = async (squad: typeof FIRST_RULES.squad) => {
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("leagueRules")
        .withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId))
        .first();
      await ctx.db.patch("leagueRules", row!._id, { rules: rulesWith({ squad }) });
    });
  };

  test("under the minimum, and over the most per club", async () => {
    await setSquadRules({ size: { minimum: 11, maximum: 14 }, byArea: null, maxPerClub: 1 });
    const commissioner = await as(COMMISSIONER);
    // 1001 and 1004 are both Arsenal's.
    await commissioner.assign(1001, teams[0]);
    await commissioner.assign(1004, teams[0]);

    expect((await commissioner.squads())[0].warnings).toEqual([
      { kind: "underMinimum", players: 2, minimum: 11 },
      { kind: "overClubMaximum", clubShortName: "ARS", players: 2, maximum: 1 },
    ]);
  });

  test("a league with no squad limits warns of nothing", async () => {
    await setSquadRules({ size: null, byArea: null, maxPerClub: null });
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
});
