import { describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import { siteScoringRefusals } from "../../../convex/scoring/siteScoring";
import { ARSENAL, insertPlayers } from "../../support/convex/footballRows.harness";
import { ADMIN } from "../../support/convex/leagues.harness";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { withShotStopper } from "../../support/convex/scoring.example";
import { expectRefused } from "../../support/convex/test.harness";
import { announceAs, as, draftSavedAt, kickoffOf, saveDraftAs, t, useSiteScoringDeployment } from "../../support/convex/siteScoring.harness";

// Running the rule balance lab (spec/14; #843): the admin's button on the draft patch, which saves
// nothing, and the run by itself on Announce, kept with the patch for its notes.

useSiteScoringDeployment();

/** Two keepers' starts in 2024/25, one copied with his club and one before clubs were (#1541), a
 *  sub's match, a start at a position that maps to no slot by a man today's players table still
 *  holds, and one by a man with no FPL code, kept under his person id (S14.24). */
const holdPastSeason = () =>
  t.run(async (ctx) => {
    const row = (playerCode: number, kickoff: number, startingPosition: string | null, stats: Record<string, number>, club?: string) =>
      ctx.db.insert("pastPlayerMatchStats", { season: 2024, playerCode, fplPosition: 1, match: { kickoff, ...(club === undefined ? {} : { club }), startingPosition, stats } });
    await row(1, 1, "GK", { saves: 2, goals_conceded: 0 }, "Leeds");
    await row(2, 1, "GK", { saves: 6, goals_conceded: 1 });
    await row(3, 2, null, { saves: 9, goals_conceded: 0 });
    await row(4, 2, "SW", { saves: 9, goals_conceded: 0 });
    await insertPlayers(ctx, [{ code: 4, name: "Sweeper", fullName: "Sam Sweeper", clubCode: ARSENAL.code, positions: ["CB"] }]);
    await ctx.db.insert("pastPlayerMatchStats", { season: 2024, person: "no-code-eight", match: { kickoff: 3, club: "Leeds", startingPosition: "SW", stats: {} } });
  });

/** The two starters flagged with no position: the one today's list holds by his name, the one with
 *  no FPL code by his person id. */
const NO_POSITION = {
  count: 2,
  first: [
    { name: "Sam Sweeper", kickoff: 2 },
    { name: "Person no-code-eight", club: "Leeds", kickoff: 3 },
  ],
};

const runAs = async (email: string, savedAt: number) => (await as(email)).action(api.balanceLab.balanceLabRun.run, { draftSavedAt: savedAt });
const everything = () =>
  t.run(async (ctx) => ({ versions: await ctx.db.query("siteScoring").collect(), draft: await ctx.db.query("siteScoringDraft").collect() }));

describe("the admin's button on the draft patch", () => {
  test("runs the lab on the saved draft over the past seasons' starts, and saves nothing", async () => {
    await holdPastSeason();
    await saveDraftAs(ADMIN, withShotStopper([2, 4, 6]));
    const before = await everything();

    const report = await runAs(ADMIN, (await draftSavedAt())!);

    // +1 and +3 over the two keepers' starts; the sub's match isn't a start. Leeds' keeper alone
    // makes an XI, short of ten starters; the sweeper with no FPL code is in no XI, as the pitch
    // has no place for his position.
    expect(report).toEqual({
      seasons: [2024],
      noPosition: NO_POSITION,
      starts: 2,
      startsSkipped: 2,
      roles: [{ role: "shotStopper", slot: "GK", target: 0.9, starts: 2, average: 2, offTarget: true }],
      instructions: [],
      xis: 1,
      xisShort: 1,
    });
    expect(await everything()).toEqual(before);
  });

  test("is refused on a draft saved over since", async () => {
    await saveDraftAs(ADMIN, withShotStopper([2, 4, 6]));
    const savedAt = (await draftSavedAt())!;
    vi.setSystemTime(Date.now() + 1000);
    await saveDraftAs(ADMIN, withShotStopper([3, 4, 6]));

    await expectRefused(runAs(ADMIN, savedAt), siteScoringRefusals.draftChangedSince(savedAt + 1000, undefined));
  });

  test("is refused with no draft", async () => {
    await expectRefused(runAs(ADMIN, 0), siteScoringRefusals.noDraft);
  });
});

test("an announced patch's lab runs by itself on exactly its set, and its report reaches the patch notes", async () => {
  await holdGameweeks(t, { next: 9 });
  await holdPastSeason();
  await saveDraftAs(ADMIN, withShotStopper([4, 6, 8]));
  await announceAs(ADMIN, kickoffOf(10));

  vi.advanceTimersByTime(1);
  await t.finishInProgressScheduledFunctions();

  const [notes] = await (await as(ADMIN)).query(api.scoring.patchNotes.notes, {});
  // 0 and +2 over the two keepers' starts.
  expect(notes.lab).toEqual({ seasons: [2024], noPosition: NO_POSITION, starts: 2, startsSkipped: 2, roles: [{ role: "shotStopper", slot: "GK", target: 0.9, starts: 2, average: 1, offTarget: false }], instructions: [], xis: 1, xisShort: 1 });
});
