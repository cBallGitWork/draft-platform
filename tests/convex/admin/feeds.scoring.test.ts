// The feeds page's scoring (#35; spec/15 The admin, spec/07 Match stats): the matches whose
// scoring is behind, still provisional when their correction window closed, and the stat
// corrections that arrived after a match's points locked.

import { expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { BEHIND_SHOWN, CORRECTIONS_SHOWN } from "../../../convex/admin/feeds";
import { HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { feedsAt, holdMatch, holdStatus, T0 } from "../../support/convex/feeds.harness";
import { freshConvex, type TestConvex } from "../../support/convex/test.harness";

/** The correction window until the admin sets one (spec/07). */
const WINDOW = HOUR_MS;

test("a match still provisional when its window closes is behind, and not before", async () => {
  const t = freshConvex();
  await holdMatch(t, 1, T0 - 2 * HOUR_MS);
  await holdStatus(t, 1, T0);

  expect((await feedsAt(t, T0 + WINDOW)).behind).toEqual([]);
  expect(await feedsAt(t, T0 + WINDOW + 1)).toMatchObject({
    behind: [{ fixtureCode: 1, match: { home: "Hull City", away: "Everton" }, fullTimeAt: T0 }],
    moreBehind: false,
  });
});

test("a match behind is judged by the admin's own window", async () => {
  const t = freshConvex();
  await holdStatus(t, 1, T0);
  await t.mutation(internal.admin.platformSettings.setStatCorrectionWindow, { minutes: 90 });

  expect((await feedsAt(t, T0 + 90 * MINUTE_MS)).behind).toEqual([]);
  expect((await feedsAt(t, T0 + 90 * MINUTE_MS + 1)).behind).toHaveLength(1);
});

test("a complete match is not behind, and one the football sync doesn't hold is named by none", async () => {
  const t = freshConvex();
  await holdStatus(t, 1, T0, "complete");
  await holdStatus(t, 2, T0);

  expect((await feedsAt(t, T0 + 2 * HOUR_MS)).behind).toEqual([{ fixtureCode: 2, match: null, fullTimeAt: T0 }]);
});

test("past the most the page lists, it lists the longest behind and says more are", async () => {
  const t = freshConvex();
  for (let code = 1; code <= BEHIND_SHOWN + 1; code += 1) await holdStatus(t, code, T0 + code * MINUTE_MS);

  const { behind, moreBehind } = await feedsAt(t, T0 + 3 * HOUR_MS);
  expect(behind.map((match) => match.fixtureCode)).toEqual(Array.from({ length: BEHIND_SHOWN }, (_, index) => index + 1));
  expect(moreBehind).toBe(true);
});

function recordCorrection(t: TestConvex, fixtureCode: number, playerCode: number, seenAt: number) {
  return t.run((ctx) =>
    ctx.db.insert("lateStatCorrections", { fixtureCode, playerCode, seenAt, changes: [{ stat: "assists", locked: 1, sent: 0 }] }),
  );
}

test("a correction after the lock shows the player, the match, and the stat as locked and as sent", async () => {
  const t = freshConvex();
  await holdMatch(t, 1, T0 - 4 * HOUR_MS);
  await t.run((ctx) => ctx.db.insert("players", { code: 7, name: "Ndiaye", fullName: "Iliman Ndiaye", clubCode: 11 }));
  await recordCorrection(t, 1, 7, T0);

  expect((await feedsAt(t, T0)).corrections).toEqual([
    {
      fixtureCode: 1,
      match: { home: "Hull City", away: "Everton" },
      playerCode: 7,
      player: "Ndiaye",
      seenAt: T0,
      changes: [{ stat: "assists", locked: 1, sent: 0 }],
    },
  ]);
});

test("the newest corrections show first, as many as the page lists", async () => {
  const t = freshConvex();
  for (let index = 0; index <= CORRECTIONS_SHOWN; index += 1) await recordCorrection(t, 1, index, T0 + index * MINUTE_MS);

  const { corrections, moreCorrections } = await feedsAt(t, T0 + HOUR_MS);
  expect(corrections).toHaveLength(CORRECTIONS_SHOWN);
  expect(corrections[0]).toMatchObject({ playerCode: CORRECTIONS_SHOWN, player: null, match: null });
  expect(moreCorrections).toBe(true);
});

test("as many corrections as the page lists, and no more, says nothing of more", async () => {
  const t = freshConvex();
  for (let index = 0; index < CORRECTIONS_SHOWN; index += 1) await recordCorrection(t, 1, index, T0 + index * MINUTE_MS);
  expect((await feedsAt(t, T0 + HOUR_MS)).moreCorrections).toBe(false);
});
