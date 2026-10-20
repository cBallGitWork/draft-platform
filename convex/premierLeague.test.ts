import { afterEach, expect, test, vi } from "vitest";
import { fplLiveUrl, plCommentaryUrl, plFixturesUrl, plFixtureUrl, plPlayerStatsUrl, plTeamStatsUrl } from "./football";
import { readFplLive } from "./fplLive";
import {
  readPlCommentary,
  readPlFixture,
  readPlFixtures,
  readPlPlayerStats,
  readPlTeamStats,
} from "./premierLeague";
import {
  COMMENTARY_MATCH,
  recordedCommentary,
  recordedTeamStats,
  UPCOMING_MATCH,
} from "./recorded/commentary.payloads";

afterEach(() => vi.unstubAllGlobals());

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

test("each read asks the URL it names and hands back all that came", async () => {
  const list = { content: [{ id: 128973 }, { id: 128977 }, { id: 128978 }] };
  const fixture = { id: 128978, teamLists: [null, null] };
  const stats = { entity: { id: 13486 }, stats: [{ name: "mins_played", value: 90 }] };
  const live = { elements: [{ id: 286, stats: {}, explain: [] }] };
  const commentary = recordedCommentary(COMMENTARY_MATCH.hullEverton);
  const teamStats = recordedTeamStats(COMMENTARY_MATCH.brentfordLiverpool);
  const fetch = fakeFeed({
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
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    plFixturesUrl(6),
    "https://footballapi.pulselive.com/football/fixtures/128978",
    "https://footballapi.pulselive.com/football/stats/player/13486?fixtures=128978",
    "https://fantasy.premierleague.com/api/event/6/live/",
    "https://footballapi.pulselive.com/football/fixtures/128978/textstream/EN?pageSize=200&sort=desc",
    "https://footballapi.pulselive.com/football/stats/match/128984",
  ]);
});

test("before a match, an empty commentary and team stats with no sides are read, not refused", async () => {
  const teamStats = recordedTeamStats(UPCOMING_MATCH);
  fakeFeed({
    [plCommentaryUrl(UPCOMING_MATCH)]: recordedCommentary(UPCOMING_MATCH),
    [plTeamStatsUrl(UPCOMING_MATCH)]: teamStats,
  });

  expect(await readPlCommentary(UPCOMING_MATCH)).toEqual([]);
  expect(await readPlTeamStats(UPCOMING_MATCH)).toEqual(teamStats);
  expect(teamStats.data).toBeUndefined();
});

test("a commentary longer than one read holds throws rather than lose its oldest lines", async () => {
  const commentary = recordedCommentary(COMMENTARY_MATCH.hullEverton);
  commentary.events.pageInfo.numPages = 2;
  fakeFeed({ [plCommentaryUrl(128978)]: commentary });

  await expect(readPlCommentary(128978)).rejects.toThrow(`${plCommentaryUrl(128978)} has 2 pages: more than 200 lines`);
});

const URL_OF = {
  list: plFixturesUrl(6),
  fixture: plFixtureUrl(128978),
  stats: plPlayerStatsUrl(13486, 128978),
  live: fplLiveUrl(6),
  commentary: plCommentaryUrl(128978),
  teamStats: plTeamStatsUrl(128984),
};
const READ_OF = {
  list: () => readPlFixtures(6),
  fixture: () => readPlFixture(128978),
  stats: () => readPlPlayerStats(13486, 128978),
  live: () => readFplLive(6),
  commentary: () => readPlCommentary(128978),
  teamStats: () => readPlTeamStats(128984),
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
] as const)("a refused read of %s throws with its URL and status", async (_what, read, url) => {
  fakeFeed({}, 403);

  await expect(read()).rejects.toThrow(`${url} answered 403`);
});
