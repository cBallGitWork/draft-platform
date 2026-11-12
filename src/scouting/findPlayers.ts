// Scouting's name box, and the folding its Find shares with the draft room's (src/draft/playersView.ts).
// Pure, so the tests and the screens share it.

import type { ListedPlayer } from "./seam";

/** Words folded for Find: lower case with accents dropped, so "joao" finds João Pedro. */
export const folded = (words: string) => words.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** The players whose short or full name holds `typed`, folded as Find folds them: Scouting's name
 *  box. Every player while it is empty. */
export function namedPlayers<Player extends ListedPlayer>(players: readonly Player[], typed: string): Player[] {
  const text = folded(typed.trim());
  return text === "" ? [...players] : players.filter((player) => [player.name, player.fullName].some((each) => folded(each).includes(text)));
}
