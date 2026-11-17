// The matchup preview's men (preview.ts) as the replay plays them: each one's points at full time,
// by name, and how the opponent's eleven line up. preview.ts reads the men themselves from My
// team's and Scouting's previews, and each one's match from Football's (#2455).

import type { Area, Cell } from "../../convex/lineup/pitch";

/** A man: his code, name, club and squad number, his area and, a starter, his cell (a starter
 *  with none takes his area's next lane), and his points at full time; a keeper with no match
 *  minutes didn't play. He plays his club's match in Football's gameweek. */
export type Man = { code: number; name: string; clubCode: number; number: number | null; area: Area; cell: Cell | null; points: number };
export type Men = { starters: Man[]; bench: Man[] };

/** The manager's men's points at full time, by name, so League home's recap holds (Haaland 18,
 *  Saka 15, Palmer 12); one not named scores a point. */
export const MY_POINTS: Record<string, number> = {
  Pickford: 0,
  Gvardiol: 1,
  Gabriel: 2,
  "Van Dijk": 1,
  Muñoz: 1,
  Guimarães: 2,
  Rice: 1,
  Rogers: 2,
  Palmer: 12,
  Saka: 15,
  Haaland: 18,
  Henderson: 2,
  Murillo: 0,
  Mbeumo: 2,
  Watkins: 0,
};
/** His opponent's, likewise. */
export const THEIR_POINTS: Record<string, number> = {
  Sánchez: 5,
  Konaté: 7,
  Cucurella: 1,
  Saliba: 5,
  "Mac Allister": 3,
  "Enzo Fernández": 4,
  "Bruno Fernandes": 9,
  Ødegaard: 3,
  Ekitiké: 4,
  Mateta: 10,
  Bowen: 3,
  Pope: 2,
  Timber: 1,
  Kluivert: 3,
  Thiago: 2,
};
/** The opponent's eleven's areas, in Scouting's order, a 3-4-3; the rest are his bench. */
export const THEIR_AREAS: readonly Area[] = ["goalkeeper", "defence", "defence", "defence", "midfield", "midfield", "midfield", "midfield", "attack", "attack", "attack"];

export const pointsOf = (table: Record<string, number>, name: string): number => table[name] ?? 1;
