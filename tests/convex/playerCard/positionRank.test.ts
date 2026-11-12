import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { SlotPosition } from "../../../convex/lineup/pitch";
import { rankOfPlayer } from "../../../convex/playerCard/cardPoints";
import { POSITIONS, type Position } from "../../../convex/positions/positionTables";
import { CHELSEA, insertPlayers } from "../../support/convex/footballRows.harness";
import { actingAs, OUTSIDER } from "../../support/convex/leagues.harness";
import { keepEveryScoutingPlayer } from "../../support/convex/playersList.harness";
import { ANN, PALMER, RICE, SAKA, seasonPointsLeague, type PointsLeague } from "../../support/convex/seasonPoints.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { refusals } from "../../../convex/shared/leagueAccess";
import { SCOUTING_REBUILD_COMMAND } from "../../../convex/scouting/scoutingPlayers";

// His rank at the position the card's switch is on (spec/12 S12.1; Craig, 9 Nov 2026, on #1027):
// by base points this season against every player holding that position, owned or free, as
// Scouting totals them, ties sharing a place ("4th of 112 MID"). Before the new season's first match
// is priced, Scouting's points are last season's (shownSeasonPoints.ts), which these tests hold.

const LAST_SEASON = 2025;
const everywhere = (points: number) => Object.fromEntries(POSITIONS.map((position) => [position, points]));
/** Two more Chelsea attacking midfielders, one with no points held. */
const ENZO = { code: 1010, name: "Enzo", fullName: "Enzo Fernandez", clubCode: CHELSEA.code, positions: ["CAM"] as Position[] };
const NEWCOMER = { code: 1011, name: "New", fullName: "New Comer", clubCode: CHELSEA.code, positions: ["CAM", "W"] as Position[] };
/** A Chelsea centre-back and centre-mid, between Rice's two figures. */
const STONES = { code: 1012, name: "Stones", fullName: "John Stones", clubCode: CHELSEA.code, positions: ["CB", "CM"] as Position[] };

let league: PointsLeague;
beforeEach(async () => {
  league = await seasonPointsLeague();
  await league.t.run(async (ctx) => {
    await insertPlayers(ctx, [ENZO, NEWCOMER, STONES]);
    await ctx.db.insert("pastSeasonPoints", { season: LAST_SEASON, playerCode: STONES.code, points: everywhere(150) });
    // Palmer and Enzo tie at CAM; Saka is a W, Rice a CM and CB, on more at CB than at CM.
    await ctx.db.insert("pastSeasonPoints", { season: LAST_SEASON, playerCode: PALMER.code, points: everywhere(120) });
    await ctx.db.insert("pastSeasonPoints", { season: LAST_SEASON, playerCode: ENZO.code, points: everywhere(120) });
    await ctx.db.insert("pastSeasonPoints", { season: LAST_SEASON, playerCode: SAKA.code, points: everywhere(150) });
    await ctx.db.insert("pastSeasonPoints", { season: LAST_SEASON, playerCode: RICE.code, points: { ...everywhere(100), CB: 180 } });
  });
});

const rank = async (playerCode: number, position: SlotPosition) => {
  await keepEveryScoutingPlayer(league.t);
  return (await actingAs(league.t, ANN)).query(api.playerCard.positionRank.atPosition, { leagueId: league.leagueId, playerCode, position });
};

test("he is ranked among every player holding the position, owned or free, ties sharing the higher place", async () => {
  expect(await rank(PALMER.code, "CAM")).toEqual({ place: 1, of: 3 });
  expect(await rank(ENZO.code, "CAM")).toEqual({ place: 1, of: 3 });
  // Saka, owned, at W: the newcomer holds W too.
  expect(await rank(SAKA.code, "W")).toEqual({ place: 1, of: 2 });
});

test("a player with no points held has no place, but counts among those holding the position", async () => {
  expect(await rank(NEWCOMER.code, "CAM")).toEqual({ place: null, of: 3 });
});

test("a two-position player is ranked on his points at the position asked", async () => {
  expect(await rank(RICE.code, "CB")).toEqual({ place: 1, of: 2 });
  expect(await rank(RICE.code, "CM")).toEqual({ place: 2, of: 2 });
  // At a position he doesn't hold, he isn't ranked.
  expect(await rank(RICE.code, "CAM")).toEqual({ place: null, of: 3 });
});

test("with no Scouting row held, the rank says to copy them rather than show none of a position", async () => {
  const asAnn = await actingAs(league.t, ANN);
  await expect(asAnn.query(api.playerCard.positionRank.atPosition, { leagueId: league.leagueId, playerCode: PALMER.code, position: "CAM" })).rejects.toThrow(
    SCOUTING_REBUILD_COMMAND,
  );
});

test("anyone not in the league is refused", async () => {
  await expectRefused((await actingAs(league.t, OUTSIDER)).query(api.playerCard.positionRank.atPosition, { leagueId: league.leagueId, playerCode: PALMER.code, position: "CAM" }), refusals.notInLeague);
});

test("a place is one more than how many have more points", () => {
  const players = [
    { code: 1, points: 30 },
    { code: 2, points: 50 },
    { code: 3, points: 30 },
    { code: 4, points: 10 },
    { code: 5, points: null },
  ];
  expect([1, 2, 3, 4, 5, 6].map((code) => rankOfPlayer(players, code))).toEqual([2, 1, 2, 4, null, null]);
});
