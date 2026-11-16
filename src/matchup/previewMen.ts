// The matchup preview's men (preview.ts) as the replay plays them: each one's match and his points
// at full time, by name, and how the opponent's eleven line up. preview.ts reads the men themselves
// from My team's and Scouting's previews.

import type { Area, Cell } from "../../convex/lineup/pitch";

/** A man: his code, name, club and squad number, his area and, a starter, his cell (a starter
 *  with none takes his area's next lane), which match he plays (0 first, 1 second), and his points
 *  at full time; a keeper with no match minutes didn't play. */
export type Man = { code: number; name: string; clubCode: number; number: number | null; area: Area; cell: Cell | null; match: 0 | 1; points: number };
export type Men = { starters: Man[]; bench: Man[] };

/** The manager's men's match and points at full time, by name, so League home's recap holds
 *  (Haaland 18, Saka 15, Palmer 12); one not named plays the second match for a point. */
export const MY_MATCHES: Record<string, readonly [0 | 1, number]> = {
  Pickford: [0, 0],
  Gvardiol: [1, 1],
  Gabriel: [0, 2],
  "Van Dijk": [1, 1],
  Muñoz: [0, 1],
  Guimarães: [1, 2],
  Rice: [0, 1],
  Rogers: [1, 2],
  Palmer: [0, 12],
  Saka: [0, 15],
  Haaland: [1, 18],
  Henderson: [1, 2],
  Murillo: [0, 0],
  Mbeumo: [1, 2],
  Watkins: [0, 0],
};
/** His opponent's, likewise. */
export const THEIR_MATCHES: Record<string, readonly [0 | 1, number]> = {
  Sánchez: [1, 5],
  Konaté: [0, 7],
  Cucurella: [0, 1],
  Saliba: [0, 5],
  "Mac Allister": [1, 3],
  "Enzo Fernández": [1, 4],
  "Bruno Fernandes": [0, 9],
  Ødegaard: [1, 3],
  Ekitiké: [0, 4],
  Mateta: [1, 10],
  Bowen: [1, 3],
  Pope: [0, 2],
  Timber: [1, 1],
  Kluivert: [0, 3],
  Thiago: [1, 2],
};
/** The man on each side whose points make the side's total the table's for the gameweek. */
export const [MY_BALANCER, THEIR_BALANCER] = ["Rogers", "Mateta"];
/** The opponent's eleven's areas, in Scouting's order, a 3-4-3; the rest are his bench. */
export const THEIR_AREAS: readonly Area[] = ["goalkeeper", "defence", "defence", "defence", "midfield", "midfield", "midfield", "midfield", "attack", "attack", "attack"];

export const matchOf = (table: Record<string, readonly [0 | 1, number]>, name: string): readonly [0 | 1, number] => table[name] ?? [1, 1];
