import { beforeEach, expect, test } from "vitest";
import { lastSeasonPoints } from "../../../convex/draft/lastSeasonPoints";
import { positionsNow } from "../../../convex/positions/playerPositions";
import { EVERY_LEAGUE } from "../../../convex/positions/positionSettings";
import { ARSENAL, insertClubs, insertPlayers, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { freshConvex, type TestConvex } from "../../support/convex/test.harness";

// Last season's points auto-pick falls back on (#1094), read from the re-priced rows (#1114): at
// each player's main position now, as his card opens on (spec/19).

const player = (code: number, positions: HeldPlayer["positions"]): HeldPlayer => ({ code, name: `P${code}`, fullName: `P${code}`, clubCode: ARSENAL.code, positions });

let t: TestConvex;
const read = async () => new Map(await t.run(async (ctx) => [...(await lastSeasonPoints(ctx, await positionsNow(ctx, EVERY_LEAGUE)))]));
const keep = (season: number, playerCode: number, points: Record<string, number>) =>
  t.run((ctx) => ctx.db.insert("pastSeasonPoints", { season, playerCode, points }));

beforeEach(async () => {
  t = freshConvex();
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL]);
    await insertPlayers(ctx, [player(1, ["CAM", "ST"]), player(2, ["CB"]), player(3, [])]);
  });
});

test("reads each player at his main position, one with no points there on 0, and leaves newcomers out", async () => {
  await keep(2025, 1, { CAM: 120, ST: 90 });
  await keep(2025, 2, {});
  await keep(2025, 3, { ST: 40 });
  expect(await read()).toEqual(
    new Map([
      [1, 120],
      [2, 0],
      [3, 0],
    ]),
  );
});

test("reads the newest season priced", async () => {
  await keep(2024, 1, { CAM: 300 });
  await keep(2025, 2, { CB: 50 });
  expect(await read()).toEqual(new Map([[2, 50]]));
});

test("with nothing priced, everyone is a newcomer", async () => {
  expect(await read()).toEqual(new Map());
});
