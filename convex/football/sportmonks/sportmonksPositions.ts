// Positions from Sportmonks' lineups (#1419, spec/06 `S06.2`-`S06.4`): where each starter lined
// up in a played match, and what Sportmonks' own label for a player means. A start is placed by
// its side's formation and the man's `formation_field` through `FORMATION_PLACES`
// (positionTables.ts), the same table the Premier League's sheets use: a 4-2-3-1's two deepest
// midfielders are CDM, a 4-3-3's three are CM. Where that table places no one (a formation it
// doesn't know, or a lineup with none drawn), the start's detailed position places him when it
// names one position. Pure: the same match always gives the same starts.

import type { Infer } from "convex/values";
import type { sportmonksStart } from "../../schema";
import { positionsFromStarts, type HeldPosition } from "../../positions/positions";
import { placePosition, type Position } from "../../positions/positionTables";
import { kickoffOf } from "./sportmonks";
import { LINEUP_STARTER } from "./sportmonksMatch";
import { SPORTMONKS, type RawFixture, type RawPlayer } from "./sportmonksRaw";

/** One match a man started, where he lined up, and Sportmonks' detailed position for him in it. */
export type SportmonksStart = Infer<typeof sportmonksStart>;

/** Sportmonks' names for its positions, broad and detailed, as ours, without a side. A clear one
 *  maps straight across; a vague one gives every position it could mean (spec/06 `S06.4`:
 *  "Defender" is CB and FB), as the Premier League's do (positionTables.ts). A name not here gives
 *  none, and the positions read reports it so a row can be added. */
const LABEL_POSITIONS: Readonly<Record<string, readonly Position[]>> = {
  Goalkeeper: ["GK"],
  "Centre Back": ["CB"],
  "Left Back": ["FB"],
  "Right Back": ["FB"],
  "Defensive Midfield": ["CDM"],
  "Central Midfield": ["CM"],
  "Left Midfield": ["WM"],
  "Right Midfield": ["WM"],
  "Attacking Midfield": ["CAM"],
  "Left Wing": ["W"],
  "Right Wing": ["W"],
  "Secondary Striker": ["SS"],
  "Centre Forward": ["ST"],
  Defender: ["CB", "FB"],
  Midfielder: ["CDM", "CM", "WM", "CAM"],
  Attacker: ["W", "SS", "ST"],
};

/** The positions one of Sportmonks' names gives, or null for a name the table doesn't know. */
export function labelPositions(label: string): Position[] | null {
  return Object.hasOwn(LABEL_POSITIONS, label) ? [...LABEL_POSITIONS[label]] : null;
}

/** Sportmonks' label for a squad man: his detailed position, or else his broad one; null with neither. */
export function labelOf(player: RawPlayer): string | null {
  return player.detailedposition?.name ?? player.position?.name ?? null;
}

/** Where a start puts him: his formation place, or else his detailed position where it names one
 *  position; null where neither does. */
export function startPosition(start: SportmonksStart): Position | null {
  const { formation, line, place, detailedPosition } = start;
  const placed = formation === null || line === null || place === null ? null : placePosition(formation, line, place);
  if (placed !== null) return placed;
  const named = detailedPosition === null ? null : labelPositions(detailedPosition);
  return named?.length === 1 ? named[0] : null;
}

/** A formation field, "row:column" counted from 1 with the keeper's row first, as a line and a
 *  place counted from 0 (`placePosition`). Every row of `FORMATION_PLACES` reads the same from
 *  either flank, so which flank Sportmonks counts its columns from places no one differently. */
function lineAndPlace(field: string, fixtureId: number): { line: number; place: number } {
  const parts = /^(\d+):(\d+)$/.exec(field);
  if (parts === null) throw new Error(`${SPORTMONKS} sent formation field ${JSON.stringify(field)} in match ${fixtureId}`);
  return { line: Number(parts[1]) - 1, place: Number(parts[2]) - 1 };
}

/** A played match's starts, each under the starter's Sportmonks id: a substitute's appearance is
 *  never a start. A side Sportmonks sent no formation for has its men's starts with none. */
export function matchStarts(match: RawFixture, season: number): { playerCode: number; start: SportmonksStart }[] {
  const kickoff = kickoffOf(match);
  if (kickoff === null) throw new Error(`${SPORTMONKS} sent played match ${match.id} with no kickoff`);
  const formations = new Map((match.formations ?? []).map((side) => [side.participant_id, side.formation]));
  return (match.lineups ?? [])
    .filter((man) => man.type_id === LINEUP_STARTER)
    .map((man) => {
      const formation = formations.get(man.team_id) ?? null;
      const drawn = man.formation_field === null ? { line: null, place: null } : lineAndPlace(man.formation_field, match.id);
      const detailedPosition = man.detailedposition?.name ?? null;
      return { playerCode: man.player_id, start: { fixtureCode: match.id, kickoff, season, formation, ...drawn, detailedPosition } };
    });
}

export interface SportmonksPositions {
  /** Each unconfirmed (spec/06): from starts until the admin approves them, from his label until
   *  he confirms it. The admin's say is #1427's, when the site reads these. */
  positions: HeldPosition[];
  /** Formations in his window that `FORMATION_PLACES` does not know. */
  unknownFormations: string[];
  /** His label, when `labelPositions` does not know it. */
  unknownLabel: string | null;
}

/** His positions: those his newest starts give him (positions.ts's window and count), or, with
 *  none, those Sportmonks' label for him gives (spec/06 `S06.4`: a new signing, or too few starts). */
export function sportmonksPositionsOf(starts: SportmonksStart[], label: string | null): SportmonksPositions {
  const fromStarts = positionsFromStarts(starts, startPosition);
  const fromLabel = label === null ? [] : labelPositions(label);
  const [source, positions] = fromStarts.positions.length > 0 ? (["starts", fromStarts.positions] as const) : (["label", fromLabel ?? []] as const);
  return {
    positions: positions.map((position) => ({ position, source, confirmed: false, flaggedElsewhere: null })),
    unknownFormations: fromStarts.unknownFormations,
    unknownLabel: fromLabel === null ? label : null,
  };
}
