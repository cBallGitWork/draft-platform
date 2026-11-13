import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { overridesIn } from "../gameweekScorer/heldMatches";
import { matchRecordsOf } from "../stats/matchRecordReads";
import { cardOpensAt } from "../playerCard/cardPoints";
import type { StoredScoringSet } from "../scoring/scoringSetShape";
import { latestSiteScoring, siteScoringByGameweek } from "../scoring/siteVersions";
import { inTenths } from "../scoring/values";
import { takeAllOrThrow } from "../shared/cappedRead";
import { CURRENT_FIXTURES_MOST, heldFixturesSeason } from "../shared/fixtures";
import { groupedBy } from "../shared/groupedBy";
import { seasonStartOf } from "../shared/time";
import { statusOf } from "../stats/matchStats";
import { matchPointsAt, type SeasonPointsOf } from "../stats/seasonPoints";
import { countedStats, newestSeasonWithTotals, seasonTotals } from "../stats/seasonStats";
import { addStats, type Stats } from "../stats/statTotals";
import { PERIOD_GAMEWEEKS, type Period } from "./periods";

// Every player's totals and points over the period Scouting's figures are over (periods.ts): the
// season, or the last 4 or 6 finished Premier League gameweeks, whatever the league's draft date, a
// match a player missed counting 0 minutes; before the season's first match, last season's final 4
// or 6 (Craig, 9 Nov 2026, on #1028, answer 5). The season is the list's: the newest with
// totals (seasonStats.ts), so last season's until the new one's first match. A gameweek is finished
// once every one of its matches with a kickoff has been read at full time. The season's totals are
// kept as records are written; a few gameweeks' are added up from their matches' records on read,
// at most 6 gameweeks of a few dozen records a match; each gameweek still to be played costs one
// status read on the way down to them.

/** One of the period's matches: its gameweek and every record held for it. */
type PeriodMatch = { fixture: Doc<"fixtures">; gameweek: number; records: Doc<"playerMatchStats">[] };

/** Every player's totals over the period, by his code, and the gameweeks it counts (none for the
 *  season, in order otherwise); `matches` are the period's matches, for its points, empty for the
 *  season. `season` is the season the totals are from, null with none held. */
interface PeriodTotals {
  season: number | null;
  gameweeks: number[];
  totals: Map<number, Stats>;
  matches: PeriodMatch[];
}

/** Every player's totals over `period`. */
export async function periodTotals(ctx: QueryCtx, chosen: Period): Promise<PeriodTotals> {
  if (chosen !== "season") return lastGameweeksTotals(ctx, PERIOD_GAMEWEEKS[chosen]);
  const season = await newestSeasonWithTotals(ctx);
  return { season, gameweeks: [], totals: season === null ? new Map() : await seasonTotals(ctx, season), matches: [] };
}

/** Every player's totals over the last `count` finished gameweeks of the newest season with
 *  totals, counted as a period's are: Scouting's last 4 or 6, and a club's Squad tab's last five
 *  (clubSquad.ts). */
export async function lastGameweeksTotals(ctx: QueryCtx, count: number): Promise<PeriodTotals> {
  const season = await newestSeasonWithTotals(ctx);
  if (season === null) return { season, gameweeks: [], totals: new Map(), matches: [] };
  const byGameweek = await finishedGameweeks(ctx, season, count);
  const matches = await Promise.all(
    byGameweek.flatMap(([gameweek, fixtures]) =>
      fixtures.map(async (fixture) => ({ fixture, gameweek, records: await matchRecordsOf(ctx, fixture.code, "the period's totals") })),
    ),
  );
  const totals = new Map<number, Stats>();
  for (const { records } of matches) {
    for (const record of records) totals.set(record.playerCode, addStats(totals.get(record.playerCode) ?? {}, countedStats(record)));
  }
  return { season, gameweeks: byGameweek.map(([gameweek]) => gameweek).toSorted((one, other) => one - other), totals, matches };
}

/** The last `count` finished gameweeks of `season`, newest first, each with its matches. */
async function finishedGameweeks(ctx: QueryCtx, season: number, count: number): Promise<[number, Doc<"fixtures">[]][]> {
  const fixtures = await seasonFixtures(ctx, season);
  const newestFirst = [...groupedBy(fixtures, (fixture) => fixture.gameweek!)].toSorted(([one], [other]) => other - one);
  const finished: [number, Doc<"fixtures">[]][] = [];
  for (const gameweek of newestFirst) {
    if (finished.length === count) break;
    if (await everyMatchRead(ctx, gameweek[1])) finished.push(gameweek);
  }
  return finished;
}

/** Whether every one of these matches has been read at full time. The latest kickoff is asked
 *  first and the walk stops at the first unread match, so a gameweek still to be played costs one
 *  read, not one a match (#1552). */
async function everyMatchRead(ctx: QueryCtx, fixtures: readonly Doc<"fixtures">[]): Promise<boolean> {
  for (const fixture of fixtures.toSorted((one, other) => other.kickoff! - one.kickoff!)) {
    if ((await statusOf(ctx, fixture.code)) === null) return false;
  }
  return true;
}

/** The season's matches with a kickoff and a gameweek: for the season the feed still sends, only
 *  the matches it sends; for an earlier one, every match held, as the feed sends none of them. */
async function seasonFixtures(ctx: QueryCtx, season: number): Promise<Doc<"fixtures">[]> {
  const from = seasonStartOf(season);
  const to = seasonStartOf(season + 1);
  const held = await takeAllOrThrow(
    ctx.db.query("fixtures").withIndex("by_kickoff", (q) => q.gte("kickoff", from).lt("kickoff", to)),
    CURRENT_FIXTURES_MOST,
    `More than ${CURRENT_FIXTURES_MOST} matches are held for the ${season} season, so the period would be cut short`,
  );
  const sent = season === (await heldFixturesSeason(ctx));
  return held.filter((fixture) => fixture.gameweek !== null && (!sent || fixture.droppedAt === undefined));
}

/** Each player's points over the period's matches, by his code and his positions now: each match
 *  he played at his main position, as his card prices it, null ("—") with none priced. In the season
 *  the feed sends, each gameweek is priced under the site's set in force then, and the league's
 *  override of a match counts in its place (seasonPoints.ts); in an earlier season, under the site's
 *  set as it stands, with no overrides, as last season's points are (shownSeasonPoints.ts). */
export async function periodPointsIn(ctx: QueryCtx, leagueId: Id<"leagues">, { season, matches }: PeriodTotals): Promise<SeasonPointsOf> {
  const thisSeason = season !== null && season === (await heldFixturesSeason(ctx));
  let setIn: (gameweek: number) => StoredScoringSet;
  if (thisSeason) setIn = await siteScoringByGameweek(ctx);
  else {
    const latest = await latestSiteScoring(ctx);
    setIn = () => latest;
  }
  const played = await Promise.all(
    matches.map(async ({ fixture, gameweek, records }) => {
      const overrides = thisSeason ? await overridesIn(ctx, leagueId, fixture.code) : new Map<number, number>();
      return records
        .filter((record) => record.played !== false)
        .map((record) => ({ record, set: setIn(gameweek), override: overrides.get(record.playerCode) ?? null }));
    }),
  );
  const byPlayer = groupedBy(played.flat(), ({ record }) => record.playerCode);
  return (playerCode, positions) => {
    const position = cardOpensAt(positions);
    if (position === null) return null;
    const priced = (byPlayer.get(playerCode) ?? []).flatMap(({ record, set, override }) => {
      const points = override ?? matchPointsAt(record, set, position);
      return points === null ? [] : [points];
    });
    return priced.length === 0 ? null : inTenths(priced.reduce((total, points) => total + points, 0));
  };
}
