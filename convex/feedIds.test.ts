import { expect, test } from "vitest";
import { codesByOpta, fixtureCodeIn, matchPlayers, namedMen } from "./feedIds";
import { fplElementsWithout, FULL_STATS, MATCH, recordedGw6, recordedPlFixture } from "./recorded/gw6.payloads";

const { fpl, pl } = recordedGw6();
const fplCodes = fpl.fixtures.map((fixture) => fixture.code);
const hullEverton = recordedPlFixture(MATCH.hullEverton.pl);
const codeByOpta = codesByOpta(fpl.bootstrap.elements);

test("every fixture of the Premier League's gameweek carries one of FPL's codes, as g + the code", () => {
  const codes = new Map(pl.round.content.map((fixture) => [fixture.id, fixtureCodeIn(fixture)]));

  expect(codes.size).toBe(10);
  expect(new Set(codes.values())).toEqual(new Set(fplCodes));
  for (const { pl: plId, code } of Object.values(MATCH)) expect(codes.get(plId)).toBe(code);
});

test("the full fixture read carries the fixture's altIds too", () => {
  expect(fixtureCodeIn(hullEverton)).toBe(MATCH.hullEverton.code);
});

test("a fixture read without altIds carries no FPL fixture code", () => {
  expect(fixtureCodeIn({ ...hullEverton, altIds: undefined })).toBeNull();
});

test("an Opta id in another form carries no FPL fixture code", () => {
  for (const opta of ["2645250", "g", "g2645250x", "t88"]) {
    expect(fixtureCodeIn({ ...hullEverton, altIds: { opta } })).toBeNull();
  }
});

test("every man named for Hull v Everton matches FPL's player with his opta_code, p + code", () => {
  const { codes, unmatched } = matchPlayers(hullEverton, codeByOpta);

  expect(unmatched).toEqual([]);
  expect(codes.size).toBe(40);
  expect(codes.get(FULL_STATS.coyle.pl)).toBe(FULL_STATS.coyle.code);
  for (const element of fpl.bootstrap.elements) expect(element.opta_code).toBe(`p${element.code}`);
});

test("a named man FPL does not list is reported with his name, not dropped", () => {
  const { codes, unmatched } = matchPlayers(hullEverton, codesByOpta(fplElementsWithout(FULL_STATS.coyle.code)));

  expect(unmatched).toEqual([{ plPlayerId: FULL_STATS.coyle.pl, name: "Lewie Coyle", opta: "p193278" }]);
  expect(codes.size).toBe(39);
});

test("a side not yet named has no men, and the other side's still match", () => {
  const halfNamed = { ...hullEverton, teamLists: [null, hullEverton.teamLists![1]] };

  expect(namedMen(halfNamed)).toHaveLength(20);
  expect(matchPlayers(halfNamed, codeByOpta).unmatched).toEqual([]);
});

test("a player FPL gives no opta_code is left out of the join", () => {
  const [first, ...rest] = fpl.bootstrap.elements;
  expect(codesByOpta([{ ...first, opta_code: null }, ...rest]).size).toBe(rest.length);
});

test("an opta_code FPL gives two players throws rather than match the wrong one", () => {
  const [first, second] = fpl.bootstrap.elements;
  expect(() => codesByOpta([first, { ...second, opta_code: first.opta_code }])).toThrow(
    `FPL gave opta_code ${first.opta_code} to two players`,
  );
});
