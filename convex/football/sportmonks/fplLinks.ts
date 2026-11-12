// Each Sportmonks Premier League club, player and match linked to FPL's `code` for it (#1421), so
// past seasons, keyed on FPL's codes, can be converted to Sportmonks' ids (S14.16; Craig, 12 Nov
// 2026, on #1421: "one player list keyed on Sportmonks' id"). Clubs by name, matches by their
// linked clubs and kickoff, players by name within their linked club, and by date of birth where
// both feeds send one. Pure: rows in, links out. One that links to nothing, or to two, is never
// guessed: it stays unlinked with what it might be, for the admin to link by hand. Stored and run:
// fplLinksSync.ts.

import type { Infer } from "convex/values";
import type { sportmonksLinkKind } from "../../schema";

/** What is linked: a club, a man or a match. */
export type LinkKind = Infer<typeof sportmonksLinkKind>;

type Club = { code: number; name: string; shortName: string };
type Player = { code: number; name: string; fullName: string; clubCode: number; birthDate?: string };
type Match = { code: number; homeClubCode: number; awayClubCode: number; kickoff: number | null };

/** One Sportmonks row's link: FPL's code for it, or null with the FPL codes it might be, none
 *  when nothing fits and two or more when it can't tell which. */
export type Found = { code: number; fplCode: number | null; candidates: number[] };

/** Links already held, by kind: each Sportmonks code's FPL code. A held one is kept as it is (a
 *  player keeps his code from then on, #1421, and the admin's by hand stands), never worked out
 *  again, and the FPL code it holds is taken. */
export type HeldLinks = Record<LinkKind, ReadonlyMap<number, number>>;

/** Letters no accent-stripping splits off: "Ødegaard" is "odegaard". */
const LETTERS: Readonly<Record<string, string>> = { ø: "o", æ: "ae", œ: "oe", ß: "ss", ł: "l", đ: "d", ð: "d", þ: "th", ı: "i" };
/** Words in a club's name that don't tell clubs apart: "AFC Bournemouth" is "Bournemouth". */
const CLUB_FILLER = new Set(["fc", "afc"]);

/** A name's words, lower case and unaccented: "Martin Ødegaard" is ["martin", "odegaard"]. */
export function nameWords(name: string): string[] {
  const plain = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/./gu, (letter) => LETTERS[letter] ?? letter)
    .replace(/&/g, " and ");
  return plain.split(/[^a-z0-9]+/).filter(Boolean);
}

const joined = (words: string[]) => words.join(" ");
const clubKey = (name: string) => joined(nameWords(name).filter((word) => !CLUB_FILLER.has(word)));

/** Each Sportmonks club not held, linked by its name, or, where no FPL club has it, by its three
 *  letters ("Manchester United" and FPL's "Man Utd" are both MUN). */
export function linkClubs(clubs: readonly Club[], fplClubs: readonly Club[], held: ReadonlyMap<number, number>): Found[] {
  return oneEach(
    clubs.filter(({ code }) => !held.has(code)),
    (club) => {
      const byName = fplClubs.filter((fpl) => clubKey(fpl.name) === clubKey(club.name));
      if (byName.length > 0) return byName;
      return fplClubs.filter((fpl) => fpl.shortName.toUpperCase() === club.shortName.toUpperCase());
    },
    held,
  );
}

/** Each Sportmonks man not held, linked by name to a man of the FPL club his own club is linked to.
 *  Where both feeds send his date of birth, a man born on another day is never him. Of the names,
 *  the closest that fits anyone counts: the same full name, then the same short name, then one
 *  full name's every word in the other's ("David Raya" in "David Raya Martín"), then, born the
 *  same day, a word shared. */
export function linkPlayers(men: readonly Player[], fplMen: readonly Player[], clubLinks: ReadonlyMap<number, number>, held: ReadonlyMap<number, number>): Found[] {
  return oneEach(
    men.filter(({ code }) => !held.has(code)),
    (man) => {
      const fplClub = clubLinks.get(man.clubCode);
      if (fplClub === undefined) return [];
      const club = fplMen.filter((fpl) => fpl.clubCode === fplClub && !bornApart(man, fpl));
      return TIERS.map((fits) => club.filter((fpl) => fits(man, fpl))).find((found) => found.length > 0) ?? [];
    },
    held,
  );
}

function bornApart(one: Player, other: Player): boolean {
  return one.birthDate !== undefined && other.birthDate !== undefined && one.birthDate !== other.birthDate;
}

/** The name tests, closest first. */
const TIERS: readonly ((man: Player, fpl: Player) => boolean)[] = [
  (man, fpl) => joined(nameWords(man.fullName)) === joined(nameWords(fpl.fullName)),
  (man, fpl) => joined(nameWords(man.name)) === joined(nameWords(fpl.name)),
  (man, fpl) => within(nameWords(man.fullName), nameWords(fpl.fullName)),
  (man, fpl) => man.birthDate !== undefined && man.birthDate === fpl.birthDate && nameWords(man.fullName).some((word) => nameWords(fpl.fullName).includes(word)),
];

/** Whether every word of the shorter name is in the longer one. */
function within(one: string[], other: string[]): boolean {
  const [shorter, longer] = one.length <= other.length ? [one, other] : [other, one];
  return shorter.length > 0 && shorter.every((word) => longer.includes(word));
}

/** Each Sportmonks match not held, linked to the FPL match between the clubs its own are linked
 *  to, home and away, kicking off at the same time (both none for a match waiting for a date). */
export function linkMatches(matches: readonly Match[], fplMatches: readonly Match[], clubLinks: ReadonlyMap<number, number>, held: ReadonlyMap<number, number>): Found[] {
  return oneEach(
    matches.filter(({ code }) => !held.has(code)),
    (match) => {
      const home = clubLinks.get(match.homeClubCode);
      const away = clubLinks.get(match.awayClubCode);
      if (home === undefined || away === undefined) return [];
      return fplMatches.filter((fpl) => fpl.homeClubCode === home && fpl.awayClubCode === away && fpl.kickoff === match.kickoff);
    },
    held,
  );
}

/** Every row's candidates, linked where there is exactly one and no other row, held or found, has
 *  it too: an FPL code two rows claim links neither, so no FPL code is ever two rows'. */
function oneEach<Row extends { code: number }>(rows: readonly Row[], candidatesOf: (row: Row) => readonly { code: number }[], held: ReadonlyMap<number, number>): Found[] {
  const found = rows.map((row) => ({ code: row.code, candidates: candidatesOf(row).map(({ code }) => code) }));
  const claims = new Map<number, number>();
  for (const fplCode of [...held.values(), ...found.flatMap(({ candidates }) => (candidates.length === 1 ? candidates : []))]) {
    claims.set(fplCode, (claims.get(fplCode) ?? 0) + 1);
  }
  return found.map(({ code, candidates }) => {
    const [only] = candidates;
    const linked = candidates.length === 1 && only !== undefined && claims.get(only) === 1;
    return linked ? { code, fplCode: only, candidates: [] } : { code, fplCode: null, candidates };
  });
}

/** One feed's rows, as the linking reads them. */
export type LinkRows = { clubs: readonly Club[]; players: readonly Player[]; matches: readonly Match[] };

/** Every Sportmonks row not held, linked or not: clubs first, since men and matches link through
 *  their clubs' links. */
export function linkAll(sportmonks: LinkRows, fpl: LinkRows, held: HeldLinks): Record<LinkKind, Found[]> {
  const club = linkClubs(sportmonks.clubs, fpl.clubs, held.club);
  const clubLinks = withFound(held.club, club);
  return {
    club,
    player: linkPlayers(sportmonks.players, fpl.players, clubLinks, held.player),
    match: linkMatches(sportmonks.matches, fpl.matches, clubLinks, held.match),
  };
}

/** The held links with the newly found ones added: what the next kind links through. */
function withFound(held: ReadonlyMap<number, number>, found: readonly Found[]): Map<number, number> {
  const links = new Map(held);
  for (const { code, fplCode } of found) if (fplCode !== null) links.set(code, fplCode);
  return links;
}
