// Whom auto-pick takes (spec/04, Auto-pick and The queue and the ranking; #1094): the best player
// left in the team's queue; when the queue is out, the best in the admin's ranking; then every
// player the ranking leaves out, or every player while none is uploaded, by last season's points,
// high to low, players level on points A to Z by the name the site shows, and newcomers, not in
// last season's data, after them all, A to Z (Craig, 2 and 4 Nov 2026; 5 Nov 2026 in chat). It
// never takes from the do-not-draft list, unless every player it may legally take is on it: then
// it ignores the list for that pick only and takes the best of them by the same order (Craig,
// 5 Nov 2026 in chat). Pure: no I/O. Which players are free and legal is the caller's to check,
// walking this order (draftPicks.ts `autoPick`).

/** A player auto-pick may take: his FPL code and the name the site shows. */
export interface AutoPickPlayer {
  code: number;
  name: string;
}

export interface AutoPickLists {
  /** The team's queue, by FPL code, first choice first. */
  queue: readonly number[];
  /** The team's do-not-draft list, by FPL code. */
  doNotDraft: readonly number[];
}

/** `players` in the order auto-pick tries them for a team: everyone off its do-not-draft list,
 *  then everyone on it, each part queue first, then the admin's `rankedCodes` (best first, or empty
 *  while none is uploaded), then by `points` last season and newcomers by name. */
export function autoPickOrder(
  players: readonly AutoPickPlayer[],
  { queue, doNotDraft }: AutoPickLists,
  rankedCodes: readonly number[],
  points: ReadonlyMap<number, number>,
): number[] {
  const byCode = new Map(players.map((player) => [player.code, player]));
  const ordered: number[] = [];
  const placed = new Set<number>();
  const place = (code: number) => {
    if (byCode.has(code) && !placed.has(code)) {
      placed.add(code);
      ordered.push(code);
    }
  };
  queue.forEach(place);
  rankedCodes.forEach(place);
  fallbackRanking(players, points).forEach(place);
  const shunned = new Set(doNotDraft);
  return [...ordered.filter((code) => !shunned.has(code)), ...ordered.filter((code) => shunned.has(code))];
}

/** The ranking auto-pick falls back on, by FPL code: `players` by last season's points
 *  (pastSeasons/lastSeasonPoints.ts), high to low, level players A to Z by name, then newcomers, missing from
 *  `points`, A to Z. */
export function fallbackRanking(players: readonly AutoPickPlayer[], points: ReadonlyMap<number, number>): number[] {
  return [...players].sort((one, other) => byPoints(one, other, points)).map(({ code }) => code);
}

/** Last season's points high to low, level players A to Z by name, newcomers after all, A to Z. */
function byPoints(one: AutoPickPlayer, other: AutoPickPlayer, points: ReadonlyMap<number, number>): number {
  const [mine, theirs] = [points.get(one.code), points.get(other.code)];
  if (mine !== theirs) {
    if (mine === undefined) return 1;
    if (theirs === undefined) return -1;
    return theirs - mine;
  }
  return one.name.localeCompare(other.name);
}
