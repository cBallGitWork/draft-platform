import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { positionOfSlot } from "../lineup/pitch";
import { cardPoints, type CardPoints } from "../playerCard/cardPoints";
import type { Position } from "../positions/positionTables";
import { seasonRules } from "../rules/rulesHistory";
import { siteScoringByGameweek } from "../scoring/siteScoring";
import { takeAllOrThrow } from "../shared/cappedRead";
import { isWhole } from "../stats/matchRecords";
import { statusOf } from "../stats/matchStats";
import { begunGameweeks } from "./gameweekScores";
import { heldFixtures, leagueReads, teamGameweekInputs, teamInGameweek, type PlayerRows, type TeamInGameweek } from "./teamGameweek";

// A player's matches in a league as his team scored them (#577; spec/12, The player card and
// Squad): the one place his card and the Squad tab read his points from. A gameweek the league has
// begun whose lineup names him is read from teamInGameweek, as the table scores it: auto-subs and
// the league's overrides in, live and provisional until final. One who counted shows his slot's
// points, at the slot and role he started in or took over; one who didn't, a bench player who
// stayed there, what he would score at his best position, labelled as not counted. Any other match
// is priced at his best position. A match from before he joined his team stays at his best
// position until what his old team got from him is built (SPEC.md, Later).

/** The most match records one player's read takes: 38 a season, kept season on season, so ten
 *  seasons with room. More throws, never a silent cut. */
export const PLAYER_RECORDS_MOST = 500;

/** One of his records this season, with its match and the gameweek it was played in. */
export type SeasonRecord = { record: Doc<"playerMatchStats">; fixture: Doc<"fixtures">; gameweek: number };

/** One of his matches as his team scored it. */
export interface ScoredMatch extends SeasonRecord {
  /** Its total is the league's override where it holds one. */
  points: CardPoints;
  override: Doc<"pointsOverrides"> | null;
  /** Until the match is locked and his record whole, and, from a lineup, until every man in it
   *  is final, as auto-subs can still change. */
  provisional: boolean;
}

/** A player's season's matches, newest last as the records were read. */
export type ScoredMatches = (player: { code: number; positions: readonly Position[] }) => Promise<ScoredMatch[]>;

/** His matches as `teamId` scored them: his team in the league now, or null for a free agent. Each
 *  player's rows and each gameweek's scoring are read once, however many players are asked for. */
export async function scoredMatches(ctx: QueryCtx, league: Doc<"leagues">, teamId: Id<"teams"> | null): Promise<ScoredMatches> {
  const setIn = await siteScoringByGameweek(ctx);
  const rows = new Map<number, Promise<HisRows>>();
  const rowsOf = (code: number) => {
    if (!rows.has(code)) rows.set(code, hisRows(ctx, league._id, code));
    return rows.get(code)!;
  };
  const teamIn = teamId === null ? null : await teamGameweeks(ctx, league, teamId, rowsOf);
  return async ({ code, positions }) => {
    const { records, overrides } = await rowsOf(code);
    return Promise.all(
      (await seasonRecordsOf(ctx, code, records)).map(async (held) => {
        const override = overrides.get(held.fixture.code) ?? null;
        const team = teamIn === null ? null : await teamIn(held.gameweek);
        const fromTeam = team === null ? null : asScored(team, code, held.fixture.code);
        if (fromTeam?.counts) return { ...held, points: fromTeam.points, override, provisional: fromTeam.provisional };
        const best = cardPoints(isWhole(held.record) ? held.record.stats : null, setIn(held.gameweek), positions, null);
        const points = { ...best, total: override?.points ?? best.total, ...(fromTeam === null ? {} : { scoredAs: "notCounted" as const }) };
        const provisional = fromTeam?.provisional ?? (!isWhole(held.record) || (await statusOf(ctx, held.fixture.code))?.state !== "locked");
        return { ...held, points, override, provisional };
      }),
    );
  };
}

/** His records and the league's overrides of his points, whole. */
interface HisRows {
  records: Doc<"playerMatchStats">[];
  overrides: Map<number, Doc<"pointsOverrides">>;
}

async function hisRows(ctx: QueryCtx, leagueId: Id<"leagues">, playerCode: number): Promise<HisRows> {
  return { records: await recordsOf(ctx, playerCode), overrides: await overridesOf(ctx, leagueId, playerCode) };
}

/** The team's scoring in each gameweek the league has begun, read once a gameweek; null for a
 *  gameweek it hasn't, or while it has never saved a lineup. Null for a league made before rules
 *  were held, which has no scoring (#25). */
async function teamGameweeks(ctx: QueryCtx, league: Doc<"leagues">, teamId: Id<"teams">, rowsOf: (code: number) => Promise<HisRows>) {
  const season = await seasonRules(ctx, league._id);
  if (season === null) return null;
  const reads = await leagueReads(ctx, league, season);
  const begun = new Set(await begunGameweeks(ctx, league));
  const asRows = async (code: number): Promise<PlayerRows> => {
    const { records, overrides } = await rowsOf(code);
    return {
      records: new Map(records.map((record) => [record.fixtureCode, record])),
      overrides: new Map([...overrides].map(([fixtureCode, override]) => [fixtureCode, override.points])),
    };
  };
  const read = new Map<number, Promise<TeamInGameweek | null>>();
  return (gameweek: number) => {
    if (!begun.has(gameweek)) return null;
    if (!read.has(gameweek)) {
      read.set(
        gameweek,
        heldFixtures(ctx, gameweek)
          .then((fixtures) => teamGameweekInputs(ctx, reads, gameweek, fixtures, teamId, asRows))
          .then((inputs) => teamInGameweek(reads, inputs, teamId)),
      );
    }
    return read.get(gameweek)!;
  };
}

/** His match in the team's gameweek: whether it counted, its points at the cell he was scored in
 *  and whether they may still move; null when the lineup doesn't name him. */
function asScored({ team, matchesOf }: TeamInGameweek, playerCode: number, fixtureCode: number) {
  const slots = [...team.starters, ...team.bench];
  const slot = slots.find((each) => each.playerCode === playerCode);
  if (slot === undefined) return null;
  const index = matchesOf.get(playerCode)!.findIndex((match) => match.fixture.code === fixtureCode);
  // teamInGameweek takes every match he has a record in, so one missing is data gone wrong.
  if (index === -1) throw new Error(`Player ${playerCode}'s match ${fixtureCode} isn't among his team's matches that gameweek`);
  const points: CardPoints = { scoredAs: "slot", position: positionOfSlot(slot.cell), ...slot.matches[index] };
  // A man's points are final once his matches lock (teamPoints.ts), but who counts only once every man's are.
  return { counts: slot.counts, points, provisional: slots.some((each) => each.provisional) };
}

/** His records, every season's. */
function recordsOf(ctx: QueryCtx, playerCode: number): Promise<Doc<"playerMatchStats">[]> {
  return takeAllOrThrow(
    ctx.db.query("playerMatchStats").withIndex("by_playerCode", (q) => q.eq("playerCode", playerCode)),
    PLAYER_RECORDS_MOST,
    `More than ${PLAYER_RECORDS_MOST} match records are held for player ${playerCode}, so his season would be cut short`,
  );
}

/** His records this season, for whichever club, each with its match: a match the feed still sends
 *  is this season's, and one with no gameweek is postponed with no new date, so not yet played. An
 *  unused substitute's match is left out, as one he wasn't named for is. */
export async function seasonRecords(ctx: QueryCtx, playerCode: number): Promise<SeasonRecord[]> {
  return seasonRecordsOf(ctx, playerCode, await recordsOf(ctx, playerCode));
}

async function seasonRecordsOf(ctx: QueryCtx, playerCode: number, records: readonly Doc<"playerMatchStats">[]): Promise<SeasonRecord[]> {
  const withMatches = await Promise.all(
    records
      .filter((record) => record.played !== false)
      .map(async (record) => {
        const fixture = await ctx.db
          .query("fixtures")
          .withIndex("by_code", (q) => q.eq("code", record.fixtureCode))
          .unique();
        // A record is filed only for a match the sync holds, so one missing is bad data.
        if (fixture === null) throw new Error(`Player ${playerCode} has a record for match ${record.fixtureCode}, which isn't held`);
        return fixture.droppedAt !== undefined || fixture.gameweek === null ? [] : [{ record, fixture, gameweek: fixture.gameweek }];
      }),
  );
  return withMatches.flat();
}

/** The league's overrides of his points, by match: one a match at most, so never more than his
 *  records. */
export async function overridesOf(ctx: QueryCtx, leagueId: Id<"leagues">, playerCode: number): Promise<Map<number, Doc<"pointsOverrides">>> {
  const rows = await takeAllOrThrow(
    ctx.db.query("pointsOverrides").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("playerCode", playerCode)),
    PLAYER_RECORDS_MOST,
    `League ${leagueId} holds more than ${PLAYER_RECORDS_MOST} overrides for player ${playerCode}, so his season would be cut short`,
  );
  return new Map(rows.map((row) => [row.fixtureCode, row]));
}
