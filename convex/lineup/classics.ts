// The classics every league starts with (spec/05, The pitch; #991): famous sides' formations, each
// a league rule like a preset, which the ready-made rules carry. A classic sets its shape, which is
// always one of the league's presets (Craig, 6 Nov 2026: "Yes, one of ours"), every slot's role and
// its two team instructions, each one its shape offers (instructions.ts; #990). Eight to start,
// their text sample until Craig rewrites it (Craig, 6 Nov 2026: "Eight to start"). A league's copy
// is held with its rules (leagueRulesShape.ts), and its rules check says a classic is sound
// (leagueRulesCheck.ts).

import { sameCell, sameShape, type Cell } from "./pitch";
import { DEFAULT_PRESETS } from "./presets";
import type { InstructionPair } from "./instructions";

/** One of a classic's slots and the role it sets there (roles.ts). */
export type ClassicSlot = Cell & { role: string };

export interface Classic {
  /** As managers say it, such as "Keegan's Newcastle": a lineup is saved with it. */
  name: string;
  /** Its season and manager, such as "1995-96, Keegan". */
  subtitle: string;
  /** What the side did, in a line. */
  description: string;
  /** One slot per starter, back to front: the cells of one of the league's presets. */
  cells: readonly ClassicSlot[];
  /** instructions.ts's keys, one a side. */
  instructions: InstructionPair;
}

/** A classic on the default preset `formation`, its roles in that preset's cell order: the keeper,
 *  then back to front, left to right. */
function classic(
  name: string,
  subtitle: string,
  description: string,
  formation: string,
  roles: readonly string[],
  instructions: InstructionPair,
): Classic {
  const preset = DEFAULT_PRESETS.find((each) => each.name === formation);
  if (preset === undefined) throw new Error(`The classic ${name} stands in ${formation}, which isn't a preset`);
  if (roles.length !== preset.cells.length) throw new Error(`The classic ${name} gives ${roles.length} roles for ${preset.cells.length} slots`);
  return { name, subtitle, description, cells: preset.cells.map((cell, index) => ({ ...cell, role: roles[index] })), instructions };
}

/** Sample text throughout, for Craig to rewrite (spec/05, The pitch). Hungary's MM stands on 4-2-4,
 *  Hidegkuti a false 9 (Craig, 6 Nov 2026). */
export const DEFAULT_CLASSICS: readonly Classic[] = [
  classic(
    "Keegan's Newcastle",
    "1995-96, Keegan",
    "Crosses from both flanks for the strikers to head; a centre-back and both central midfielders attack.",
    "4-4-2",
    ["shotStopper", "overlappingFullBack", "attackingCentreBack", "stopper", "overlappingFullBack", "crosser", "attackingEight", "boxToBox", "crosser", "targetMan", "poacher"],
    { attacking: "getItWide", defensive: "holdAHighLine" },
  ),
  classic(
    "Barcelona's tiki-taka",
    "2008-11, Guardiola",
    "Short passes from the back, a false 9 dropping deep and the ball won back high.",
    "4-3-3",
    ["sweeperKeeper", "defensiveFullBack", "ballPlayingDefender", "ballPlayingDefender", "overlappingFullBack", "attackingEight", "midfieldEngine", "boxToBox", "widePlaymaker", "insideForward", "falseNine"],
    { attacking: "playOutFromTheBack", defensive: "pressHigh" },
  ),
  classic(
    "Hungary in the 50s",
    "1953, Sebes",
    "The Mighty Magyars: Hidegkuti dropping off as a false 9, Puskás shooting from anywhere.",
    "4-2-4",
    ["sweeperKeeper", "defensiveFullBack", "stopper", "noNonsenseCentreBack", "defensiveFullBack", "boxToBox", "ballWinner", "winger", "winger", "falseNine", "poacher"],
    // Press high needs three in a row, which a 4-2-4 has nowhere (#990): its back four holds a line.
    { attacking: "shootOnSight", defensive: "holdAHighLine" },
  ),
  classic(
    "Man United",
    "1998-99, Ferguson",
    "Wingers crossing for a strike pair that ran in behind.",
    "4-4-2",
    ["shotStopper", "overlappingFullBack", "stopper", "noNonsenseCentreBack", "defensiveFullBack", "crosser", "boxToBox", "ballWinner", "crosser", "poacher", "inBehindStriker"],
    { attacking: "getItWide", defensive: "getStuckIn" },
  ),
  classic(
    "Sacchi's Milan",
    "1988-89, Sacchi",
    "Zonal pressing in a compact block, a high line, and Gullit and Van Basten up front.",
    "4-4-2",
    ["shotStopper", "overlappingFullBack", "ballPlayingDefender", "stopper", "defensiveFullBack", "wideMidfielder", "attackingEight", "ballWinner", "defensiveWinger", "poacher", "falseNine"],
    { attacking: "playOutFromTheBack", defensive: "pressHigh" },
  ),
  classic(
    "Arsenal Invincibles",
    "2003-04, Wenger",
    "Bergkamp making chances between the lines for Henry running in behind.",
    "4-4-1-1",
    ["shotStopper", "overlappingFullBack", "stopper", "ballPlayingDefender", "defensiveFullBack", "wideMidfieldPlaymaker", "boxToBox", "ballWinner", "wideMidfielder", "numberTen", "inBehindStriker"],
    { attacking: "playOutFromTheBack", defensive: "holdAHighLine" },
  ),
  classic(
    "Greece",
    "Euro 2004, Rehhagel",
    "Clean sheets, everything cleared, and crosses for a big man to head.",
    "4-3-3",
    ["commandingKeeper", "defensiveFullBack", "stopper", "noNonsenseCentreBack", "defensiveFullBack", "ballWinner", "midfieldEngine", "boxToBox", "trackingWinger", "trackingWinger", "targetMan"],
    { attacking: "getItWide", defensive: "clearIt" },
  ),
  classic(
    "Conte's Chelsea",
    "2016-17, Conte",
    "Wide men crossing from both flanks and inside forwards cutting in to shoot.",
    "3-4-3",
    ["shotStopper", "stopper", "libero", "noNonsenseCentreBack", "crosser", "ballWinner", "midfieldEngine", "crosser", "insideForward", "insideForward", "targetMan"],
    { attacking: "getItWide", defensive: "getStuckIn" },
  ),
];

/** Whether these starters stand as the classic sets them: one in each of its slots, on its role
 *  there. `roleOf` is the role a starter plays (roles.ts `roleIn`). Once a manager changes a role,
 *  or a starter leaves a slot empty, it is custom (spec/05; Craig, 1 Nov 2026). */
export function standsAsClassic<Starter extends Cell>(starters: readonly Starter[], { cells }: Classic, roleOf: (starter: Starter) => string): boolean {
  return (
    starters.length === cells.length &&
    cells.every((slot) => starters.some((starter) => sameCell(starter, slot) && roleOf(starter) === slot.role))
  );
}

/** Whether the cells are exactly the classic's, in any order: its shape never changes (spec/05). */
export const inClassicShape = (cells: readonly Cell[], { cells: slots }: Classic): boolean => sameShape(slots, cells);
