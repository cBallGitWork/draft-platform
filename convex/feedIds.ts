// How the two feeds name the same match and the same man. The Premier League keys both on its own
// ids and carries Opta's alongside (`altIds.opta`); FPL carries Opta's too, so Opta's is the join:
// a fixture's is "g" + FPL's fixture `code`, and a player's is FPL's `opta_code` (checked in
// docs/pl-match-stats.md). Only FPL's season-stable codes come out, never its per-season ids. One
// that matches nothing is reported to the caller, never dropped.

import type { RawBootstrap } from "./fpl";
import type { RawPlFixture, RawPlSquadPlayer } from "./premierLeague";

/** A Premier League fixture with no FPL fixture to match. */
export interface UnmatchedFixture {
  plFixtureId: number;
  /** What it carried as Opta's id, or null when it carried none. */
  opta: string | null;
}

/** A man a team sheet names whom FPL does not list (a new signing FPL has not added, say). */
export interface UnmatchedPlayer {
  plPlayerId: number;
  name: string;
  opta: string | null;
}

/** FPL's fixture code inside a Premier League fixture's `altIds.opta`, or null when it carries
 *  none (a read without `altIds=true`) or carries it in another form. */
export function fixtureCodeIn(fixture: RawPlFixture): number | null {
  const found = /^g(\d+)$/.exec(fixture.altIds?.opta ?? "");
  return found === null ? null : Number(found[1]);
}

/** Each Premier League fixture's FPL code, by the Premier League's fixture id. */
export function matchFixtures(
  plFixtures: RawPlFixture[],
  fplFixtureCodes: Iterable<number>,
): { codes: Map<number, number>; unmatched: UnmatchedFixture[] } {
  const known = new Set(fplFixtureCodes);
  const codes = new Map<number, number>();
  const unmatched: UnmatchedFixture[] = [];
  for (const fixture of plFixtures) {
    const code = fixtureCodeIn(fixture);
    if (code !== null && known.has(code)) codes.set(fixture.id, code);
    else unmatched.push({ plFixtureId: fixture.id, opta: fixture.altIds?.opta ?? null });
  }
  return { codes, unmatched };
}

/** FPL's `opta_code` → `code`, for every player that has one. A code given to two players is a
 *  changed payload: it throws rather than match a man to the wrong player. */
export function codesByOpta(elements: RawBootstrap["elements"]): Map<string, number> {
  const codes = new Map<string, number>();
  for (const element of elements) {
    if (element.opta_code === null) continue;
    if (codes.has(element.opta_code)) throw new Error(`FPL gave opta_code ${element.opta_code} to two players`);
    codes.set(element.opta_code, element.code);
  }
  return codes;
}

/** Every man either side named, starters then substitutes. A side not yet named is a null entry. */
export function namedMen(fixture: RawPlFixture): RawPlSquadPlayer[] {
  return (fixture.teamLists ?? []).flatMap((list) => (list === null ? [] : [...list.lineup, ...list.substitutes]));
}

/** Each named man's FPL code, by the Premier League's player id. */
export function matchPlayers(
  fixture: RawPlFixture,
  codeByOpta: ReadonlyMap<string, number>,
): { codes: Map<number, number>; unmatched: UnmatchedPlayer[] } {
  const codes = new Map<number, number>();
  const unmatched: UnmatchedPlayer[] = [];
  for (const man of namedMen(fixture)) {
    const opta = man.altIds?.opta ?? null;
    const code = opta === null ? undefined : codeByOpta.get(opta);
    if (code !== undefined) codes.set(man.id, code);
    else unmatched.push({ plPlayerId: man.id, name: man.name.display, opta });
  }
  return { codes, unmatched };
}
