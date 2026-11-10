// Positions from Sportmonks' lineups (#1419, spec/06 `S06.2`-`S06.4`): a played match's starters
// placed through the formation table, and Sportmonks' own label for a man with no starts.

import { expect, test } from "vitest";
import { labelOf, matchStarts, sportmonksPositionsOf, startPosition, type SportmonksStart } from "../../../../convex/football/sportmonks/sportmonksPositions";
import { FORMATION_PLACES } from "../../../../convex/positions/positionTables";
import { LINEUPS, sportmonksLineupsMatch } from "../../../support/recorded/sportmonksLineups.payloads";

const SEASON = 2025;
const positionsIn = (team: readonly number[]) => {
  const starts = matchStarts(sportmonksLineupsMatch(), SEASON);
  return team.map((player) => startPosition(starts.find((each) => each.playerCode === player)!.start));
};

test("a 4-3-3's three midfielders are CM, its wide forwards W", () => {
  expect(positionsIn(LINEUPS.celtic433)).toEqual(["GK", "FB", "CB", "CB", "FB", "CM", "CM", "CM", "W", "ST", "W"]);
});

test("a 4-2-3-1's two deepest midfielders are CDM, the one behind the striker CAM", () => {
  expect(positionsIn(LINEUPS.rangers4231)).toEqual(["GK", "FB", "CB", "CB", "FB", "CDM", "CDM", "W", "CAM", "W", "ST"]);
});

test("only the starters start: the bench gives no start", () => {
  const starters = matchStarts(sportmonksLineupsMatch(), SEASON).map((each) => each.playerCode);
  expect(starters).toHaveLength(22);
  expect(starters).not.toContain(LINEUPS.celticBench);
  expect(starters).not.toContain(LINEUPS.rangersBench);
});

test("a start keeps its match, kickoff, season, formation place and detailed position", () => {
  const [keeper] = matchStarts(sportmonksLineupsMatch(), SEASON);
  expect(keeper).toEqual({
    playerCode: LINEUPS.celtic433[0],
    start: { fixtureCode: LINEUPS.match, kickoff: Date.parse("2025-09-01T11:30:00Z"), season: SEASON, formation: "4-3-3", line: 0, place: 0, detailedPosition: "Goalkeeper" },
  });
});

test("a side with no formation places its men by their detailed position, where it names one position", () => {
  const match = sportmonksLineupsMatch();
  match.formations = [];
  const starts = matchStarts(match, SEASON);
  const of = (player: number) => startPosition(starts.find((each) => each.playerCode === player)!.start);
  expect(of(LINEUPS.celtic433[1])).toBe("FB");
  expect(of(LINEUPS.rangers4231[5])).toBe("CDM");
});

test("a formation field of another shape fails the match, naming it, never guessed at", () => {
  const match = sportmonksLineupsMatch();
  match.lineups![0].formation_field = "keeper";
  expect(() => matchStarts(match, SEASON)).toThrow(/formation field "keeper" in match 19100001/);
});

test("each row of the formation table reads the same from either flank, so Sportmonks' column order can't matter", () => {
  for (const lines of Object.values(FORMATION_PLACES)) for (const line of lines) expect([...line].reverse()).toEqual(line);
});

const start = (fixtureCode: number, formation: string | null, line: number | null, place: number | null, detailedPosition: string | null = null): SportmonksStart => ({
  fixtureCode,
  kickoff: fixtureCode,
  season: SEASON,
  formation,
  line,
  place,
  detailedPosition,
});

test("a man with no starts takes Sportmonks' label: 'Defender' gives CB and FB, each unconfirmed", () => {
  expect(sportmonksPositionsOf([], "Defender")).toEqual({
    positions: [
      { position: "CB", source: "label", confirmed: false, flaggedElsewhere: null },
      { position: "FB", source: "label", confirmed: false, flaggedElsewhere: null },
    ],
    unknownFormations: [],
    unknownLabel: null,
  });
});

test("3 starts at a place give him it, unconfirmed until the admin approves it, and his label then counts for nothing", () => {
  const starts = [1, 2, 3].map((match) => start(match, "4-2-3-1", 2, 0));
  expect(sportmonksPositionsOf(starts, "Central Midfield").positions).toEqual([{ position: "CDM", source: "starts", confirmed: false, flaggedElsewhere: null }]);
});

test("under 3 starts anywhere he plays on his label; a formation or label the tables don't know is reported", () => {
  const starts = [start(1, "4-2-3-1", 2, 0), start(2, "2-3-5", 2, 0)];
  expect(sportmonksPositionsOf(starts, "Sweeper")).toEqual({ positions: [], unknownFormations: ["2-3-5"], unknownLabel: "Sweeper" });
  expect(sportmonksPositionsOf(starts, "Right Back").positions.map((each) => each.position)).toEqual(["FB"]);
});

test("a squad man's label is his detailed position, or else his broad one", () => {
  const position = { id: 25, name: "Defender" };
  expect(labelOf({ id: 1, name: "A", position, detailedposition: { id: 148, name: "Centre Back" } })).toBe("Centre Back");
  expect(labelOf({ id: 1, name: "A", position, detailedposition: null })).toBe("Defender");
  expect(labelOf({ id: 1, name: "A" })).toBeNull();
});
