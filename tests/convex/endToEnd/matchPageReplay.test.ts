import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { SHEETS_BEFORE_KICKOFF_MS } from "../../../convex/football/matchTeamSheets";
import type { MatchPage } from "../../../convex/match/matchPage";
import { inTenths } from "../../../convex/scoring/scoringSet";
import { MINUTE_MS } from "../../../convex/shared/time";
import { recordedGw6 } from "../../support/recorded/gw6.payloads";
import { HULL_POINTS } from "../../support/convex/gameweekScores.harness";
import { BOTH_ELEVENS, FULL_TIME_READ, HULL_EVERTON, KICKOFF } from "../../support/convex/matchStats.harness";
import { REPLAY_MINUTES, stagedGw6, stageTime } from "../../support/convex/liveStats.harness";
import { actingAs } from "../../support/convex/leagues.harness";
import { ANN, DEADLINE, ELEVENS, footballSyncAt, leagueWorld, liveTickAt, miniBetaLeague, type MiniBeta } from "../../support/convex/miniBeta.harness";

// #45's done: "A replayed match plays out on the page from its lineups to full time, the owned
// players carrying their teams and points." The four-team league's Hull v Everton, gameweek 6 as
// recorded, through the live tick as its cron runs it: the team sheets half an hour before kickoff,
// the first half, and full time, the page read as Ann at each.

const HALF_AN_HOUR_BEFORE = KICKOFF - SHEETS_BEFORE_KICKOFF_MS / 2;
const FIRST_HALF = 30;

async function pageAs(league: MiniBeta, email: string): Promise<MatchPage> {
  const page = await (await actingAs(league.t, email)).query(api.match.matchPage.ofMatch, { leagueId: league.leagueId, fixtureCode: HULL_EVERTON });
  if (page === null) throw new Error("the match page found no match");
  return page;
}

/** Ann's eleven as the page has them: each with her team's name, and the points that count. */
function annsMen(page: MatchPage, teamName: string) {
  const eleven = new Set(ELEVENS[ANN].map((man) => man.playerCode));
  const men = page.men.filter((man) => eleven.has(man.playerCode));
  expect(men).toHaveLength(eleven.size);
  expect(men.every((man) => man.ownerTeamName === teamName)).toBe(true);
  return men;
}

test("the match page plays out from its team sheets before kickoff to full time, Ann's men carrying her team and points", async () => {
  const beforeKickoff = () => leagueWorld(recordedGw6(), { beforeKickoff: true });
  const league = await miniBetaLeague(beforeKickoff());
  const teamName = (await league.t.run((ctx) => ctx.db.get("teams", league.teams.get(ANN)!)))!.name;
  await footballSyncAt(league.t, DEADLINE + MINUTE_MS, beforeKickoff());
  expect((await pageAs(league, ANN)).men).toEqual([]);

  // Half an hour before kickoff: both sheets, every man not yet played, and no record kept.
  await liveTickAt(league.t, HALF_AN_HOUR_BEFORE, beforeKickoff());
  const sheets = await pageAs(league, ANN);
  expect(sheets.men.filter((man) => man.started)).toHaveLength(BOTH_ELEVENS);
  expect(sheets.men.every((man) => man.played === null)).toBe(true);
  annsMen(sheets, teamName);
  expect(await league.t.run((ctx) => ctx.db.query("playerMatchStats").collect())).toEqual([]);

  // In play, and at full time: the same men, now with what they have done, and Ann's points.
  for (const minute of [FIRST_HALF, REPLAY_MINUTES]) {
    await liveTickAt(league.t, stageTime(minute), leagueWorld(stagedGw6(minute)));
    const live = await pageAs(league, ANN);
    expect(live.men.map((man) => man.playerCode).toSorted()).toEqual(sheets.men.map((man) => man.playerCode).toSorted());
    expect(annsMen(live, teamName).every((man) => man.points !== null)).toBe(true);
  }
  await liveTickAt(league.t, FULL_TIME_READ, leagueWorld(recordedGw6()));
  const final = annsMen(await pageAs(league, ANN), teamName);
  expect(inTenths(final.reduce((sum, man) => sum + (man.counts ? man.points! : 0), 0))).toBe(HULL_POINTS);
});
