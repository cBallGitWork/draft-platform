import { expect, test, vi } from "vitest";
import {
  FPL_BOOTSTRAP_URL,
  fplLiveUrl,
  PL_LAST_COMP_SEASON,
  PL_SEASON_IDS_STALE,
  PL_SEASON_IDS_STALE_FROM,
  plCommentaryUrl,
  plFixturesUrl,
  plFixtureUrl,
  plPlayerStatsUrl,
  plSquadUrl,
  plTeamStatsUrl,
} from "../../../convex/football/football";
import { readFplBootstrap } from "../../../convex/football/fpl";
import { readFplLive } from "../../../convex/football/fplLive";
import {
  readPlCommentary,
  readPlFixture,
  readPlFixtures,
  readPlPlayerStats,
  readPlSquad,
  readPlTeamStats,
  squadNumbers,
} from "../../../convex/football/premierLeague";
import {
  COMMENTARY_MATCH,
  recordedCommentary,
  recordedTeamStats,
  UPCOMING_MATCH,
} from "../../support/recorded/commentary.payloads";
import { LIVE_MATCH, recordedLiveTeamStats } from "../../support/recorded/live.payloads";

/** Answers each URL with its body in `bodies`, or every URL with `status` and no body when one is
 *  given; records the URLs. A URL with no body is the test's mistake: it fails the read. */
function fakeFeed(bodies: Record<string, unknown>, status = 200) {
  const fetch = vi.fn(async (url: string) => {
    if (status !== 200) return new Response("Forbidden", { status });
    if (!(url in bodies)) throw new Error(`the fake feed has no body for ${url}`);
    return Response.json(bodies[url]);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

test.each([undefined, 6])("the fixture list always asks for altIds, the join to FPL (gameweek %s)", (gameweek) => {
  expect(new URL(plFixturesUrl(gameweek)).searchParams.get("altIds")).toBe("true");
});

test("one gameweek's fixture list asks for that gameweek of this season's Premier League", () => {
  const query = new URL(plFixturesUrl(6)).searchParams;
  expect(["comps", "compSeasons", "gameweekNumbers"].map((key) => query.get(key))).toEqual(["1", "841", "6"]);
  expect(new URL(plFixturesUrl()).searchParams.has("gameweekNumbers")).toBe(false);
});

test("a named season's fixture list asks for that season, with altIds", () => {
  const query = new URL(plFixturesUrl(undefined, PL_LAST_COMP_SEASON)).searchParams;
  expect(["compSeasons", "altIds"].map((key) => query.get(key))).toEqual(["777", "true"]);
});

test("the season ids go out of date on 1 July after the season they name (#201)", () => {
  expect(PL_SEASON_IDS_STALE_FROM).toBe(Date.parse("2027-07-01T00:00:00Z"));
  expect(PL_SEASON_IDS_STALE).toContain("are for 2026/27, which has ended");
  expect(PL_SEASON_IDS_STALE).toContain("https://footballapi.pulselive.com/football/competitions/1/compseasons");
});

test("from then, every read naming a season throws, saying what to update; up to then, none does (#201)", () => {
  const namingASeason = [() => plFixturesUrl(), () => plFixturesUrl(6), () => plFixturesUrl(undefined, PL_LAST_COMP_SEASON), () => plSquadUrl(1)];
  vi.useFakeTimers({ toFake: ["Date"] });

  vi.setSystemTime(PL_SEASON_IDS_STALE_FROM - 1);
  for (const url of namingASeason) expect(url).not.toThrow();

  vi.setSystemTime(PL_SEASON_IDS_STALE_FROM);
  for (const url of namingASeason) expect(url).toThrow(PL_SEASON_IDS_STALE);
  expect(plFixtureUrl(128978)).toBe("https://footballapi.pulselive.com/football/fixtures/128978");
});

test("a squad read asks for altIds, the join to FPL, as well as every kind of player", () => {
  const query = new URL(plSquadUrl(23)).searchParams;
  expect(["type", "altIds"].map((key) => query.get(key))).toEqual(["all", "true"]);
});

test("a registered player with no squad number is left out", () => {
  const numbers = squadNumbers({ players: [{ id: 10, info: { shirtNum: 4 } }, { id: 11, info: {} }, { id: 12 }] });
  expect([...numbers]).toEqual([[10, 4]]);
});

test("each read asks the URL it names and hands back all that came", async () => {
  const list = { content: [{ id: 128973 }, { id: 128977 }, { id: 128978 }] };
  const fixture = { id: 128978, teamLists: [null, null] };
  const stats = { entity: { id: 13486 }, stats: [{ name: "mins_played", value: 90 }] };
  const live = { elements: [{ id: 286, stats: {}, explain: [] }] };
  const commentary = recordedCommentary(COMMENTARY_MATCH.hullEverton);
  const teamStats = recordedTeamStats(COMMENTARY_MATCH.brentfordLiverpool);
  const lastSeason = { content: [{ id: 124909 }] };
  const squad = { players: [{ id: 13486, name: { display: "Lewie Coyle" }, info: { positionInfo: "Right Full Back" } }] };
  const bootstrap = { elements: [{ id: 1, code: 193278 }] };
  const fetch = fakeFeed({
    [plFixturesUrl(undefined, PL_LAST_COMP_SEASON)]: lastSeason,
    [plSquadUrl(41)]: squad,
    [FPL_BOOTSTRAP_URL]: bootstrap,
    [plFixturesUrl(6)]: list,
    [plFixtureUrl(128978)]: fixture,
    [plPlayerStatsUrl(13486, 128978)]: stats,
    [fplLiveUrl(6)]: live,
    [plCommentaryUrl(128978)]: commentary,
    [plTeamStatsUrl(128984)]: teamStats,
  });

  expect(await readPlFixtures(6)).toEqual(list.content);
  expect(await readPlFixture(128978)).toEqual(fixture);
  expect(await readPlPlayerStats(13486, 128978)).toEqual(stats);
  expect(await readFplLive(6)).toEqual(live);
  expect(await readPlCommentary(128978)).toEqual(commentary.events.content);
  expect(await readPlTeamStats(128984)).toEqual(teamStats);
  expect(await readPlFixtures(undefined, PL_LAST_COMP_SEASON)).toEqual(lastSeason.content);
  expect(await readPlSquad(41)).toEqual(squad);
  expect(await readFplBootstrap()).toEqual(bootstrap);
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    plFixturesUrl(6),
    "https://footballapi.pulselive.com/football/fixtures/128978",
    "https://footballapi.pulselive.com/football/stats/player/13486?fixtures=128978",
    "https://fantasy.premierleague.com/api/event/6/live/",
    "https://footballapi.pulselive.com/football/fixtures/128978/textstream/EN?pageSize=200&sort=desc",
    "https://footballapi.pulselive.com/football/stats/match/128984",
    plFixturesUrl(undefined, PL_LAST_COMP_SEASON),
    "https://footballapi.pulselive.com/football/teams/41/compseasons/841/staff?type=all&altIds=true",
    "https://fantasy.premierleague.com/api/bootstrap-static/",
  ]);
});

test("before a match, an empty commentary and team stats with no sides are read, not refused", async () => {
  const teamStats = recordedTeamStats(UPCOMING_MATCH);
  expect(teamStats.data).toBeUndefined();
  fakeFeed({
    [plCommentaryUrl(UPCOMING_MATCH)]: recordedCommentary(UPCOMING_MATCH),
    [plTeamStatsUrl(UPCOMING_MATCH)]: teamStats,
  });

  expect(await readPlCommentary(UPCOMING_MATCH)).toEqual([]);
  expect(await readPlTeamStats(UPCOMING_MATCH)).toEqual(teamStats);
});

test("live, the team stats are read as they come: only each side's formation before kickoff, then the match's", async () => {
  const statNames = (stats: Awaited<ReturnType<typeof readPlTeamStats>>) =>
    Object.values(stats.data ?? {}).map((side) => side.M.map((stat) => stat.name));
  const readAs = async (read: Parameters<typeof recordedLiveTeamStats>[0]) => {
    fakeFeed({ [plTeamStatsUrl(LIVE_MATCH)]: recordedLiveTeamStats(read) });
    return statNames(await readPlTeamStats(LIVE_MATCH));
  };

  expect(await readAs("beforeKickoff")).toEqual([["formation_used"], ["formation_used"]]);
  for (const read of ["firstMoved", "final"] as const) {
    for (const side of await readAs(read)) expect(side.length).toBeGreaterThan(1);
  }
});

test("a commentary longer than one read holds throws rather than lose its oldest lines", async () => {
  const match = COMMENTARY_MATCH.hullEverton;
  const commentary = recordedCommentary(match);
  commentary.events.pageInfo.numPages = 2;
  fakeFeed({ [plCommentaryUrl(match)]: commentary });

  await expect(readPlCommentary(match)).rejects.toThrow(`${plCommentaryUrl(match)} has 2 pages: more than 200 lines`);
});

const URL_OF = {
  list: plFixturesUrl(6),
  fixture: plFixtureUrl(128978),
  stats: plPlayerStatsUrl(13486, 128978),
  live: fplLiveUrl(6),
  commentary: plCommentaryUrl(128978),
  teamStats: plTeamStatsUrl(128984),
  squad: plSquadUrl(41),
  bootstrap: FPL_BOOTSTRAP_URL,
};
const READ_OF = {
  list: () => readPlFixtures(6),
  fixture: () => readPlFixture(128978),
  stats: () => readPlPlayerStats(13486, 128978),
  live: () => readFplLive(6),
  commentary: () => readPlCommentary(128978),
  teamStats: () => readPlTeamStats(128984),
  squad: () => readPlSquad(41),
  bootstrap: () => readFplBootstrap(),
};

test.each([
  ["a fixture list with no list", "list", {}, "list of fixtures with ids"],
  ["a fixture list with a fixture with no id", "list", { content: [{ id: 1 }, {}] }, "list of fixtures with ids"],
  ["a fixture with no id", "fixture", { content: [] }, "fixture id"],
  ["a fixture as null", "fixture", null, "fixture id"],
  ["a player's stats with no entity", "stats", { stats: [] }, "player entity and stats list"],
  ["a player's stats with no stats", "stats", { entity: { id: 13486 } }, "player entity and stats list"],
  ["FPL's live stats with no players", "live", { content: [] }, "list of players with ids"],
  ["FPL's live stats with a player with no id", "live", { elements: [{ stats: {} }] }, "list of players with ids"],
  ["a commentary with no lines", "commentary", { events: { pageInfo: { numPages: 1 } } }, "list of commentary lines with ids"],
  ["a commentary with no page count", "commentary", { events: { content: [] } }, "list of commentary lines with ids"],
  ["a commentary line with no id", "commentary", { events: { pageInfo: { numPages: 1 }, content: [{ type: "goal" }] } }, "list of commentary lines with ids"],
  ["team stats with no entity", "teamStats", { data: {} }, "match entity and each side's stats list"],
  ["team stats with a side with no list", "teamStats", { entity: { id: 128984 }, data: { "130": {} } }, "match entity and each side's stats list"],
  ["team stats whose sides are not an object", "teamStats", { entity: { id: 128984 }, data: null }, "match entity and each side's stats list"],
  ["a squad with no list", "squad", { team: {} }, "list of players with ids"],
  ["a squad with a player with no id", "squad", { players: [{ id: 1 }, { name: {} }] }, "list of players with ids"],
  ["FPL's bootstrap with no players", "bootstrap", { teams: [] }, "list of players"],
] as const)("%s, answered 200, throws with its URL and what is missing", async (_what, read, body, missing) => {
  fakeFeed({ [URL_OF[read]]: body });

  await expect(READ_OF[read]()).rejects.toThrow(`${URL_OF[read]} answered with no ${missing}`);
});

test.each([
  ["the fixture list", () => readPlFixtures(6), plFixturesUrl(6)],
  ["a fixture", () => readPlFixture(128978), plFixtureUrl(128978)],
  ["a player's stats", () => readPlPlayerStats(13486, 128978), plPlayerStatsUrl(13486, 128978)],
  ["FPL's live stats", () => readFplLive(6), fplLiveUrl(6)],
  ["a match's commentary", () => readPlCommentary(128978), plCommentaryUrl(128978)],
  ["a match's team stats", () => readPlTeamStats(128984), plTeamStatsUrl(128984)],
  ["a club's squad", () => readPlSquad(41), plSquadUrl(41)],
  ["FPL's bootstrap", () => readFplBootstrap(), FPL_BOOTSTRAP_URL],
] as const)("a refused read of %s throws with its URL and status", async (_what, read, url) => {
  fakeFeed({}, 403);

  await expect(read()).rejects.toThrow(`${url} answered 403`);
});
