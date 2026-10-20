// Which gameweeks a league plays (#74; spec/13, Gameweeks): every one of FPL's season unless its
// commissioner unticked it. An unticked gameweek scores nothing and has no head-to-head, which is
// for scoring (#29) and the fixtures (#33) to apply with `isGameweekUsed`; waivers, free agency
// and trades carry on through it. With no imports, so the screens can read it too.

/** FPL's season has gameweeks 1 to 38: FPL's rule, so a constant. */
export const GAMEWEEKS = 38;

/** What of a league this reads: the gameweeks its commissioner unticked, stored as the league's
 *  `unusedGameweeks`. Absent while it plays them all. */
export type WithUnusedGameweeks = { unusedGameweeks?: readonly number[] };

/** Whether this is one of the season's gameweeks. */
export const isGameweek = (gameweek: number) => Number.isInteger(gameweek) && gameweek >= 1 && gameweek <= GAMEWEEKS;

/** Whether the league plays this gameweek. Asking of a gameweek the season doesn't have is a bug
 *  in the caller, so it throws. */
export function isGameweekUsed(league: WithUnusedGameweeks, gameweek: number): boolean {
  if (!isGameweek(gameweek)) throw new Error(`There's no gameweek ${gameweek}: a season has 1 to ${GAMEWEEKS}`);
  return !(league.unusedGameweeks ?? []).includes(gameweek);
}

/** The league's unticked gameweeks, in order, once this one is ticked (`used`) or unticked. */
export function unusedAfter(league: WithUnusedGameweeks, gameweek: number, used: boolean): number[] {
  const others = (league.unusedGameweeks ?? []).filter((each) => each !== gameweek);
  return used ? others : [...others, gameweek].sort((a, b) => a - b);
}
