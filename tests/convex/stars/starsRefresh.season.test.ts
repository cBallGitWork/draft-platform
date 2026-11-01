import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Position } from "../../../convex/positions/positionTables";
import { ratedRoles, STARS_WINDOW } from "../../../convex/stars/stars";
import { PLAYERS_PAGE } from "../../../convex/stats/matchRecords";
import { ARSENAL, CHELSEA, insertClubs, insertPlayers } from "../../support/convex/footballRows.harness";
import { insertMatch, lockedRecord, refreshesRun, starsRows } from "../../support/convex/stars.harness";
import { freshConvex, ROWS_TO_THE_CAP } from "../../support/convex/test.harness";

// Stars refreshed at a season's size (#11, starsRefresh.ts): a full page of players and a match's
// 40 players, each with a season of final matches and every outfield role, so a blow-up in time
// or reads shows here. Convex's own time limit on a deployment is unmeasured.

beforeEach(() => vi.useFakeTimers());

/** Every outfield area: a wing-back plays defence and both midfield rows, a shadow striker
 *  attacking midfield and attack. */
const EVERY_OUTFIELD_AREA: Position[] = ["WB", "SS"];
/** A match's two squads. */
const MATCH_PLAYERS = 40;

test(
  `a match's ${MATCH_PLAYERS} players, each with ${STARS_WINDOW} matches and every outfield role, are refreshed in full pages of ${PLAYERS_PAGE} and on a lock`,
  ROWS_TO_THE_CAP,
  async () => {
    const t = freshConvex();
    const codes = Array.from({ length: MATCH_PLAYERS }, (_, index) => 4000 + index);
    await t.run(async (ctx) => {
      await insertClubs(ctx, [ARSENAL, CHELSEA]);
      await insertPlayers(
        ctx,
        codes.map((code) => ({ code, name: `P${code}`, fullName: `P${code}`, clubCode: ARSENAL.code, positions: EVERY_OUTFIELD_AREA })),
      );
      for (let index = 0; index < STARS_WINDOW; index += 1) {
        const fixtureCode = 600 + index;
        await insertMatch(ctx, fixtureCode, index);
        for (const [rank, code] of codes.entries()) {
          await ctx.db.insert("playerMatchStats", lockedRecord(code, fixtureCode, { minutes: 90, goals_scored: rank % 3, assists: index % 2, won_tackle: rank % 5 }));
        }
      }
    });

    await t.mutation(internal.stars.starsRefresh.refreshAll, { cursor: null });
    await refreshesRun(t);
    await t.mutation(internal.stars.starsRefresh.refreshMatch, { fixtureCode: 600 });
    await refreshesRun(t);

    const rows = await starsRows(t);
    expect(rows.size).toBe(MATCH_PLAYERS);
    for (const row of rows.values()) {
      expect(row.matches).toBe(STARS_WINDOW);
      expect(row.ratings).toHaveLength(ratedRoles(EVERY_OUTFIELD_AREA).length);
      expect(row.ratings.every((rating) => typeof rating.stars === "number")).toBe(true);
    }
  },
);
