// Sportmonks' Premier League clubs, men and matches linked to FPL's codes (#1421): by name, by
// clubs and kickoff, by date of birth where both send it, and nothing guessed: what past seasons
// are matched to Sportmonks' players through (S14.16). Stored and run: fplLinksSync.test.ts.

import { expect, test } from "vitest";
import { linkAll, linkPlayers, nameWords, type HeldLinks } from "../../../../convex/football/sportmonks/fplLinks";
import { mapFpl } from "../../../../convex/football/fpl/fpl";
import { mapSportmonks } from "../../../../convex/football/sportmonks/sportmonks";
import { CLUB_CODE, FIXTURE_CODE, PLAYER_CODE, recordedFpl } from "../../../support/recorded/fpl.payloads";
import { SM_PL, sportmonksPremierLeague } from "../../../support/recorded/sportmonks.payloads";

const NONE_HELD: HeldLinks = { club: new Map(), player: new Map(), match: new Map() };

function recordedRows() {
  const { bootstrap, fixtures } = recordedFpl();
  const fpl = mapFpl(bootstrap, fixtures);
  const sportmonks = mapSportmonks(sportmonksPremierLeague());
  return { fpl: { ...fpl, matches: fpl.fixtures }, sportmonks: { ...sportmonks, matches: sportmonks.fixtures } };
}

test("on the recorded payloads every man links but the two strangers, which stay unlinked with nothing they might be", () => {
  const { fpl, sportmonks } = recordedRows();
  const found = linkAll(sportmonks, fpl, NONE_HELD);

  const unlinked = found.player.filter(({ fplCode }) => fplCode === null);
  expect(unlinked).toEqual([
    { code: SM_PL.wrenfield, fplCode: null, candidates: [] },
    { code: SM_PL.oyelaran, fplCode: null, candidates: [] },
  ]);
  const linked = new Map(found.player.map(({ code, fplCode }) => [code, fplCode]));
  // "Bukayo Saka" by his full name; "Erling Braut Haaland" holds every word of FPL's "Erling Haaland".
  expect(linked.get(SM_PL.saka)).toBe(PLAYER_CODE.saka);
  expect(linked.get(SM_PL.haaland)).toBe(PLAYER_CODE.haaland);
  expect([...linked.values()].filter((code) => code !== null).sort()).toEqual(fpl.players.map(({ code }) => code).sort());
});

test("every club links, by name or, where FPL names it otherwise, by its three letters, and every match by its clubs and kickoff", () => {
  const { fpl, sportmonks } = recordedRows();
  const found = linkAll(sportmonks, fpl, NONE_HELD);

  expect(found.club.every(({ fplCode }) => fplCode !== null)).toBe(true);
  const clubs = new Map(found.club.map(({ code, fplCode }) => [code, fplCode]));
  expect(clubs.get(SM_PL.arsenal)).toBe(CLUB_CODE.arsenal);
  // "Manchester City" is FPL's "Man City": both MCI.
  expect(clubs.get(SM_PL.manCity)).toBe(CLUB_CODE.manCity);
  expect(found.match.every(({ fplCode }) => fplCode !== null)).toBe(true);
  expect(found.match.find(({ code }) => code === SM_PL.arsenalCoventry)?.fplCode).toBe(FIXTURE_CODE.arsenalVCoventry);
});

test("a match kicking off at another time than FPL's, or between clubs not linked, links to nothing", () => {
  const { fpl, sportmonks } = recordedRows();
  const moved = sportmonks.matches.map((match) => (match.code === SM_PL.arsenalCoventry ? { ...match, kickoff: (match.kickoff ?? 0) + 3_600_000 } : match));
  const noClubs = linkAll({ ...sportmonks, matches: moved, clubs: [] }, fpl, NONE_HELD);
  expect(noClubs.match.every(({ fplCode, candidates }) => fplCode === null && candidates.length === 0)).toBe(true);

  const found = linkAll({ ...sportmonks, matches: moved }, fpl, NONE_HELD);
  expect(found.match.find(({ code }) => code === SM_PL.arsenalCoventry)).toEqual({ code: SM_PL.arsenalCoventry, fplCode: null, candidates: [] });
});

const ARSENAL_LINK = new Map([[SM_PL.arsenal, CLUB_CODE.arsenal]]);
const smMan = (code: number, fullName: string, birthDate?: string) => ({ code, name: fullName, fullName, clubCode: SM_PL.arsenal, ...(birthDate && { birthDate }) });
const fplMan = (code: number, fullName: string, birthDate?: string) => ({ code, name: fullName, fullName, clubCode: CLUB_CODE.arsenal, ...(birthDate && { birthDate }) });

test("two FPL men of one name at his club leave him unlinked with both, unless a date of birth tells them apart", () => {
  const twins = [fplMan(1, "Ben White", "1997-10-08"), fplMan(2, "Ben White", "2006-01-01")];

  expect(linkPlayers([smMan(10, "Ben White")], twins, ARSENAL_LINK, new Map())).toEqual([{ code: 10, fplCode: null, candidates: [1, 2] }]);
  expect(linkPlayers([smMan(10, "Ben White", "2006-01-01")], twins, ARSENAL_LINK, new Map())).toEqual([{ code: 10, fplCode: 2, candidates: [] }]);
});

test("a man born on another day than FPL's man of his name is never him", () => {
  expect(linkPlayers([smMan(10, "Ben White", "1990-01-01")], [fplMan(1, "Ben White", "1997-10-08")], ARSENAL_LINK, new Map())).toEqual([{ code: 10, fplCode: null, candidates: [] }]);
});

test("born the same day, one shared word links him: Sportmonks' 'Gabriel Magalhães' is FPL's 'Gabriel dos Santos'", () => {
  const found = linkPlayers([smMan(10, "Gabriel Magalhães", "1997-12-19")], [fplMan(1, "Gabriel dos Santos", "1997-12-19"), fplMan(2, "Gabriel Martinelli", "2001-06-18")], ARSENAL_LINK, new Map());
  expect(found).toEqual([{ code: 10, fplCode: 1, candidates: [] }]);
});

test("an FPL man two Sportmonks men both find links neither, and one already held is taken", () => {
  const fplMen = [fplMan(1, "Ben White")];
  expect(linkPlayers([smMan(10, "Ben White"), smMan(11, "Ben White")], fplMen, ARSENAL_LINK, new Map())).toEqual([
    { code: 10, fplCode: null, candidates: [1] },
    { code: 11, fplCode: null, candidates: [1] },
  ]);
  // Man 10 holds FPL's 1 already: he isn't worked out again, and man 11 can't have it.
  expect(linkPlayers([smMan(10, "Ben White"), smMan(11, "Ben White")], fplMen, ARSENAL_LINK, new Map([[10, 1]]))).toEqual([{ code: 11, fplCode: null, candidates: [1] }]);
});

test("a name's words are lower case and unaccented, Ø and all", () => {
  expect(nameWords("Martin Ødegaard")).toEqual(["martin", "odegaard"]);
  expect(nameWords("David Raya Martín")).toEqual(["david", "raya", "martin"]);
  expect(nameWords("Brighton & Hove Albion")).toEqual(["brighton", "and", "hove", "albion"]);
});
