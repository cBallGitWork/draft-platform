import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { positionOfSlot } from "../lineup/pitch";
import { cardPoints, type CardPoints } from "../playerCard/cardPoints";
import type { Position } from "../positions/positionTables";
import type { StoredScoringSet } from "../scoring/scoringSetShape";
import { seasonRules } from "../rules/rulesHistory";
import { siteScoringByGameweek } from "../scoring/siteScoring";
import { takeAllOrThrow } from "../shared/cappedRead";
import { fixtureByCode } from "../shared/fixtures";
import { readOnce } from "../shared/readOnce";
import { isWhole, PLAYER_RECORDS_MOST } from "../stats/matchRecords";
import { statusOf } from "../stats/matchStats";
import { begunGameweeks, squadGameweek } from "./gameweekScores";
import type { PlayerRows } from "./squadInputs";
import { isMatchFinal } from "./heldMatches";
import { leagueReads, slotInMatch, type TeamInGameweek } from "./teamGameweek";

// A player's matches in a league as his team scored them (#577; spec/12, The player card and
// Squad): the one place his card and the Squad tab read his points from. A gameweek the league has
// begun whose lineup names him is read from the league's gameweek scorer (gameweekScores.ts's
// squadGameweek), as the table scores it: auto-subs and the league's overrides in, live and
// provisional until final. One who counted shows his slot's points, at the slot and role he
// started in or took over; one who didn't, a bench player who stayed there, what he would score at
// his best position, labelled as not counted. In a league
// whose double gameweeks count the best match, his other match there is his slot's points, labelled
// as not counted too, as the table left it out (scoring.ts's countedMatches). Any other match
// is priced at his best position. A match from before he joined his team stays at his best
// position until what his old team got from him is built (SPEC.md, Later).

/** The most overrides of one player a league holds: one a match at most, so never more than his
 *  records. More throws, never a silent cut. */
const PLAYER_OVERRIDES_MOST = PLAYER_RECORDS_MOST;

/** One of his records this season, with its match and the gameweek it was played in. */
export type SeasonRecord = { record: Doc<"playerMatchStats">; fixture: Doc<"fixtures">; gameweek: number };

/** One of his matches as his team scored it. */
export interface ScoredMatch extends SeasonRecord {
  /** Its total is the league's override where it holds one. */
  points: CardPoints;
  /** Whether his team got these points: his slot's, and counted there. */
  counted: boolean;
  override: Doc<"pointsOverrides"> | null;
  /** Until the match is locked and his record whole, and, from a lineup, until every man in it
   *  is final, as auto-subs can still change. */
  provisional: boolean;
}

/** A player's season's matches, in the order his records were filed, with the site's scoring set
 *  in force each gameweek, which they were priced under. */
export interface ScoredMatches {
  setIn: (gameweek: number) => StoredScoringSet;
  of: (player: { code: number; positions: readonly Position[] }) => Promise<ScoredMatch[]>;
}

/** His matches as `teamId` scored them: his team in the league now, or null for a free agent. Each
 *  player's rows and each gameweek's scoring are read once, however many players are asked for. */
export async function scoredMatches(ctx: QueryCtx, league: Doc<"leagues">, teamId: Id<"teams"> | null): Promise<ScoredMatches> {
  const setIn = await siteScoringByGameweek(ctx);
  const heldRowsOf = readOnce((code: number) => heldRows(ctx, league._id, code));
  const teamGameweekOf = teamId === null ? null : await teamGameweeks(ctx, league, teamId, heldRowsOf, setIn);
  const of = async ({ code, positions }: { code: number; positions: readonly Position[] }) => {
    const { records, overrides } = await heldRowsOf(code);
    return Promise.all(
      (await seasonRecordsOf(ctx, code, records)).map(async (held) => {
        const override = overrides.get(held.fixture.code) ?? null;
        const team = teamGameweekOf === null ? null : await teamGameweekOf(held.gameweek);
        const fromTeam = team === null ? null : asScored(team, code, held.fixture.code);
        if (fromTeam?.counts) return { ...held, points: fromTeam.points, counted: fromTeam.counted, override, provisional: fromTeam.provisional };
        const best = cardPoints(isWhole(held.record) ? held.record.stats : null, setIn(held.gameweek), positions);
        const points = { ...best, total: override?.points ?? best.total, ...(fromTeam === null ? {} : { scoredAs: "notCounted" as const }) };
        const provisional = fromTeam?.provisional ?? (!isWhole(held.record) || !isMatchFinal({ status: await statusOf(ctx, held.fixture.code) }));
        return { ...held, points, counted: false, override, provisional };
      }),
    );
  };
  return { setIn, of };
}

/** His records and the league's overrides of his points, as held. */
interface HeldRows {
  records: Doc<"playerMatchStats">[];
  overrides: Map<number, Doc<"pointsOverrides">>;
}

async function heldRows(ctx: QueryCtx, leagueId: Id<"leagues">, playerCode: number): Promise<HeldRows> {
  return { records: await recordsOf(ctx, playerCode), overrides: await overridesOf(ctx, leagueId, playerCode) };
}

/** The team's scoring in each gameweek the league has begun, read once a gameweek; null for a
 *  gameweek it hasn't. Null for a league made before rules were held, which has no scoring (#25).
 *  A set holding a rule no longer sound throws, as the card's best-position pricing always has
 *  (#287). */
async function teamGameweeks(ctx: QueryCtx, league: Doc<"leagues">, teamId: Id<"teams">, heldRowsOf: (code: number) => Promise<HeldRows>, setIn: ScoredMatches["setIn"]) {
  const season = await seasonRules(ctx, league._id);
  if (season === null) return null;
  const reads = await leagueReads(ctx, league, season, setIn);
  const begun = new Set(await begunGameweeks(ctx, league));
  const rowsByMatch = async (code: number): Promise<PlayerRows> => {
    const { records, overrides } = await heldRowsOf(code);
    return {
      records: new Map(records.map((record) => [record.fixtureCode, record])),
      overrides: new Map([...overrides].map(([fixtureCode, override]) => [fixtureCode, override.points])),
    };
  };
  const scoredIn = readOnce((gameweek: number) => squadGameweek(ctx, reads, gameweek, teamId, rowsByMatch).then(({ slotsOf }) => slotsOf(teamId)));
  return (gameweek: number) => (begun.has(gameweek) ? scoredIn(gameweek) : null);
}

/** His match in the team's gameweek: whether his slot counted, whether his slot's points count the
 *  match, its points at the cell he was scored in, labelled not counted where his slot's points
 *  leave it out, and whether they may still move; null when the lineup doesn't name him. */
function asScored(scored: TeamInGameweek, playerCode: number, fixtureCode: number) {
  const found = slotInMatch(scored, playerCode, fixtureCode);
  if (found === null) return null;
  const { slot, inMatch } = found;
  // teamInGameweek takes every match he has a record in, so one missing is data gone wrong.
  if (inMatch === null) throw new Error(`Player ${playerCode}'s match ${fixtureCode} isn't among his team's matches that gameweek`);
  const points: CardPoints = { scoredAs: inMatch.counted ? "slot" : "notCounted", position: positionOfSlot(slot.cell), ...inMatch.points };
  // A man's points are final once his matches lock (teamPoints.ts), but who counts only once every man's are.
  const { team } = scored;
  return { counts: slot.counts, counted: inMatch.counted, points, provisional: [...team.starters, ...team.bench].some((each) => each.provisional) };
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
        const fixture = await fixtureByCode(ctx, record.fixtureCode);
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
    PLAYER_OVERRIDES_MOST,
    `League ${leagueId} holds more than ${PLAYER_OVERRIDES_MOST} overrides for player ${playerCode}, so his season would be cut short`,
  );
  return new Map(rows.map((row) => [row.fixtureCode, row]));
}
