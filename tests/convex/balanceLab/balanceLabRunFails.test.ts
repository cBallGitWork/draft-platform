import { expect, test, vi } from "vitest";
import { ADMIN } from "../../support/convex/leagues.harness";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { silenceConsoleError } from "../../support/convex/test.harness";
import { announceAs, kickoffOf, saveDraftAs, t, useSiteScoringDeployment } from "../../support/convex/siteScoring.harness";
import { withShotStopper } from "../../support/convex/scoring.example";

// The lab's run after Announce failing (spec/14; #843, pr-reviewer's finding): the patch notes then
// lack the report, so the run says which patch in the logs rather than failing silently. Its own
// file, since the lab is mocked to fail here.

vi.mock("../../../convex/balanceLab/balanceLab", async (original) => ({
  ...(await original<typeof import("../../../convex/balanceLab/balanceLab")>()),
  balanceLab: () => {
    throw new Error("the lab broke");
  },
}));

useSiteScoringDeployment();

test("an announced patch's lab that fails says so in the logs, naming the patch", async () => {
  const logged = silenceConsoleError();
  await holdGameweeks(t, { next: 9 });
  await saveDraftAs(ADMIN, withShotStopper([2, 4, 6]));
  await announceAs(ADMIN, kickoffOf(10));
  const versionId = await t.run(async (ctx) => (await ctx.db.query("siteScoring").order("desc").first())!._id);

  vi.advanceTimersByTime(1);
  await t.finishInProgressScheduledFunctions();

  expect(logged).toHaveBeenCalledWith(
    `The rule balance lab didn't run on announced patch ${versionId}, so its patch notes have no lab report:`,
    expect.objectContaining({ message: "the lab broke" }),
  );
  expect((await t.run((ctx) => ctx.db.get("siteScoring", versionId)))?.lab).toBeUndefined();
});
