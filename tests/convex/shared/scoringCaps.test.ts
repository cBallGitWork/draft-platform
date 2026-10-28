import { beforeEach, expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../../convex/_generated/server";
import { GAMEWEEK_MATCHES_MOST } from "../../../convex/football/matchScores";
import { FIRST_GAMEWEEK } from "../../../convex/gameweeks/usedGameweeks";
import { seasonRecords, PLAYER_RECORDS_MOST } from "../../../convex/playerCard/playerCard";
import { seasonRules } from "../../../convex/rules/rulesHistory";
import { OWNED_IN_LEAGUE_MOST, type PlayersFilters, type PlayersSort } from "../../../convex/scouting/playersList";
import { thresholdStepsOf, THRESHOLD_STEPS_MOST } from "../../../convex/stats/thresholdSteps";
import { LEAGUES_STORED_MOST } from "../../../convex/table/finalScores";
import { FINAL_SCORES_MOST, leagueScores } from "../../../convex/table/gameweekScores";
import { gameweekInputs, heldFixtures, leagueReads, MATCH_OVERRIDES_MOST, MATCH_RECORDS_MOST } from "../../../convex/table/teamGameweek";
import { ANN, GAMEWEEK, PHILLIPS, scoresLeague, type ScoresLeague } from "../../support/convex/gameweekScores.harness";
import { actingAs } from "../../support/convex/leagues.harness";
import { EVERTON, HULL, HULL_EVERTON } from "../../support/convex/matchStats.harness";

// The scoring path's reads each have a named cap (#214): at the cap they read every row, and past
// it they throw, never cut short. Each cap is driven through the read it guards, in scoresLeague's
// league: Hull v Everton in gameweek 6, Ann's and Bob's teams playing each other.

let league: ScoresLeague;
beforeEach(async () => {
  league = await scoresLeague();
});

/** Reads at `cap` rows, held by `holdTo`, then throws `tooMany` once one more is held. */
async function readsToTheCapThenThrows(
  cap: number,
  holdTo: (count: number) => Promise<unknown>,
  read: () => Promise<unknown>,
  tooMany: string,
) {
  await holdTo(cap);
  await read();
  await holdTo(cap + 1);
  await expect(read()).rejects.toThrow(tooMany);
}

/** Writing hundreds of rows is slow in convex-test, as in cappedReads.test.ts. */
const ROWS_TO_THE_CAP = { timeout: 30_000 };

/** A gameweek scoresLeague holds no matches in, for counting from none. */
const EMPTY_GAMEWEEK = GAMEWEEK + 1;
/** Where codes this file makes up start, clear of the recorded ones. */
const MADE_UP_CODES = 900_000;

/** A row for each count from `held` up to `count`, `insert` writing the one at that index. */
const holdRows =
  (held: (ctx: MutationCtx) => Promise<number>, insert: (ctx: MutationCtx, index: number) => Promise<unknown>) => (count: number) =>
    league.t.run(async (ctx) => {
      for (let index = await held(ctx); index < count; index += 1) await insert(ctx, index);
    });

const gameweekFixtures = (ctx: QueryCtx, gameweek: number) =>
  ctx.db
    .query("fixtures")
    .withIndex("by_gameweek_and_droppedAt", (q) => q.eq("gameweek", gameweek).eq("droppedAt", undefined))
    .collect();

/** EMPTY_GAMEWEEK's matches up to `count`, Hull at home to Everton in each. */
const holdGameweekMatches = holdRows(
  async (ctx) => (await gameweekFixtures(ctx, EMPTY_GAMEWEEK)).length,
  (ctx, index) =>
    ctx.db.insert("fixtures", {
      code: MADE_UP_CODES + index,
      gameweek: EMPTY_GAMEWEEK,
      homeClubCode: HULL,
      awayClubCode: EVERTON,
      kickoff: 0,
    }),
);

/** A whole record with no stats, of a man who played or an unused substitute. */
const recordOf = (playerCode: number, fixtureCode: number, played: boolean) => ({
  playerCode,
  fixtureCode,
  started: false,
  played,
  arrived: { fpl: true, pl: true },
  stats: {},
  state: "provisional" as const,
});

/** The league, its rules and a read of each, as the table reads them. */
async function leagueAndRules(ctx: QueryCtx) {
  const held = (await ctx.db.get("leagues", league.leagueId))!;
  const season = await seasonRules(ctx, league.leagueId);
  if (season === null) throw new Error("scoresLeague's league holds no rules");
  return { held, season };
}

/** Gameweek 6's inputs for no team: how many records and overrides of the league each match
 *  holds (a read returns only plain values). */
const gameweekSixInputs = () =>
  league.t.run(async (ctx) => {
    const { held, season } = await leagueAndRules(ctx);
    const { matches } = await gameweekInputs(ctx, await leagueReads(ctx, held, season), GAMEWEEK, await heldFixtures(ctx, GAMEWEEK), []);
    return matches.map(({ records, overrides }) => ({
      records: records.size,
      overrides: overrides.size,
    }));
  });

/** Hull and Everton, which scoresLeague doesn't hold, for a read that names a match's clubs. */
const holdClubs = () =>
  league.t.run(async (ctx) => {
    await ctx.db.insert("clubs", {
      code: HULL,
      name: "Hull City",
      shortName: "HUL",
    });
    await ctx.db.insert("clubs", {
      code: EVERTON,
      name: "Everton",
      shortName: "EVE",
    });
  });

test(`a gameweek's matches for its points: ${GAMEWEEK_MATCHES_MOST} are read, one more throws`, async () => {
  await readsToTheCapThenThrows(
    GAMEWEEK_MATCHES_MOST,
    holdGameweekMatches,
    () => league.t.run((ctx) => heldFixtures(ctx, EMPTY_GAMEWEEK)),
    `More than ${GAMEWEEK_MATCHES_MOST} matches are held for gameweek ${EMPTY_GAMEWEEK}, so its points would be cut short`,
  );
});

test(`a gameweek's matches for the fixtures screen: ${GAMEWEEK_MATCHES_MOST} are read, one more throws`, async () => {
  await holdClubs();
  const ann = await actingAs(league.t, ANN);
  await readsToTheCapThenThrows(
    GAMEWEEK_MATCHES_MOST,
    holdGameweekMatches,
    () =>
      ann.query(api.football.matchScores.ofGameweek, {
        gameweek: EMPTY_GAMEWEEK,
      }),
    `More than ${GAMEWEEK_MATCHES_MOST} matches are held for gameweek ${EMPTY_GAMEWEEK}, so they would be cut short`,
  );
});

test(`a match's records for its points: ${MATCH_RECORDS_MOST} are read, one more throws`, async () => {
  await readsToTheCapThenThrows(
    MATCH_RECORDS_MOST,
    holdRows(
      async (ctx) =>
        (
          await ctx.db
            .query("playerMatchStats")
            .withIndex("by_fixtureCode_and_playerCode", (q) => q.eq("fixtureCode", HULL_EVERTON))
            .collect()
        ).length,
      (ctx, index) => ctx.db.insert("playerMatchStats", recordOf(MADE_UP_CODES + index, HULL_EVERTON, false)),
    ),
    gameweekSixInputs,
    `Match ${HULL_EVERTON} holds more than ${MATCH_RECORDS_MOST} records, so its points would be cut short`,
  );
});

test(`a league's overrides in one match: ${MATCH_OVERRIDES_MOST} are read, one more throws`, async () => {
  const { leagueId } = league;
  await readsToTheCapThenThrows(
    MATCH_OVERRIDES_MOST,
    holdRows(
      async (ctx) => (await ctx.db.query("pointsOverrides").collect()).length,
      (ctx, index) =>
        ctx.db.insert("pointsOverrides", {
          leagueId,
          gameweek: GAMEWEEK,
          fixtureCode: HULL_EVERTON,
          playerCode: MADE_UP_CODES + index,
          points: 0,
          reason: "",
          by: ANN,
          at: 0,
        }),
    ),
    gameweekSixInputs,
    `League ${leagueId} holds more than ${MATCH_OVERRIDES_MOST} overrides in match ${HULL_EVERTON}, so its points would be cut short`,
  );
});

test(`a league's stored final scores: ${FINAL_SCORES_MOST} are read, one more throws`, ROWS_TO_THE_CAP, async () => {
  const { leagueId, annsTeam, bobsTeam } = league;
  await readsToTheCapThenThrows(
    FINAL_SCORES_MOST,
    holdRows(
      async (ctx) => (await ctx.db.query("finalScores").collect()).length,
      // A gameweek the league hasn't begun, so gameweek 6 is still worked out from its records.
      (ctx) =>
        ctx.db.insert("finalScores", {
          leagueId,
          gameweek: FIRST_GAMEWEEK,
          teamId: annsTeam,
          points: 0,
          noLineup: false,
          fixtureCodes: [],
          storedAt: 0,
        }),
    ),
    () =>
      league.t.run(async (ctx) => {
        const { held, season } = await leagueAndRules(ctx);
        return (await leagueScores(ctx, held, season, [annsTeam, bobsTeam])).unscored;
      }),
    `League ${leagueId} holds more than ${FINAL_SCORES_MOST} final scores, so some would be left out`,
  );
});

test(`the leagues a lock asks to store their scores: ${LEAGUES_STORED_MOST} are asked, one more throws`, ROWS_TO_THE_CAP, async () => {
  const { _id, _creationTime, ...leagueFields }: Doc<"leagues"> = (await league.t.run((ctx) => ctx.db.get("leagues", league.leagueId)))!;
  await readsToTheCapThenThrows(
    LEAGUES_STORED_MOST,
    // Each a copy of scoresLeague's, its teams and squads left out: only the count is read here.
    holdRows(
      async (ctx) => (await ctx.db.query("leagues").collect()).length,
      (ctx) => ctx.db.insert("leagues", leagueFields),
    ),
    () => league.t.mutation(internal.table.finalScores.storeEveryLeague, {}),
    `More than ${LEAGUES_STORED_MOST} leagues are held, so some would have their final scores unstored`,
  );
});

/** PHILLIPS's records in Hull v Everton up to `count`, each one he played: a cap test needs only
 *  their number, not one a match. PHILLIPS is the first player scoresLeague holds, so in the
 *  rebuild's first page. */
const holdPhillipsRecords = holdRows(
  async (ctx) =>
    (
      await ctx.db
        .query("playerMatchStats")
        .withIndex("by_playerCode", (q) => q.eq("playerCode", PHILLIPS))
        .collect()
    ).length,
  (ctx) => ctx.db.insert("playerMatchStats", recordOf(PHILLIPS, HULL_EVERTON, true)),
);

test(`a player's records for his card: ${PLAYER_RECORDS_MOST} are read, one more throws`, ROWS_TO_THE_CAP, async () => {
  await readsToTheCapThenThrows(
    PLAYER_RECORDS_MOST,
    holdPhillipsRecords,
    () => league.t.run((ctx) => seasonRecords(ctx, PHILLIPS)),
    `More than ${PLAYER_RECORDS_MOST} match records are held for player ${PHILLIPS}, so his season would be cut short`,
  );
});

test(`a player's records for his season totals: ${PLAYER_RECORDS_MOST} are added up, one more throws`, ROWS_TO_THE_CAP, async () => {
  await readsToTheCapThenThrows(
    PLAYER_RECORDS_MOST,
    holdPhillipsRecords,
    () => league.t.mutation(internal.stats.seasonStats.rebuild, { cursor: null }),
    `More than ${PLAYER_RECORDS_MOST} match records are held for player ${PHILLIPS}, so his totals would be cut short`,
  );
});

test(`a league's overrides of one player for his card: ${PLAYER_RECORDS_MOST} are read, one more throws`, ROWS_TO_THE_CAP, async () => {
  const { leagueId } = league;
  await holdClubs();
  const ann = await actingAs(league.t, ANN);
  await readsToTheCapThenThrows(
    PLAYER_RECORDS_MOST,
    holdRows(
      async (ctx) => (await ctx.db.query("pointsOverrides").collect()).length,
      (ctx, index) =>
        ctx.db.insert("pointsOverrides", {
          leagueId,
          gameweek: GAMEWEEK,
          fixtureCode: MADE_UP_CODES + index,
          playerCode: PHILLIPS,
          points: 0,
          reason: "",
          by: ANN,
          at: 0,
        }),
    ),
    () =>
      ann.query(api.playerCard.playerCard.card, {
        leagueId,
        playerCode: PHILLIPS,
        now: 0,
      }),
    `League ${leagueId} holds more than ${PLAYER_RECORDS_MOST} overrides for player ${PHILLIPS}, so his season would be cut short`,
  );
});

test(`a match's threshold steps: ${THRESHOLD_STEPS_MOST} are read, one more throws`, ROWS_TO_THE_CAP, async () => {
  await readsToTheCapThenThrows(
    THRESHOLD_STEPS_MOST,
    holdRows(
      async (ctx) => (await ctx.db.query("thresholdSteps").collect()).length,
      (ctx) =>
        ctx.db.insert("thresholdSteps", {
          fixtureCode: HULL_EVERTON,
          playerCode: PHILLIPS,
          stat: "minutes",
          from: 0,
          to: 1,
          minutes: 1,
          minute: null,
        }),
    ),
    () => league.t.run((ctx) => thresholdStepsOf(ctx, HULL_EVERTON)),
    `Match ${HULL_EVERTON} holds more than ${THRESHOLD_STEPS_MOST} threshold steps, so some would be left out`,
  );
});

test(`the players owned in a league for the players list: ${OWNED_IN_LEAGUE_MOST} are read, one more throws`, ROWS_TO_THE_CAP, async () => {
  const { leagueId, annsTeam } = league;
  const ann = await actingAs(league.t, ANN);
  const everyone: PlayersFilters = {
    availability: "all",
    position: null,
    clubCode: null,
  };
  const byName: PlayersSort = { by: "name", descending: false };
  await readsToTheCapThenThrows(
    OWNED_IN_LEAGUE_MOST,
    holdRows(
      async (ctx) => (await ctx.db.query("squadPlayers").collect()).length,
      (ctx, index) =>
        ctx.db.insert("squadPlayers", {
          leagueId,
          teamId: annsTeam,
          playerCode: MADE_UP_CODES + index,
        }),
    ),
    () =>
      ann.query(api.scouting.playersList.list, {
        leagueId,
        filters: everyone,
        sort: byName,
        stat: null,
      }),
    `More than ${OWNED_IN_LEAGUE_MOST} players are owned in league ${leagueId}, so the list would be cut short`,
  );
});
