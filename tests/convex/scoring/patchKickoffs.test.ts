import { beforeEach, describe, expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { DAY_MS, HOUR_MS } from "../../../convex/shared/time";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { pendingJobs } from "../../support/convex/test.harness";
import { ADMIN } from "../../support/convex/leagues.harness";
import { EDITED, EDITED_AGAIN, fixAs, inGameweek, kickoffOf, patch, siteDeadlineOf, t, useSiteScoringDeployment, viewAs } from "../../support/convex/siteScoring.harness";

// What an announced patch does when its gameweek's schedule changes (Craig, 1 Nov 2026, on #901):
// a first kickoff moving later takes the patch's start with it (earlier too, 9 Nov 2026, on #1304),
// and a gameweek with no kickoff time yet plays the rules in force, never a patch still waiting.

useSiteScoringDeployment();

const GAMEWEEK = 10;
/** holdGameweeks codes each gameweek's one match with its number. */
const opener = (gameweek: number, kickoff: number | null) => ({ code: gameweek, gameweek, homeClubCode: 1, awayClubCode: 2, kickoff });
const moveOpener = (gameweek: number, kickoff: number | null) =>
  t.mutation(internal.football.footballSync.upsertFixtures, { rows: [opener(gameweek, kickoff)] });
const takesEffectAt = async () => (await viewAs(ADMIN)).versions.map((version) => version.takesEffectAt);
const refreshTimes = async () => (await pendingJobs(t, internal.stars.starsRefresh.refreshAll)).map((job) => job.scheduledTime);

beforeEach(() => holdGameweeks(t, { next: 9 }));

describe("a waiting patch whose gameweek's first kickoff moves", () => {
  test("#901 Done: later, moves with it, and its gameweek still plays it", async () => {
    await patch(EDITED, siteDeadlineOf(GAMEWEEK));
    const later = siteDeadlineOf(GAMEWEEK) + DAY_MS;

    await moveOpener(GAMEWEEK, kickoffOf(GAMEWEEK) + DAY_MS);

    expect(await takesEffectAt()).toEqual([later]);
    expect((await viewAs(ADMIN)).versions[0]).toMatchObject({ fromGameweek: GAMEWEEK });
    expect(await inGameweek(GAMEWEEK - 1)).toEqual(FIRST_SCORING);
    expect(await inGameweek(GAMEWEEK)).toEqual(EDITED);
    expect(await refreshTimes()).toEqual([siteDeadlineOf(GAMEWEEK), later]);
  });

  test("#1304 Done: earlier, moves with it, so the brought-forward match is the first scored under it (S14.26)", async () => {
    await patch(EDITED, siteDeadlineOf(GAMEWEEK));
    const earlier = siteDeadlineOf(GAMEWEEK) - DAY_MS;

    await moveOpener(GAMEWEEK, kickoffOf(GAMEWEEK) - DAY_MS);

    expect(await takesEffectAt()).toEqual([earlier]);
    expect(await inGameweek(GAMEWEEK - 1)).toEqual(FIRST_SCORING);
    expect(await inGameweek(GAMEWEEK)).toEqual(EDITED);
    expect(await refreshTimes()).toEqual([siteDeadlineOf(GAMEWEEK), earlier]);
  });

  test("earlier than the patch before it, moves no further than it, so the two keep their order", async () => {
    await patch(EDITED, siteDeadlineOf(GAMEWEEK));
    await patch(EDITED_AGAIN, siteDeadlineOf(GAMEWEEK + 1));

    await moveOpener(GAMEWEEK + 1, kickoffOf(GAMEWEEK) - DAY_MS);

    expect(await takesEffectAt()).toEqual([siteDeadlineOf(GAMEWEEK), siteDeadlineOf(GAMEWEEK)]);
  });

  test("later than the next patch's moment, moves no further than it, so the two keep their order", async () => {
    await patch(EDITED, siteDeadlineOf(GAMEWEEK));
    await patch(EDITED_AGAIN, siteDeadlineOf(GAMEWEEK + 1));

    await moveOpener(GAMEWEEK, kickoffOf(GAMEWEEK + 1) + DAY_MS);

    expect(await takesEffectAt()).toEqual([siteDeadlineOf(GAMEWEEK + 1), siteDeadlineOf(GAMEWEEK + 1)]);
    expect(await inGameweek(GAMEWEEK + 1)).toEqual(EDITED_AGAIN);
  });

  test("announced at a moment no gameweek starts at, it has no gameweek to follow", async () => {
    const between = siteDeadlineOf(GAMEWEEK) - HOUR_MS;
    await patch(EDITED, between);

    await moveOpener(GAMEWEEK, kickoffOf(GAMEWEEK) + DAY_MS);

    expect(await takesEffectAt()).toEqual([between]);
  });

  test("dropped from the feed, the gameweek's next match is its first kickoff, and the patch follows its deadline", async () => {
    await t.mutation(internal.football.footballSync.upsertFixtures, { rows: [{ ...opener(GAMEWEEK, kickoffOf(GAMEWEEK) + DAY_MS), code: 100 }] });
    await patch(EDITED, siteDeadlineOf(GAMEWEEK));
    const heldCodes = await t.run(async (ctx) => (await ctx.db.query("fixtures").collect()).map(({ code }) => code));

    await t.mutation(internal.football.footballSync.markDropped, {
      table: "fixtures",
      sentKeys: heldCodes.filter((code) => code !== GAMEWEEK),
      droppedAt: Date.now(),
      paginationOpts: { numItems: heldCodes.length, cursor: null },
    });

    expect(await takesEffectAt()).toEqual([siteDeadlineOf(GAMEWEEK) + DAY_MS]);
  });
});

describe("a gameweek with no kickoff time yet", () => {
  test("#901 Done: plays the rules in force while a patch waits, not the patch", async () => {
    await patch(EDITED, siteDeadlineOf(GAMEWEEK));

    await moveOpener(GAMEWEEK + 1, null);

    expect(await inGameweek(GAMEWEEK + 1)).toEqual(FIRST_SCORING);
    expect(await inGameweek(GAMEWEEK + 2)).toEqual(EDITED);
  });

  test("plays a fix made since the last gameweek began", async () => {
    await fixAs(ADMIN, EDITED);

    await moveOpener(GAMEWEEK + 1, null);

    expect(await inGameweek(GAMEWEEK + 1)).toEqual(EDITED);
  });
});
