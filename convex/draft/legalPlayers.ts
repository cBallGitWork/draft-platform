import type { Area } from "../lineup/pitch";
import type { LeagueRules } from "../rules/leagueRulesShape";
import { areasShort } from "../squads/areaMinimums";

// Which players a team may draft (spec/04, The picks; #1088). A pick that would break the squad's
// rules is greyed out: a player whose club the team is already at the league's maximum for, and
// a player whose pick would leave too few picks to reach an area's minimum. So every finished
// squad is legal. A player who plays two areas fills one minimum, as areaMinimums.ts matches them.
// Pure: no I/O.

/** A player in a squad, or one who might be picked: his club's season-stable code and the areas
 *  he plays (../lineup/pitch.ts's `areasOf`). */
export interface DraftPlayer {
  clubCode: number;
  areas: readonly Area[];
}

/** How many more players the squad needs to fill every area's minimum: the places no one in it
 *  fills, each a player's to fill. */
function placesShort(squad: readonly DraftPlayer[], minimumByArea: LeagueRules["squad"]["minimumByArea"]): number {
  if (minimumByArea === null) return 0;
  return areasShort(
    squad.map(({ areas }) => areas),
    minimumByArea,
  ).reduce((total, { players, minimum }) => total + minimum - players, 0);
}

/** Whether the team holding `squad`, with `picksLeft` picks still to make counting this one, may
 *  pick a player, under the league's squad rules. */
export function legalPlayers(
  squad: readonly DraftPlayer[],
  picksLeft: number,
  { minimumByArea, maxPerClub }: LeagueRules["squad"],
): (player: DraftPlayer) => boolean {
  return (player) => {
    if (picksLeft < 1) return false;
    if (maxPerClub !== null && squad.filter(({ clubCode }) => clubCode === player.clubCode).length >= maxPerClub) return false;
    return placesShort([...squad, player], minimumByArea) <= picksLeft - 1;
  };
}
