// Ranking by a figure, where ties share the higher place: the stat race's ranks (#800) and the
// player card's rank at a position (#1027) alike. It imports nothing, so the screens can read it too.

/** A figure's rank among `figures`: one more than how many are higher, so the level share a rank
 *  ("1 of 8" for each of eight teams with no red card). */
export const rankAmong = (figure: number, figures: readonly number[]) => 1 + figures.filter((other) => other > figure).length;
