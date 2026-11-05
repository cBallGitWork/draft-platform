// Warning a manager when one of his players is losing a position (#23; spec/06, When positions
// change), as Craig answered on #23 (5 Nov 2026): a Mail letter to whoever owns him in each league,
// one when he is flagged and one when he loses it, each naming the position and the gameweek it
// counts from; the admin's removal by hand sends the same; and he stays in his slot.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { pickFirstLineupAgain, lineupInGameweek } from "../../../convex/lineup/lineups";
import { positionLetter } from "../../../convex/positions/positionWarnings";
import type { Start } from "../../../convex/positions/positions";
import { DAY_MS, HOUR_MS, WEEK_MS } from "../../../convex/shared/time";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { addManager, addManagers, adminCreatesLeague, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { asAdmin } from "../../support/convex/positionsSync.harness";
import { CENTRE_BACK, movedToFullBack, played, RIGHT_BACK, startsFrom, times } from "../../support/convex/positionStarts.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

const [ANN, BOB] = MANAGERS;
/** The gameweek a lineup saved now is from: every one before it has begun. */
const NEXT = 9;
const BARNES = { code: 1, name: "Barnes", fullName: "Harvey Barnes", clubCode: 4 };

let t: TestConvex;
let leagueId: Id<"leagues">;
let annsTeam: Id<"teams">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: NEXT });
  leagueId = await adminCreatesLeague(t);
  annsTeam = await addManager(t, leagueId, ANN);
  await t.run(async (ctx) => {
    await ctx.db.insert("clubs", { code: BARNES.clubCode, name: "Newcastle", shortName: "NEW" });
    await ctx.db.insert("players", BARNES);
  });
});

/** Barnes on `teamId`, CB and FB approved, having started `starts`. */
async function barnesOn(teamId: Id<"teams">, starts: Start[]) {
  await t.run(async (ctx) => {
    const team = (await ctx.db.get("teams", teamId))!;
    await ctx.db.insert("squadPlayers", { leagueId: team.leagueId, teamId, playerCode: BARNES.code });
    const row = await ctx.db.query("playerPositions").withIndex("by_code", (q) => q.eq("code", BARNES.code)).unique();
    if (row === null) await ctx.db.insert("playerPositions", { code: BARNES.code, starts, approved: ["CB", "FB"], set: [], removed: [] });
  });
}

const barnesStarted = (starts: Start[]) =>
  t.run(async (ctx) => {
    const row = await ctx.db.query("playerPositions").withIndex("by_code", (q) => q.eq("code", BARNES.code)).unique();
    await ctx.db.patch("playerPositions", row!._id, { starts });
  });

/** A good positions sync recorded now, as the sync records one: it warns of what changed. */
const syncRecorded = () =>
  t.mutation(internal.positions.positionsSync.record, {
    trigger: "manual",
    ranAt: Date.now(),
    outcome: {
      ok: true,
      matchesRead: 0,
      matchesLeft: 0,
      matchesRefused: [],
      startsAdded: 0,
      unmatchedPlayers: 0,
      labelsReceived: 0,
      labelsChanged: 0,
      unknownFormations: [],
      unknownLabels: [],
    },
  });

/** Each letter to `email` about Barnes, oldest first, as subject, body and league. */
const lettersTo = (email: string) =>
  t.run(async (ctx) =>
    (await ctx.db.query("letters").withIndex("by_to_and_at", (q) => q.eq("to", email)).collect())
      .filter(({ subject }) => subject.startsWith("Barnes"))
      .map(({ subject, body, leagueId: from }) => ({ subject, body, leagueId: from })),
  );

const flagged = (startsElsewhere: number, fromGameweek = NEXT) =>
  positionLetter({ step: "flagged", playerName: "Barnes", position: "CB", fromGameweek, startsElsewhere, removeAfter: 6 });
const lost = (fromGameweek = NEXT) => positionLetter({ step: "lost", playerName: "Barnes", position: "CB", fromGameweek, removeAfter: 6 });

describe("the letters", () => {
  test("name the player, the position and the gameweek it counts from", () => {
    expect(flagged(3)).toEqual({
      subject: "Barnes may lose CB",
      body: "From gameweek 9, Barnes is flagged at CB: his last 3 starts in a row were elsewhere. After 6 in a row he loses CB; a start there keeps it.",
    });
    expect(lost()).toEqual({
      subject: "Barnes has lost CB",
      body:
        "From gameweek 9, Barnes no longer plays CB: he has started 6 matches in a row elsewhere. " +
        "He stays where he stands in your lineup until you move him, and the lineup check shows him out of position.",
    });
    expect(positionLetter({ step: "takenByAdmin", playerName: "Barnes", position: "CB", fromGameweek: 9 }).body).toBe(
      "The admin took CB away from Barnes, from gameweek 9. He stays where he stands in your lineup until you move him, and the lineup check shows him out of position.",
    );
  });
});

describe("a run elsewhere", () => {
  test("flagged after 3 sends his manager a letter, once however many syncs follow", async () => {
    await barnesOn(annsTeam, movedToFullBack(3));

    await syncRecorded();
    await syncRecorded();

    expect(await lettersTo(ANN)).toEqual([{ ...flagged(3), leagueId }]);
  });

  test("lost after 6 sends a second letter, and a start back at the position lets both be told again", async () => {
    await barnesOn(annsTeam, movedToFullBack(4));
    await syncRecorded();
    await barnesStarted(movedToFullBack(6));
    await syncRecorded();
    expect((await lettersTo(ANN)).map(({ subject }) => subject)).toEqual(["Barnes may lose CB", "Barnes has lost CB"]);

    await barnesStarted(played(...times(CENTRE_BACK, 5), ...times(RIGHT_BACK, 6), CENTRE_BACK));
    await syncRecorded();
    await barnesStarted(played(...times(CENTRE_BACK, 5), ...times(RIGHT_BACK, 6), CENTRE_BACK, ...times(RIGHT_BACK, 3)));
    await syncRecorded();

    expect((await lettersTo(ANN)).map(({ subject }) => subject)).toEqual(["Barnes may lose CB", "Barnes has lost CB", "Barnes may lose CB"]);
  });

  test("is told to whoever owns him in each league, and to nobody for a free agent or a team with no manager", async () => {
    const otherLeague = await adminCreatesLeague(t, 4, "Other League");
    const [bobsTeam] = await addManagers(t, otherLeague, [BOB]);
    const thirdLeague = await adminCreatesLeague(t, 4, "Third League");
    const managerless = await t.run((ctx) => ctx.db.insert("teams", { leagueId: thirdLeague, number: 1, name: "Vacated" }));
    await barnesOn(annsTeam, movedToFullBack(3));
    await barnesOn(bobsTeam, movedToFullBack(3));
    await barnesOn(managerless, movedToFullBack(3));

    await syncRecorded();

    expect(await lettersTo(ANN)).toEqual([{ ...flagged(3), leagueId }]);
    expect(await lettersTo(BOB)).toEqual([{ ...flagged(3), leagueId: otherLeague }]);
  });

  test("a manager who takes over a team with no manager is told what already stands", async () => {
    const managerless = await t.run((ctx) => ctx.db.insert("teams", { leagueId, number: 2, name: "Vacated" }));
    await barnesOn(managerless, movedToFullBack(3));
    await syncRecorded();
    await t.run((ctx) => ctx.db.patch("teams", managerless, { managerEmail: BOB }));

    await syncRecorded();

    expect(await lettersTo(BOB)).toEqual([{ ...flagged(3), leagueId }]);
  });

  test("a new owner is told what his player's last owner was", async () => {
    const bobsTeam = await addManager(t, leagueId, BOB);
    await barnesOn(annsTeam, movedToFullBack(3));
    await syncRecorded();
    await t.run(async (ctx) => {
      const place = await ctx.db.query("squadPlayers").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("playerCode", BARNES.code)).unique();
      await ctx.db.patch("squadPlayers", place!._id, { teamId: bobsTeam });
    });

    await syncRecorded();

    expect(await lettersTo(BOB)).toEqual([{ ...flagged(3), leagueId }]);
  });

  test("the admin tuning the thresholds warns of what they flag", async () => {
    await barnesOn(annsTeam, movedToFullBack(2));
    await syncRecorded();
    expect(await lettersTo(ANN)).toEqual([]);

    await (await asAdmin(t)).mutation(api.positions.positionSettings.setChangeThresholds, { flagAfter: 2, removeAfter: 4 });

    expect(await lettersTo(ANN)).toEqual([{ ...positionLetter({ step: "flagged", playerName: "Barnes", position: "CB", fromGameweek: NEXT, startsElsewhere: 2, removeAfter: 4 }), leagueId }]);
  });
});

describe("only between gameweeks", () => {
  test("starts since the league's last deadline warn of nothing until the next has passed, and count from the gameweek after it", async () => {
    // Centre back and full back in turn long ago, then three more at full back since gameweek 8's
    // deadline, a day and a half ago (holdGameweeks: gameweek 9's falls in six days, less FPL's 90
    // minutes).
    const sinceLastDeadline = Date.now() - 12 * HOUR_MS;
    const inTurn = [CENTRE_BACK, RIGHT_BACK, CENTRE_BACK, RIGHT_BACK, CENTRE_BACK, RIGHT_BACK];
    await barnesOn(annsTeam, [...played(...inTurn), ...startsFrom(sinceLastDeadline / DAY_MS, ...times(RIGHT_BACK, 3))]);

    await syncRecorded();
    expect(await lettersTo(ANN)).toEqual([]);

    vi.setSystemTime(Date.now() + WEEK_MS);
    await syncRecorded();

    expect(await lettersTo(ANN)).toEqual([{ ...flagged(4, NEXT + 1), leagueId }]);
  });
});

describe("the admin removing a position by hand", () => {
  test("sends his manager the same warning, and he keeps his slot in the lineup", async () => {
    await barnesOn(annsTeam, played(...times(CENTRE_BACK, 5)));
    await t.run((ctx) => pickFirstLineupAgain(ctx, leagueId, annsTeam));
    const before = await t.run((ctx) => lineupInGameweek(ctx, leagueId, annsTeam, NEXT));
    expect(before.starters.map(({ playerCode }) => playerCode)).toContain(BARNES.code);

    await (await asAdmin(t)).mutation(api.positions.playerPositions.removePosition, { code: BARNES.code, position: "CB" });

    expect(await lettersTo(ANN)).toEqual([{ ...positionLetter({ step: "takenByAdmin", playerName: "Barnes", position: "CB", fromGameweek: NEXT }), leagueId }]);
    expect(await t.run((ctx) => lineupInGameweek(ctx, leagueId, annsTeam, NEXT))).toEqual(before);
  });

  test("tells nobody when he didn't hold it", async () => {
    await barnesOn(annsTeam, played(...times(CENTRE_BACK, 5)));

    await (await asAdmin(t)).mutation(api.positions.playerPositions.removePosition, { code: BARNES.code, position: "ST" });

    expect(await lettersTo(ANN)).toEqual([]);
  });
});
