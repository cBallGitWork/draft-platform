import { expect, test, vi } from "vitest";
import { plCompSeasonsUrl } from "../../../../convex/football/football";
import { fplSeason } from "../../../../convex/football/fpl/fpl";
import {
  labelStartYear,
  pickPlSeasons,
  plSeasonMissing,
  readPlSeasons,
} from "../../../../convex/football/premierLeague/plSeasons";
import { fakeFetch } from "../../../support/convex/test.harness";
import { FPL_SEASON, PL_LAST_SEASON, PL_THIS_SEASON, plSeasonList, plSeasonsBody } from "../../../support/recorded/plSeasons.payloads";

test.each([
  ["English Premier League Season 2026/2027", 2026],
  ["2025/26", 2025],
  ["1992/93", 1992],
  ["Premier League", null],
])("the label %s says its season starts in %s", (label, year) => {
  expect(labelStartYear(label)).toBe(year);
});

test("the season FPL is on and the one before are found by their labels, whatever their order (#300)", () => {
  const seasons = plSeasonList();
  expect(pickPlSeasons(seasons, FPL_SEASON)).toEqual({ current: PL_THIS_SEASON, last: PL_LAST_SEASON });
  expect(pickPlSeasons(seasons.reverse(), FPL_SEASON)).toEqual({ current: PL_THIS_SEASON, last: PL_LAST_SEASON });
});

test("a newer season already listed is not taken while FPL is still on the one before (#300)", () => {
  const seasons = [{ label: "English Premier League Season 2027/2028", id: 900 }, ...plSeasonList()];
  expect(pickPlSeasons(seasons, FPL_SEASON)).toEqual({ current: PL_THIS_SEASON, last: PL_LAST_SEASON });
  expect(pickPlSeasons(seasons, FPL_SEASON + 1)).toEqual({ current: 900, last: PL_THIS_SEASON });
});

test("a season the list lacks throws, naming the season looked for and the one FPL is on (#300)", () => {
  expect(() => pickPlSeasons(plSeasonList(), FPL_SEASON + 1)).toThrow(plSeasonMissing(FPL_SEASON + 1, FPL_SEASON + 1));
  expect(plSeasonMissing(2027, 2027)).toBe(
    `The Premier League lists no 2027/28 at ${plCompSeasonsUrl()}, looked for as FPL is on 2027/28`,
  );
  const lastMissing = plSeasonList().filter((season) => season.id !== PL_LAST_SEASON);
  expect(() => pickPlSeasons(lastMissing, FPL_SEASON)).toThrow(plSeasonMissing(FPL_SEASON - 1, FPL_SEASON));
});

test("two seasons with the same label throw rather than pick one (#300)", () => {
  const twice = [...plSeasonList(), { label: "2026/27", id: 999 }];
  expect(() => pickPlSeasons(twice, FPL_SEASON)).toThrow(plSeasonMissing(FPL_SEASON, FPL_SEASON, 2));
});

test.each([
  ["a paged list", { content: plSeasonList() }],
  ["a bare list", plSeasonList()],
])("the list read as %s gives both ids", async (_what, body) => {
  vi.stubGlobal("fetch", fakeFetch(new Map([[plCompSeasonsUrl(), body]])));
  expect(await readPlSeasons(FPL_SEASON)).toEqual({ current: PL_THIS_SEASON, last: PL_LAST_SEASON });
});

test.each([
  ["no list", {}],
  ["a season with no label", { content: [{ id: 841 }] }],
  ["a season with no id", { content: [{ label: "2026/27" }] }],
])("a list of seasons with %s, answered 200, throws with its URL and what is missing", async (_what, body) => {
  vi.stubGlobal("fetch", fakeFetch(new Map([[plCompSeasonsUrl(), body]])));
  await expect(readPlSeasons(FPL_SEASON)).rejects.toThrow(`${plCompSeasonsUrl()} answered with no list of seasons with labels and ids`);
});

test("the list's URL asks for every season in one page", () => {
  const [url] = plSeasonsBody();
  expect(url).toBe("https://footballapi.pulselive.com/football/competitions/1/compseasons?pageSize=100");
});

test("FPL is on the season its first gameweek's deadline falls in, in any order, whatever today is", () => {
  const events = [
    { id: 38, deadline_time: "2027-05-23T13:30:00Z" },
    { id: 1, deadline_time: "2026-08-21T17:30:00Z" },
  ];
  expect(fplSeason({ events })).toBe(2026);
});

test("an FPL bootstrap with no gameweeks throws, saying the season is unknown", () => {
  expect(() => fplSeason({ events: [] })).toThrow("lists no gameweeks, so the season FPL is on is unknown");
});
