import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { shortlistedReleasedLetter } from "../../../convex/mail/letterWords";
import { SHORTLIST_MOST, shortlistRefusals } from "../../../convex/scouting/shortlist";
import { refusals } from "../../../convex/shared/leagueAccess";
import { ADMIN, COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { ARSENAL, CHELSEA, insertClubs } from "../../support/convex/footballRows.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";

// The shortlist (#374, spec/19 The shortlist): a manager's own list of players for the season, per
// league, private to the team; and the Mail letter to each manager whose shortlist holds a player
// when he is released (spec/16).

const [ANN, BOB, CAT] = MANAGERS;
const SAKA = { code: 1001, name: "Saka", fullName: "Bukayo Saka", clubCode: ARSENAL.code };
const PALMER = { code: 1002, name: "Palmer", fullName: "Cole Palmer", clubCode: CHELSEA.code };
const GONE = { code: 2001, name: "Gone", fullName: "Long Gone", clubCode: ARSENAL.code };
const NO_SUCH_PLAYER = 9999;

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 4);
  teams = await addManagers(t, leagueId, [ANN, BOB, CAT]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA]);
    for (const player of [SAKA, PALMER]) await ctx.db.insert("players", player);
    await ctx.db.insert("players", { ...GONE, droppedAt: Date.now() });
  });
});

const as = async (email: string, league = leagueId) => {
  const person = await actingAs(t, email);
  return {
    add: (playerCode: number) => person.mutation(api.scouting.shortlist.add, { leagueId: league, playerCode }),
    remove: (playerCode: number) => person.mutation(api.scouting.shortlist.remove, { leagueId: league, playerCode }),
    mine: () => person.query(api.scouting.shortlist.mine, { leagueId: league }),
    letters: () => person.query(api.mail.mail.letters, {}),
  };
};
const namesOn = async (email: string, league = leagueId) => (await (await as(email, league)).mine())?.map((player) => player.name);

describe("a manager's own shortlist", () => {
  test("starts empty", async () => {
    expect(await namesOn(ANN)).toEqual([]);
  });

  test("a player added is on it, by name, with his club and who owns him", async () => {
    await t.run((ctx) => ctx.db.insert("squadPlayers", { leagueId, teamId: teams[1], playerCode: PALMER.code }));
    const ann = await as(ANN);
    await ann.add(SAKA.code);
    await ann.add(PALMER.code);
    expect(await ann.mine()).toEqual([
      { code: PALMER.code, name: "Palmer", fullName: "Cole Palmer", club: CHELSEA, ownerTeamName: "Team 2", gone: false },
      { code: SAKA.code, name: "Saka", fullName: "Bukayo Saka", club: ARSENAL, ownerTeamName: null, gone: false },
    ]);
  });

  test("a player added twice is on it once", async () => {
    const ann = await as(ANN);
    await ann.add(SAKA.code);
    await ann.add(SAKA.code);
    expect(await namesOn(ANN)).toEqual(["Saka"]);
  });

  test("a player removed is off it; removing one not on it changes nothing", async () => {
    const ann = await as(ANN);
    await ann.add(SAKA.code);
    await ann.add(PALMER.code);
    await ann.remove(SAKA.code);
    await ann.remove(SAKA.code);
    expect(await namesOn(ANN)).toEqual(["Palmer"]);
  });

  test("a player who leaves the Premier League after he was added stays on it, marked gone", async () => {
    await (await as(ANN)).add(SAKA.code);
    await t.run(async (ctx) => {
      const saka = await ctx.db
        .query("players")
        .withIndex("by_code", (q) => q.eq("code", SAKA.code))
        .unique();
      await ctx.db.patch("players", saka!._id, { droppedAt: Date.now() });
    });
    expect((await (await as(ANN)).mine())?.[0]).toMatchObject({ name: "Saka", gone: true });
  });

  test(`holds at most ${SHORTLIST_MOST}`, async () => {
    await t.run(async (ctx) => {
      for (let code = 1; code <= SHORTLIST_MOST; code++) {
        await ctx.db.insert("players", { code, name: `Player ${code}`, fullName: `Player ${code}`, clubCode: ARSENAL.code });
        await ctx.db.insert("shortlistPlayers", { leagueId, teamId: teams[0], playerCode: code });
      }
    });
    await expectRefused((await as(ANN)).add(SAKA.code), shortlistRefusals.full);
  });

  test.each([
    ["no such player", NO_SUCH_PLAYER, refusals.noPlayer],
    ["a player who has left the Premier League", GONE.code, shortlistRefusals.playerGone("Gone")],
  ])("refuses %s", async (_what, code, refusal) => {
    await expectRefused((await as(ANN)).add(code), refusal);
  });
});

describe("private to the team", () => {
  test("another manager can't see it: each team's is its own", async () => {
    await (await as(ANN)).add(SAKA.code);
    await (await as(BOB)).add(PALMER.code);
    expect(await namesOn(ANN)).toEqual(["Saka"]);
    expect(await namesOn(BOB)).toEqual(["Palmer"]);
    expect(await namesOn(CAT)).toEqual([]);
  });

  test("Bob removing Saka takes him off only Bob's", async () => {
    await (await as(ANN)).add(SAKA.code);
    await (await as(BOB)).add(SAKA.code);
    await (await as(BOB)).remove(SAKA.code);
    expect(await namesOn(ANN)).toEqual(["Saka"]);
    expect(await namesOn(BOB)).toEqual([]);
  });

  test("it is per league: Ann's in another league is a different list", async () => {
    const otherLeague = await adminCreatesLeague(t, 4, "Another League");
    await addManagers(t, otherLeague, [ANN]);
    await (await as(ANN)).add(SAKA.code);
    expect(await namesOn(ANN, otherLeague)).toEqual([]);
  });

  test.each([COMMISSIONER, ADMIN])("%s, running no team, has none, and can't add to one", async (email) => {
    expect(await (await as(email)).mine()).toBeNull();
    await expectRefused((await as(email)).add(SAKA.code), refusals.runsNoTeam);
    await expectRefused((await as(email)).remove(SAKA.code), refusals.runsNoTeam);
  });

  test("someone outside the league is refused", async () => {
    const outsider = MANAGERS[4];
    await expectRefused((await as(outsider)).mine(), refusals.notInLeague);
    await expectRefused((await as(outsider)).add(SAKA.code), refusals.notInLeague);
  });
});

describe("a shortlisted player released", () => {
  const release = async (by = COMMISSIONER) => {
    await (await actingAs(t, COMMISSIONER)).mutation(api.squads.squads.assign, { leagueId, playerCode: SAKA.code, teamId: teams[2] });
    await (await actingAs(t, by)).mutation(api.squads.squads.release, { leagueId, playerCode: SAKA.code });
  };
  const subject = shortlistedReleasedLetter("Saka", "Team 3", COMMISSIONER).subject;
  const shortlistLetters = async (email: string) => (await (await as(email)).letters()).filter((letter) => letter.subject === subject);

  test("files a letter to each manager whose shortlist holds him, and to no one else", async () => {
    await (await as(ANN)).add(SAKA.code);
    await (await as(BOB)).add(SAKA.code);
    await release();
    expect(await shortlistLetters(ANN)).toEqual([
      expect.objectContaining({ ...shortlistedReleasedLetter("Saka", "Team 3", COMMISSIONER), leagueName: expect.any(String), read: false }),
    ]);
    expect(await shortlistLetters(BOB)).toHaveLength(1);
    expect(await shortlistLetters(CAT)).toEqual([]);
    expect(await shortlistLetters(COMMISSIONER)).toEqual([]);
  });

  test("names the admin as the admin", async () => {
    await (await as(ANN)).add(SAKA.code);
    await release(ADMIN);
    const adminSubject = shortlistedReleasedLetter("Saka", "Team 3", "The admin");
    expect((await (await as(ANN)).letters()).find((letter) => letter.subject === adminSubject.subject)).toMatchObject(adminSubject);
  });

  test("he stays on the shortlist", async () => {
    await (await as(ANN)).add(SAKA.code);
    await release();
    expect(await namesOn(ANN)).toEqual(["Saka"]);
  });

  test("no shortlist holding him, no shortlist letter", async () => {
    await release();
    for (const email of [ANN, BOB, CAT]) expect(await shortlistLetters(email)).toEqual([]);
  });
});
