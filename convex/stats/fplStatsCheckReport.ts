import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalQuery } from "../_generated/server";
import { readFplPayloads } from "../football/fpl/fpl";
import { fplStatLines, readFplLive } from "../football/fpl/fplLive";
import { hasBegun, workedOutGameweek, type GameweekTeams } from "../gameweekScorer/gameweekScores";
import { heldFixtures, heldMatches } from "../gameweekScorer/heldMatches";
import { leagueReads, slotInMatch, type TeamInGameweek } from "../gameweekScorer/teamGameweek";
import { seasonRules } from "../rules/rulesHistory";
import { scoreMatch } from "../scoring/scoring";
import type { MatchStats } from "../scoring/values";
import { teamsOf } from "../shared/leagueAccess";
import { playerByCode } from "../shared/players";
import { squadRowsIn } from "../squads/squadPlace";
import { statDifferences, withFplStats } from "./fplStatsCheck";
import { MINUTES_STAT, statsIfWhole } from "./matchRecords";

// The first live-data check's report (#2115, spec/20 `S20.13`): after a gameweek, every man in a
// league's squads whose stored stats for a match differ from FPL's own for it, each stat with both
// values, and every man whose points, as the league scored them, aren't what its scoring gives his
// record with FPL's counts in it; and how many match. Until a screen has a place for it, the
// session watching the check reads it from the CLI:
// `npx convex run stats/fplStatsCheckReport:gameweek '{"leagueId":"…","gameweek":…}'`.

const fplLine = v.object({ playerCode: v.number(), fixtureCode: v.number(), stats: v.record(v.string(), v.number()) });
const maybeNumber = v.union(v.number(), v.null());

const report = v.object({
  gameweek: v.number(),
  /** His matches whose stats and points both agree. */
  matching: v.number(),
  differing: v.array(
    v.object({
      playerCode: v.number(),
      name: v.string(),
      team: v.string(),
      fixtureCode: v.number(),
      stats: v.array(v.object({ stat: v.string(), fpl: maybeNumber, stored: maybeNumber })),
      /** His points in the match as the league scored them and as its scoring prices his record
       *  with FPL's counts in, at the same slot and role; the league's override of them, if any.
       *  Null where no lineup scored him in it. */
      points: v.union(v.null(), v.object({ league: maybeNumber, fromFpl: maybeNumber, override: maybeNumber })),
    }),
  ),
});

/** The report for one league and gameweek, from FPL's live stats read now. */
export const gameweek = internalAction({
  args: { leagueId: v.id("leagues"), gameweek: v.number() },
  returns: report,
  handler: async (ctx, { leagueId, gameweek }): Promise<typeof report.type> => {
    const [{ bootstrap, fixtures }, live] = await Promise.all([readFplPayloads(), readFplLive(gameweek)]);
    const fpl = fplStatLines(live, bootstrap.elements, fixtures);
    return ctx.runQuery(internal.stats.fplStatsCheckReport.compare, { leagueId, gameweek, fpl });
  },
});

/** The report from FPL's lines for the gameweek, `fplStatLines`' as read. */
export const compare = internalQuery({
  args: { leagueId: v.id("leagues"), gameweek: v.number(), fpl: v.array(fplLine) },
  returns: report,
  handler: async (ctx, { leagueId, gameweek, fpl }) => {
    const league = await ctx.db.get("leagues", leagueId);
    if (league === null) throw new Error(`No league ${leagueId}`);
    const fplOf = new Map(fpl.map((line) => [lineKey(line.fixtureCode, line.playerCode), line.stats]));
    const matches = await heldMatches(ctx, leagueId, await heldFixtures(ctx, gameweek));
    const teams = await teamsOf(ctx, leagueId);
    const scored = (await hasBegun(ctx, league, gameweek))
      ? await workedOutGameweek(ctx, await leagueReads(ctx, league, await seasonRules(ctx, leagueId)), gameweek, teams.map(({ _id }) => _id))
      : null;
    const teamName = new Map(teams.map(({ _id, name }) => [_id, name]));

    let matching = 0;
    const differing = [];
    for (const { teamId, playerCode } of await squadRowsIn(ctx, leagueId)) {
      const team = scored === null ? null : await scored.slotsOf(teamId);
      for (const match of matches) {
        const fixtureCode = match.fixture.code;
        const record = match.records.get(playerCode) ?? null;
        const fplStats = fplOf.get(lineKey(fixtureCode, playerCode)) ?? null;
        // A man neither feed has playing in the match wasn't in it.
        if (record === null && (fplStats?.[MINUTES_STAT] ?? 0) === 0) continue;
        if (fplStats === null && record?.played !== true) continue;
        const stats = statDifferences(fplStats, record?.stats ?? null);
        const points = team === null ? null : pointsIn(team, scored!.set, playerCode, fixtureCode, fplStats, match.overrides.get(playerCode));
        if (stats.length === 0 && (points === null || points.league === points.fromFpl)) {
          matching += 1;
          continue;
        }
        const name = (await playerByCode(ctx, playerCode))?.fullName ?? `Unknown player ${playerCode}`;
        differing.push({ playerCode, name, team: teamName.get(teamId) ?? `Team ${teamId}`, fixtureCode, stats, points });
      }
    }
    return { gameweek, matching, differing };
  },
});

const lineKey = (fixtureCode: number, playerCode: number) => `${fixtureCode}:${playerCode}`;

/** His points in the match as his team scored them, beside what its scoring gives his record with
 *  FPL's counts in at the same cell and role, with the team's instructions and back line where
 *  they scored him (scoreTeam: a starter, or a sub who came on); null where his team's lineup
 *  didn't hold him or the match isn't his. */
function pointsIn(
  team: TeamInGameweek,
  set: GameweekTeams["set"],
  playerCode: number,
  fixtureCode: number,
  fpl: MatchStats | null,
  override: number | undefined,
) {
  const found = slotInMatch(team, playerCode, fixtureCode);
  if (found === null || found.inMatch === null) return null;
  const { slot, inMatch } = found;
  const record = inMatch.match.records.get(playerCode);
  const whole = record === undefined ? null : statsIfWhole(record);
  const priced = whole === null || fpl === null ? null : withFplStats(whole, fpl);
  const teamScoring = team.team.starters.includes(slot) || slot.counts ? team.scoring : undefined;
  const fromFpl = priced === null ? null : scoreMatch(priced, set, slot.cell, slot.role, teamScoring).total;
  return { league: inMatch.points.total, fromFpl, override: override ?? null };
}
