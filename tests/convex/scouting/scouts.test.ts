import { beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CLAUDE_RETRY_MS, WRITING_MODEL } from "../../../convex/outbound/claude";
import { SCOUT_TRIP_MS } from "../../../convex/scouting/scouts";
import { playerLeftLetter, REPORT_SYSTEM, reportInLetter, scoutRefusals } from "../../../convex/scouting/scoutWords";
import { refusals } from "../../../convex/shared/leagueAccess";
import { HOUR_MS } from "../../../convex/shared/time";
import { GONE, UNHELD, insertDroppedPlayer } from "../../support/convex/footballRows.harness";
import { ADMIN, COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeClaude, fakeReport, type FakeClaude } from "../../support/convex/scouts.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { BLANK, CAMEO, SCORER, STEADY, holdStarsPlayers } from "../../support/convex/stars.harness";
import { elapse, expectRefused, silenceConsoleError } from "../../support/convex/test.harness";

// Scouts (#375; spec/19, Scouts and The report): each team's 3, sent to any player, each report
// written by AI 24 hours on, dated; Mail says it is in; no other team can tell.

const [ANN, BOB] = MANAGERS;

let t: TestConvex;
let leagueId: Id<"leagues">;
let claude: FakeClaude;
let bobsTeam: Id<"teams"> | undefined;
beforeEach(async () => {
  vi.useFakeTimers();
  t = await signInDeployment();
  fakeResend();
  claude = fakeClaude();
  leagueId = await adminCreatesLeague(t);
  [, bobsTeam] = await addManagers(t, leagueId, [ANN, BOB]);
  await holdStarsPlayers(t);
});

const as = async (email: string) => {
  const person = await actingAs(t, email);
  return {
    send: (playerCode: number) => person.mutation(api.scouting.scouts.send, { leagueId, playerCode }),
    mine: () => person.query(api.scouting.scouts.mine, { leagueId }),
    onPlayer: (playerCode: number) => person.query(api.scouting.scouts.onPlayer, { leagueId, playerCode }),
    letters: () => person.query(api.mail.mail.letters, {}),
  };
};

/** The day goes by: every scout sent now is back. */
const dayPasses = () => elapse(t, SCOUT_TRIP_MS);
const scoutLetters = async (email: string, subject: string) => (await (await as(email)).letters()).filter((letter) => letter.subject === subject);

describe("sending a scout", () => {
  test("takes a slot, and he is back 24 hours later", async () => {
    const ann = await as(ANN);
    const sentAt = Date.now();
    await ann.send(SCORER.code);
    expect(await ann.mine()).toEqual({ scouts: 3, out: [{ playerCode: SCORER.code, name: "Scorer", sentAt, dueAt: sentAt + SCOUT_TRIP_MS }], reports: [] });
  });

  test("a fourth scout is refused while three are out", async () => {
    const ann = await as(ANN);
    for (const player of [SCORER, STEADY, BLANK]) await ann.send(player.code);
    await expectRefused(ann.send(CAMEO.code), scoutRefusals.allOut(3));
  });

  test("the site's number of scouts is the cap", async () => {
    await t.mutation(internal.admin.platformSettings.setSettings, { scoutsPerTeam: 1 });
    const ann = await as(ANN);
    await ann.send(SCORER.code);
    await expectRefused(ann.send(STEADY.code), scoutRefusals.allOut(1));
  });

  test("only one scout on a player at a time", async () => {
    const ann = await as(ANN);
    await ann.send(SCORER.code);
    await expectRefused(ann.send(SCORER.code), scoutRefusals.alreadyOut("Scorer"));
  });

  test("a player who has left the Premier League, or isn't in it, can't be scouted", async () => {
    await t.run((ctx) => insertDroppedPlayer(ctx, GONE, Date.now()));
    const ann = await as(ANN);
    await expectRefused(ann.send(GONE.code), scoutRefusals.playerGone(GONE.name));
    await expectRefused(ann.send(UNHELD), refusals.noPlayer);
  });

  test("another team's player can be scouted", async () => {
    await t.run((ctx) => ctx.db.insert("squadPlayers", { leagueId, teamId: bobsTeam!, playerCode: SCORER.code }));
    await (await as(ANN)).send(SCORER.code);
    expect((await (await as(ANN)).mine())?.out.map((scout) => scout.name)).toEqual(["Scorer"]);
  });

  test.each([COMMISSIONER, ADMIN])("%s, running no team, has no scouts", async (email) => {
    expect(await (await as(email)).mine()).toBeNull();
    await expectRefused((await as(email)).send(SCORER.code), refusals.runsNoTeam);
  });
});

describe("the report", () => {
  test("isn't there before the 24 hours are up", async () => {
    const ann = await as(ANN);
    await ann.send(SCORER.code);
    await elapse(t, SCOUT_TRIP_MS - HOUR_MS);
    expect((await ann.mine())?.reports).toEqual([]);
    expect(claude.asked).toEqual([]);
  });

  test("lands after 24 hours, dated, written by AI from his figures, and the scout is free again", async () => {
    const ann = await as(ANN);
    const sentAt = Date.now();
    await ann.send(SCORER.code);
    await dayPasses();
    const [asked] = claude.asked;
    expect(asked).toMatchObject({ model: WRITING_MODEL, system: REPORT_SYSTEM });
    const prompt = asked!.messages[0]!.content;
    expect(prompt).toContain("Player: Scorer");
    expect(prompt).toContain("Role stars:");
    expect(prompt).toContain("Manager's formation:");
    expect(prompt).toContain("This season's matches");
    expect(prompt).toContain("Fixtures ahead:");
    expect(await ann.mine()).toEqual({
      scouts: 3,
      out: [],
      reports: [{ playerCode: SCORER.code, name: "Scorer", sentAt, writtenAt: sentAt + SCOUT_TRIP_MS, text: fakeReport(prompt) }],
    });
    for (const player of [SCORER, STEADY, BLANK]) await ann.send(player.code);
  });

  test("Mail tells the manager it is in, and nothing more; no one else is told", async () => {
    await (await as(ANN)).send(SCORER.code);
    await dayPasses();
    const { subject } = reportInLetter("Scorer");
    expect(await scoutLetters(ANN, subject)).toEqual([expect.objectContaining({ ...reportInLetter("Scorer"), read: false })]);
    for (const email of [BOB, COMMISSIONER]) expect(await scoutLetters(email, subject)).toEqual([]);
  });

  test("sending a scout to him again writes a new one; his card lists both, newest first", async () => {
    const ann = await as(ANN);
    await ann.send(SCORER.code);
    await dayPasses();
    await ann.send(SCORER.code);
    await dayPasses();
    const trips = await ann.onPlayer(SCORER.code);
    expect(trips?.map((trip) => trip.state)).toEqual(["reported", "reported"]);
    expect(trips![0]!.report!.writtenAt).toBeGreaterThan(trips![1]!.report!.writtenAt);
  });

  test("a player who leaves the Premier League while the scout is out gets no report: the scout is back, free, and Mail says so", async () => {
    const ann = await as(ANN);
    await ann.send(SCORER.code);
    await t.run(async (ctx) => {
      const scorer = (await ctx.db.query("players").collect()).find((player) => player.code === SCORER.code)!;
      await ctx.db.patch("players", scorer._id, { droppedAt: Date.now() });
    });
    await dayPasses();
    expect(claude.asked).toEqual([]);
    expect(await ann.mine()).toMatchObject({ out: [], reports: [] });
    expect((await ann.onPlayer(SCORER.code))?.map((trip) => trip.state)).toEqual(["playerLeft"]);
    expect(await scoutLetters(ANN, playerLeftLetter("Scorer").subject)).toHaveLength(1);
  });

  test("a failed write is tried again later, the scout out meanwhile", async () => {
    silenceConsoleError();
    claude.failing = true;
    const ann = await as(ANN);
    await ann.send(SCORER.code);
    await dayPasses();
    expect((await ann.mine())?.out).toHaveLength(1);
    claude.failing = false;
    await elapse(t, CLAUDE_RETRY_MS);
    expect(await ann.mine()).toMatchObject({ out: [], reports: [{ name: "Scorer" }] });
  });
  test("a brief that can't be read is a failed write too: the scout stays out with the failure kept, and is tried again", async () => {
    silenceConsoleError();
    const ann = await as(ANN);
    await ann.send(SCORER.code);
    // His club's row gone: the brief throws reading it.
    const club = await t.run(async (ctx) => {
      const player = (await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", SCORER.code)).unique())!;
      const held = (await ctx.db.query("clubs").withIndex("by_code", (q) => q.eq("code", player.clubCode)).unique())!;
      await ctx.db.delete("clubs", held._id);
      const { _id, _creationTime, ...row } = held;
      return row;
    });
    await dayPasses();
    expect((await ann.mine())?.out).toHaveLength(1);
    expect((await t.run((ctx) => ctx.db.query("scouts").collect()))[0].lastFailure).toBeDefined();

    await t.run((ctx) => ctx.db.insert("clubs", club));
    await elapse(t, CLAUDE_RETRY_MS);
    expect(await ann.mine()).toMatchObject({ out: [], reports: [{ name: "Scorer" }] });
  });
});

describe("no other team can tell whom a manager scouts", () => {
  test("another manager sees none of his scouts or reports", async () => {
    await (await as(ANN)).send(SCORER.code);
    const bob = await as(BOB);
    expect(await bob.mine()).toEqual({ scouts: 3, out: [], reports: [] });
    await dayPasses();
    expect(await bob.mine()).toEqual({ scouts: 3, out: [], reports: [] });
    expect(await bob.onPlayer(SCORER.code)).toEqual([]);
  });

  test("another manager can send his own scout to the same player", async () => {
    await (await as(ANN)).send(SCORER.code);
    await (await as(BOB)).send(SCORER.code);
    expect((await (await as(BOB)).mine())?.out.map((scout) => scout.name)).toEqual(["Scorer"]);
  });
});
