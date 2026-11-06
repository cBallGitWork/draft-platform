import { expect, test, vi } from "vitest";
import {
  FPL_BOOTSTRAP_URL,
  fplLiveUrl,
  plCommentaryUrl,
  plFixturesUrl,
  plFixtureUrl,
  plPlayerStatsUrl,
  plSquadUrl,
  plTeamStatsUrl,
} from "../../../../convex/football/football";
import { readFplBootstrap } from "../../../../convex/football/fpl/fpl";
import { readFplLive } from "../../../../convex/football/fpl/fplLive";
import {
  readPlCommentary,
  readPlFixture,
  readPlFixtures,
  readPlPlayerStats,
  readPlSquad,
  readPlTeamStats,
  squadNumbers,
} from "../../../../convex/football/premierLeague/premierLeague";
import {
  COMMENTARY_MATCH,
  recordedCommentary,
  recordedTeamStats,
  UPCOMING_MATCH,
} from "../../../support/recorded/commentary.payloads";
import { LIVE_MATCH, recordedLiveTeamStats } from "../../../support/recorded/live.payloads";
import { fakeFetch } from "../../../support/convex/test.harness";
import { PL_LAST_SEASON, PL_THIS_SEASON } from "../../../support/recorded/plSeasons.payloads";

/** Stubs fetch to answer each URL with its body in `bodies`, as `fakeFetch` does; records the URLs. */
function fakeFeed(bodies: Record<string, unknown>) {
  const fetch = fakeFetch(new Map(Object.entries(bodies)));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

/** What the Premier League's feed answers when it refuses Convex, which a refused read fakes here. */
const FORBIDDEN_STATUS = 403;

test.each([undefined, 6])("the fixture list always asks for altIds, the join to FPL (gameweek %s)", (gameweek) => {
  expect(new URL(plFixturesUrl(PL_THIS_SEASON, gameweek)).searchParams.get("altIds")).toBe("true");
});

test("one gameweek's fixture list asks for that gameweek of this season's Premier League", () => {
  const query = new URL(plFixturesUrl(PL_THIS_SEASON, 6)).searchParams;
  expect(["comps", "compSeasons", "gameweekNumbers"].map((key) => query.get(key))).toEqual(["1", "841", "6"]);
  expect(new URL(plFixturesUrl(PL_THIS_SEASON)).searchParams.has("gameweekNumbers")).toBe(false);
});

test("a named season's fixture list asks for that season, with altIds", () => {
  const query = new URL(plFixturesUrl(PL_LAST_SEASON)).searchParams;
  expect(["compSeasons", "altIds"].map((key) => query.get(key))).toEqual(["777", "true"]);
});

test("a squad read asks for altIds, the join to FPL, as well as every kind of player", () => {
  const query = new URL(plSquadUrl(23, PL_THIS_SEASON)).searchParams;
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
    [plFixturesUrl(PL_LAST_SEASON)]: lastSeason,
    [plSquadUrl(41, PL_THIS_SEASON)]: squad,
    [FPL_BOOTSTRAP_URL]: bootstrap,
    [plFixturesUrl(PL_THIS_SEASON, 6)]: list,
    [plFixtureUrl(128978)]: fixture,
    [plPlayerStatsUrl(13486, 128978)]: stats,
    [fplLiveUrl(6)]: live,
    [plCommentaryUrl(128978)]: commentary,
    [plTeamStatsUrl(128984)]: teamStats,
  });

  expect(await readPlFixtures(PL_THIS_SEASON, 6)).toEqual(list.content);
  expect(await readPlFixture(128978)).toEqual(fixture);
  expect(await readPlPlayerStats(13486, 128978)).toEqual(stats);
  expect(await readFplLive(6)).toEqual(live);
  expect(await readPlCommentary(128978)).toEqual(commentary.events.content);
  expect(await readPlTeamStats(128984)).toEqual(teamStats);
  expect(await readPlFixtures(PL_LAST_SEASON)).toEqual(lastSeason.content);
  expect(await readPlSquad(41, PL_THIS_SEASON)).toEqual(squad);
  expect(await readFplBootstrap()).toEqual(bootstrap);
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    plFixturesUrl(PL_THIS_SEASON, 6),
    "https://footballapi.pulselive.com/football/fixtures/128978",
    "https://footballapi.pulselive.com/football/stats/player/13486?fixtures=128978",
    "https://fantasy.premierleague.com/api/event/6/live/",
    "https://footballapi.pulselive.com/football/fixtures/128978/textstream/EN?pageSize=200&sort=desc",
    "https://footballapi.pulselive.com/football/stats/match/128984",
    plFixturesUrl(PL_LAST_SEASON),
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
  list: plFixturesUrl(PL_THIS_SEASON, 6),
  fixture: plFixtureUrl(128978),
  stats: plPlayerStatsUrl(13486, 128978),
  live: fplLiveUrl(6),
  commentary: plCommentaryUrl(128978),
  teamStats: plTeamStatsUrl(128984),
  squad: plSquadUrl(41, PL_THIS_SEASON),
  bootstrap: FPL_BOOTSTRAP_URL,
};
const READ_OF = {
  list: () => readPlFixtures(PL_THIS_SEASON, 6),
  fixture: () => readPlFixture(128978),
  stats: () => readPlPlayerStats(13486, 128978),
  live: () => readFplLive(6),
  commentary: () => readPlCommentary(128978),
  teamStats: () => readPlTeamStats(128984),
  squad: () => readPlSquad(41, PL_THIS_SEASON),
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
  ["the fixture list", () => readPlFixtures(PL_THIS_SEASON, 6), plFixturesUrl(PL_THIS_SEASON, 6)],
  ["a fixture", () => readPlFixture(128978), plFixtureUrl(128978)],
  ["a player's stats", () => readPlPlayerStats(13486, 128978), plPlayerStatsUrl(13486, 128978)],
  ["FPL's live stats", () => readFplLive(6), fplLiveUrl(6)],
  ["a match's commentary", () => readPlCommentary(128978), plCommentaryUrl(128978)],
  ["a match's team stats", () => readPlTeamStats(128984), plTeamStatsUrl(128984)],
  ["a club's squad", () => readPlSquad(41, PL_THIS_SEASON), plSquadUrl(41, PL_THIS_SEASON)],
  ["FPL's bootstrap", () => readFplBootstrap(), FPL_BOOTSTRAP_URL],
] as const)("a refused read of %s throws with its URL and status", async (_what, read, url) => {
  vi.stubGlobal("fetch", fakeFetch(new Map(), () => true, FORBIDDEN_STATUS));

  await expect(read()).rejects.toThrow(`${url} answered ${FORBIDDEN_STATUS}`);
});
