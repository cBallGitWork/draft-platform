import { afterEach, expect, test, vi } from "vitest";
import { fplLiveUrl, readFplLive } from "./fplLive";
import {
  plFixturesUrl,
  plFixtureUrl,
  plPlayerStatsUrl,
  readPlFixture,
  readPlFixtures,
  readPlPlayerStats,
} from "./premierLeague";

afterEach(() => vi.unstubAllGlobals());

/** Answers every URL with `body`, or with `status` and no body when one is given; records the URLs. */
function fakeFeed(body: unknown, status = 200) {
  const fetch = vi.fn(async (_url: string) =>
    status === 200 ? Response.json(body) : new Response("Forbidden", { status }),
  );
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

test("each read asks the URL it names and hands back what came", async () => {
  const fetch = fakeFeed({ content: [{ id: 128978 }] });

  expect(await readPlFixtures(6)).toEqual([{ id: 128978 }]);
  await readPlFixture(128978);
  await readPlPlayerStats(13486, 128978);
  await readFplLive(6);

  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    plFixturesUrl(6),
    "https://footballapi.pulselive.com/football/fixtures/128978",
    "https://footballapi.pulselive.com/football/stats/player/13486?fixtures=128978",
    "https://fantasy.premierleague.com/api/event/6/live/",
  ]);
});

test.each([
  ["the fixture list", () => readPlFixtures(6), plFixturesUrl(6)],
  ["a fixture", () => readPlFixture(128978), plFixtureUrl(128978)],
  ["a player's stats", () => readPlPlayerStats(13486, 128978), plPlayerStatsUrl(13486, 128978)],
  ["FPL's live stats", () => readFplLive(6), fplLiveUrl(6)],
] as const)("a refused read of %s throws with its URL and status", async (_what, read, url) => {
  fakeFeed(null, 403);

  await expect(read()).rejects.toThrow(`${url} answered 403`);
});
